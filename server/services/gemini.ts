import { GoogleGenAI } from '@google/genai';
import { dbAll } from '../db.ts';
import { getDaysToHarvest, getGrowthStage } from '../constants/crops.ts';

/**
 * Builds a snapshot of the current farm state to inject into AI prompts.
 */
export async function getFarmContext(userId?: number): Promise<string> {
  const zones = userId
    ? await dbAll('SELECT * FROM zones WHERE user_id = ?', userId)
    : await dbAll('SELECT * FROM zones');
  const tasks = userId
    ? await dbAll(
        'SELECT t.*, z.name as zone_name FROM tasks t JOIN zones z ON t.zone_id = z.id WHERE z.user_id = ? ORDER BY t.scheduled_time DESC LIMIT 20',
        userId
      )
    : await dbAll(
        'SELECT t.*, z.name as zone_name FROM tasks t JOIN zones z ON t.zone_id = z.id ORDER BY t.scheduled_time DESC LIMIT 20'
      );
  const logs = userId
    ? await dbAll(
        'SELECT l.*, z.name as zone_name FROM logs l LEFT JOIN zones z ON l.zone_id = z.id WHERE z.user_id = ? ORDER BY l.timestamp DESC LIMIT 10',
        userId
      )
    : await dbAll(
        'SELECT l.*, z.name as zone_name FROM logs l LEFT JOIN zones z ON l.zone_id = z.id ORDER BY l.timestamp DESC LIMIT 10'
      );

  const today = new Date();

  const zoneDetails = zones
    .map((z: any) => {
      const plantingDate = new Date(z.planting_date);
      const growthDay = Math.ceil(Math.abs(today.getTime() - plantingDate.getTime()) / 86400000);
      const maxDays = getDaysToHarvest(z.crop_type);
      const stage = getGrowthStage(growthDay, maxDays);
      return `- ${z.name}: ${z.crop_type}, ${z.area_size} acres, planted ${z.planting_date}, day ${growthDay}/${maxDays} (${stage} stage), irrigation: ${z.irrigation_status}, status: ${z.status}, expected yield: ${z.expected_yield_kg}kg, actual yield: ${z.actual_yield_kg}kg`;
    })
    .join('\n');

  const taskDetails = tasks
    .map((t: any) => `- [${t.status}] ${t.task_type} for ${t.zone_name} at ${t.scheduled_time} (${t.duration_minutes}min) - ${t.reasoning || 'No reason'}`)
    .join('\n');

  const logDetails = logs
    .map((l: any) => `- [${l.severity}] ${l.zone_name || 'System'}: ${l.message} (${l.timestamp})`)
    .join('\n');

  return `
=== CURRENT FARM DATA ===
Date: ${today.toISOString().split('T')[0]}

ZONES:
${zoneDetails || 'No zones configured'}

RECENT TASKS (last 20):
${taskDetails || 'No tasks'}

RECENT LOGS (last 10):
${logDetails || 'No logs'}
=== END FARM DATA ===`;
}

/**
 * Creates a short-lived ephemeral token (valid ~60 s, single use) for the
 * Gemini Live API. The client uses this token in place of the raw API key,
 * so the key is never exposed to the browser.
 */
export async function createEphemeralToken(): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');

  const expireTime = new Date(Date.now() + 60_000).toISOString();

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/ephemeralTokens?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          uses: 1,
          expire_time: expireTime,
          new_session_config: {
            model: 'models/gemini-2.5-flash',
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ephemeral token request failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as any;
  if (!data.token) throw new Error('No token in ephemeral token response');
  return data.token;
}

/**
 * Sends a chat request directly to Gemini (no ADK). Used as the ADK fallback.
 */
export async function chatViaGeminiDirect(
  message: string,
  contents: any[],
  image?: string,
  mimeType?: string,
  userId?: number
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');

  const ai = new GoogleGenAI({ apiKey });
  const farmContext = await getFarmContext(userId);

  const systemInstruction = `You are 'BwanaShamba' (AI Farm Assistant) for a farm in Tanzania growing horticulture crops (tomatoes, onions, peppers, cabbage, spinach, cucumbers, watermelon, eggplant, carrots, lettuce, okra, green beans) and maize.
You help farmers with questions about all these crops — soil, pest control, irrigation, fertigation, harvest timing, and market prices.
You are fluent in both English and Kiswahili. IMPORTANT: Always respond in the same language the user is currently using. If the user writes in Kiswahili, respond entirely in Kiswahili. If the user writes in English, respond in English. If the user switches languages mid-conversation, switch with them immediately.
Be concise, practical, and helpful. Use the live farm data below to give specific, accurate answers about zones, tasks, and conditions.

${farmContext}

Current Date: ${new Date().toISOString()}`;

  if (image) {
    const lastContent = contents[contents.length - 1];
    if (lastContent) {
      lastContent.parts.unshift({ inlineData: { mimeType: mimeType || 'image/jpeg', data: image } });
    }
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: { systemInstruction },
  });
  return response.text || 'I could not generate a response.';
}
