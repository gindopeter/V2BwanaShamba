import { GoogleGenAI } from '@google/genai';
import { dbAll, dbGet } from '../db.ts';

export async function getFarmContext(userId?: number): Promise<string> {
  const zones = userId
    ? await dbAll('SELECT * FROM zones WHERE user_id = ? OR user_id IS NULL', userId)
    : await dbAll('SELECT * FROM zones');
  const tasks = await dbAll(
    'SELECT t.*, z.name as zone_name FROM tasks t JOIN zones z ON t.zone_id = z.id ORDER BY t.scheduled_time DESC LIMIT 20'
  );
  const logs = await dbAll(
    'SELECT l.*, z.name as zone_name FROM logs l LEFT JOIN zones z ON l.zone_id = z.id ORDER BY l.timestamp DESC LIMIT 10'
  );

  const today = new Date();
  const cropDays: Record<string, number> = {
    Tomato: 120, Onion: 150, Pepper: 130, Cabbage: 100, Spinach: 50,
    Cucumber: 70, Watermelon: 90, Eggplant: 130, Carrot: 90, Lettuce: 65,
    Okra: 60, 'Green Bean': 60, Maize: 120,
  };

  const zoneDetails = zones
    .map((z: any) => {
      const plantingDate = new Date(z.planting_date);
      const growthDay = Math.ceil(Math.abs(today.getTime() - plantingDate.getTime()) / 86400000);
      const maxDays = cropDays[z.crop_type] || 120;
      const stage =
        growthDay <= maxDays * 0.25 ? 'Seedling'
        : growthDay <= maxDays * 0.5 ? 'Vegetative'
        : growthDay <= maxDays * 0.75 ? 'Flowering'
        : 'Harvest';
      return `- ${z.name}: ${z.crop_type}, ${z.area_size} acres, planted ${z.planting_date}, day ${growthDay}/${maxDays} (${stage} stage), status: ${z.status}, expected yield: ${z.expected_yield_kg}kg, actual yield: ${z.actual_yield_kg}kg`;
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

const ADK_URL = process.env.ADK_SERVICE_URL || 'http://localhost:8001';
const ADK_TOKEN = process.env.ADK_INTERNAL_TOKEN || 'bwanashamba-internal-dev-token';

export async function chatViaADK(
  message: string,
  userId: string,
  sessionId: string | null,
  image?: string,
  mimeType?: string
): Promise<{ reply: string; adkSessionId: string; agentName: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const body: any = { message, user_id: `user_${userId}`, session_id: sessionId };
    if (image) { body.image = image; body.mime_type = mimeType || 'image/jpeg'; }
    const resp = await fetch(`${ADK_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADK_TOKEN}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`ADK returned ${resp.status}`);
    const data = (await resp.json()) as any;
    return { reply: data.reply, adkSessionId: data.session_id, agentName: data.agent_name };
  } finally {
    clearTimeout(timeout);
  }
}

export function createADKStreamFetch(
  message: string,
  userId: string,
  sessionId: string | null,
  image?: string,
  mimeType?: string
): { promise: Promise<Response>; abort: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  const body: any = { message, user_id: `user_${userId}`, session_id: sessionId, stream: true };
  if (image) { body.image = image; body.mime_type = mimeType || 'image/jpeg'; }
  const promise = fetch(`${ADK_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADK_TOKEN}` },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).then(resp => {
    if (!resp.ok) { clearTimeout(timeout); throw new Error(`ADK returned ${resp.status}`); }
    return resp;
  });
  return { promise, abort: () => { clearTimeout(timeout); controller.abort(); } };
}

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
