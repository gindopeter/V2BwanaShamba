import { GoogleGenAI } from '@google/genai';
import { dbAll, dbGet } from '../db.ts';
import { getDaysToHarvest, getGrowthStage } from '../constants/crops.ts';
import { TANZANIA_DISTRICT_COORDS } from '../constants/district_coords.ts';
import { languageDirective, type DetectedLanguage } from './language.ts';

// Region-centre fallback coords (first/main city per region)
const REGION_FALLBACK: Record<string, { lat: number; lon: number }> = {
  'Arusha': { lat: -3.3869, lon: 36.6827 },
  'Dar es Salaam': { lat: -6.8235, lon: 39.2695 },
  'Dodoma': { lat: -6.1731, lon: 35.7395 },
  'Geita': { lat: -2.8667, lon: 32.1667 },
  'Iringa': { lat: -7.7701, lon: 35.693 },
  'Kagera': { lat: -1.3319, lon: 31.8196 },
  'Katavi': { lat: -6.3433, lon: 31.0667 },
  'Kigoma': { lat: -4.8769, lon: 29.6267 },
  'Kilimanjaro': { lat: -3.35, lon: 37.3333 },
  'Lindi': { lat: -9.9966, lon: 39.7166 },
  'Manyara': { lat: -4.2167, lon: 35.75 },
  'Mara': { lat: -1.5, lon: 33.8 },
  'Mbeya': { lat: -8.9, lon: 33.45 },
  'Morogoro': { lat: -6.8242, lon: 37.6615 },
  'Mtwara': { lat: -10.264, lon: 40.1833 },
  'Mwanza': { lat: -2.5167, lon: 32.9 },
  'Njombe': { lat: -9.3333, lon: 34.7667 },
  'Pwani': { lat: -6.44, lon: 38.91 },
  'Rukwa': { lat: -7.9667, lon: 31.6167 },
  'Ruvuma': { lat: -10.6833, lon: 35.65 },
  'Shinyanga': { lat: -3.6635, lon: 33.427 },
  'Simiyu': { lat: -2.8167, lon: 34.0667 },
  'Singida': { lat: -4.8158, lon: 34.7469 },
  'Songwe': { lat: -9.0, lon: 33.1 },
  'Tabora': { lat: -5.0167, lon: 32.8 },
  'Tanga': { lat: -5.0694, lon: 39.0994 },
};

const WMO_CODES: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 51: 'Light drizzle', 53: 'Moderate drizzle', 61: 'Slight rain',
  63: 'Moderate rain', 65: 'Heavy rain', 80: 'Showers', 81: 'Moderate showers',
  82: 'Violent showers', 95: 'Thunderstorm', 99: 'Severe thunderstorm',
};

/**
 * Resolves (lat, lon, label) for a given district/region.
 */
function resolveCoords(district?: string, region?: string): { lat: number; lon: number; label: string } {
  if (region && district && TANZANIA_DISTRICT_COORDS[region]?.[district]) {
    const c = TANZANIA_DISTRICT_COORDS[region][district];
    return { lat: c.lat, lon: c.lon, label: `${district} District, ${region} Region, Tanzania` };
  }
  if (region && REGION_FALLBACK[region]) {
    const c = REGION_FALLBACK[region];
    return { lat: c.lat, lon: c.lon, label: `${region} Region, Tanzania` };
  }
  return { lat: -6.1731, lon: 35.7395, label: 'Tanzania' };
}

/**
 * Fetches a 7-day weather snapshot from Open-Meteo for the given location.
 * Returns a compact text block ready to paste into a system prompt.
 */
export async function fetchWeatherContext(district?: string, region?: string): Promise<string> {
  const { lat, lon, label } = resolveCoords(district, region);
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code` +
      `&timezone=Africa%2FDar_es_Salaam&forecast_days=7`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as any;

    const cur = data.current || {};
    const d = data.daily || {};
    const dates: string[] = d.time || [];

    const forecastLines = dates.map((date: string, i: number) => {
      const hi = d.temperature_2m_max?.[i] ?? '?';
      const lo = d.temperature_2m_min?.[i] ?? '?';
      const rain = d.precipitation_sum?.[i] ?? 0;
      const prob = d.precipitation_probability_max?.[i] ?? 0;
      const wind = d.wind_speed_10m_max?.[i] ?? '?';
      const cond = WMO_CODES[d.weather_code?.[i] ?? 0] ?? 'Unknown';
      return `  ${date}: ${lo}-${hi}°C, ${rain}mm rain, ${prob}% chance, wind ${wind}km/h — ${cond}`;
    }).join('\n');

    const currentCondition = WMO_CODES[cur.weather_code ?? 0] ?? 'Unknown';

    return `\n=== LIVE WEATHER FOR ${label.toUpperCase()} ===
Current: ${cur.temperature_2m}°C, Humidity: ${cur.relative_humidity_2m}%, Wind: ${cur.wind_speed_10m}km/h — ${currentCondition}
7-Day Forecast:
${forecastLines}
Fertigation tip: schedule on dry days with rain chance <30% and wind <25km/h, early morning 5:30-7:00 AM.
=== END WEATHER ===\n`;
  } catch (err: any) {
    return `\n[Weather unavailable for ${label}: ${err.message}]\n`;
  }
}

/**
 * Builds a snapshot of the current farm state to inject into AI prompts.
 */
export async function getFarmContext(userId?: number): Promise<string> {
  const profile = userId
    ? await dbGet('SELECT first_name, last_name, region, district, farm_size_acres FROM users WHERE id = ?', userId)
    : null;

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
        'SELECT l.*, z.name as zone_name FROM logs l LEFT JOIN zones z ON l.zone_id = z.id WHERE z.user_id = ? ORDER BY l.timestamp DESC LIMIT 30',
        userId
      )
    : await dbAll(
        'SELECT l.*, z.name as zone_name FROM logs l LEFT JOIN zones z ON l.zone_id = z.id ORDER BY l.timestamp DESC LIMIT 30'
      );

  const today = new Date();

  const farmerName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Unknown';
  const location = [
    profile?.district ? `${profile.district} District` : null,
    profile?.region ? `${profile.region} Region` : null,
    'Tanzania',
  ].filter(Boolean).join(', ');

  const zoneDetails = zones
    .map((z: any) => {
      const plantingDate = new Date(z.planting_date);
      const growthDay = Math.ceil(Math.abs(today.getTime() - plantingDate.getTime()) / 86400000);
      const maxDays = getDaysToHarvest(z.crop_type);
      const stage = getGrowthStage(growthDay, maxDays);
      return `- ${z.name}: ${z.crop_type}, ${z.area_size} acres, planted ${z.planting_date}, day ${growthDay}/${maxDays} (${stage} stage), status: ${z.status}, expected yield: ${z.expected_yield_kg}kg, actual yield: ${z.actual_yield_kg}kg`;
    })
    .join('\n');

  const taskDetails = tasks
    .map((t: any) => `- [${t.status}] ${t.task_type} for ${t.zone_name} at ${t.scheduled_time} (${t.duration_minutes}min) - ${t.reasoning || 'No reason'}`)
    .join('\n');

  const logDetails = logs
    .map((l: any) => `- [${l.severity}] ${l.zone_name || 'System'}: ${l.message} (${l.timestamp})`)
    .join('\n');

  const cropSummary = zones.length > 0
    ? [...new Set(zones.map((z: any) => z.crop_type))].join(', ')
    : 'None';

  return `
=== CURRENT FARM DATA ===
Date: ${today.toISOString().split('T')[0]}
Farmer: ${farmerName}
Location: ${location}
Farm Size: ${profile?.farm_size_acres ? `${profile.farm_size_acres} acres` : 'Not specified'}
Crops Being Grown: ${cropSummary}

ZONES (${zones.length} total):
${zoneDetails || 'No zones configured'}

RECENT TASKS (last 20):
${taskDetails || 'No tasks'}

ACTIVITY LOGS / REPORTS (last 30 entries):
${logDetails || 'No logs'}
=== END FARM DATA ===`;
}

/**
 * Builds the BwanaShamba system instruction, injecting the farmer's live farm
 * data and weather. Shared by the streaming and non-streaming direct-Gemini calls.
 */
async function buildChatSystemInstruction(
  userId?: number,
  responseLang?: DetectedLanguage | null
): Promise<string> {
  const profile = userId
    ? await dbGet('SELECT region, district, farm_size_acres FROM users WHERE id = ?', userId)
    : null;

  const [farmContext, weatherContext] = await Promise.all([
    getFarmContext(userId),
    fetchWeatherContext(profile?.district ?? undefined, profile?.region ?? undefined),
  ]);

  const locationLine = profile?.district || profile?.region
    ? `Farm Location: ${[profile.district && `${profile.district} District`, profile.region && `${profile.region} Region`].filter(Boolean).join(', ')}, Tanzania`
    : 'Farm Location: Tanzania';

  const langDirective = languageDirective(responseLang ?? null);
  return `${langDirective ? langDirective + '\n\n' : ''}LANGUAGE RULE — HIGHEST PRIORITY: Look at the language of the LAST USER MESSAGE only. If it is English, your entire response MUST be in English. If it is Kiswahili, your entire response MUST be in Kiswahili. Do NOT use the conversation history to decide language — only the last message matters. Switch immediately whenever the user switches languages.

You are 'BwanaShamba', an AI agricultural assistant focused on Tanzania. You have deep knowledge of Tanzanian agriculture across all 26 regions — including soils, climate zones, crops, pests, diseases, irrigation, fertigation, market prices, and farming practices.

CROP KNOWLEDGE: You assist with ALL crops — horticulture (vegetables, fruits), cereals (maize, rice, wheat, sorghum, millet), legumes (beans, chickpeas, cowpeas), cash crops (coffee, tea, cashew, cotton, tobacco, sisal, pyrethrum), root crops (cassava, sweet potato, Irish potato), bananas, avocado, and any other crop the farmer asks about.

TANZANIA AGRICULTURE EXPERTISE:
- You know the soil types across Tanzania (e.g. red laterite soils in Arusha/Kilimanjaro, black clay soils in Mbeya/Iringa, sandy soils in coastal regions, volcanic soils on Kilimanjaro slopes) and can analyse them using your knowledge of regional geography and satellite-based soil data.
- You understand Tanzania's agricultural zones, rainfall patterns (unimodal vs. bimodal), and seasonal calendars.
- You can advise on input availability, subsidies, markets (e.g. Kariakoo, regional markets), and export opportunities relevant to Tanzania.
- When discussing soil types, climate, or agronomy for a specific Tanzanian location, draw on regional knowledge and any available satellite/remote-sensing insights.

COMPARATIVE ANALYSIS: When the farmer asks to compare Tanzania's agriculture with other countries (e.g. Kenya, Ethiopia, South Africa, Netherlands), you can do so — covering productivity, practices, technology, market access, and lessons that apply to Tanzanian farmers.

USER DATA: The farm data below is THIS FARMER'S actual data from the app. Always reference it when answering questions about their farm, crops, zones, tasks, yields, or activity history. If the farmer asks about their reports, logs, or performance, analyse the data provided and give specific advice.

${locationLine}
${weatherContext}
${farmContext}

Current Date/Time: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Dar_es_Salaam' })} EAT
Be concise, practical, and specific. Prioritise advice that is immediately actionable for the farmer.`;
}

/**
 * Sends a chat request directly to Gemini (no ADK). Used as the ADK fallback.
 * Includes live weather data for the user's farm location.
 */
export async function chatViaGeminiDirect(
  message: string,
  contents: any[],
  image?: string,
  mimeType?: string,
  userId?: number,
  responseLang?: DetectedLanguage | null
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');

  const ai = new GoogleGenAI({ apiKey });
  const systemInstruction = await buildChatSystemInstruction(userId, responseLang);

  if (image) {
    const lastContent = contents[contents.length - 1];
    if (lastContent) {
      lastContent.parts.unshift({ inlineData: { mimeType: mimeType || 'image/jpeg', data: image } });
    }
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents,
    config: { systemInstruction },
  });
  return response.text || 'I could not generate a response.';
}

/**
 * Streaming variant of {@link chatViaGeminiDirect}. Invokes `onChunk` for each
 * text fragment as it arrives so the SSE fallback can type the reply out
 * progressively, and resolves with the full accumulated reply (for persistence).
 */
export async function chatViaGeminiDirectStream(
  message: string,
  contents: any[],
  image: string | undefined,
  mimeType: string | undefined,
  userId: number | undefined,
  responseLang: DetectedLanguage | null | undefined,
  onChunk: (piece: string) => void
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');

  const ai = new GoogleGenAI({ apiKey });
  const systemInstruction = await buildChatSystemInstruction(userId, responseLang);

  if (image) {
    const lastContent = contents[contents.length - 1];
    if (lastContent) {
      lastContent.parts.unshift({ inlineData: { mimeType: mimeType || 'image/jpeg', data: image } });
    }
  }

  const stream = await ai.models.generateContentStream({
    model: 'gemini-3-flash-preview',
    contents,
    config: { systemInstruction },
  });

  let full = '';
  for await (const chunk of stream) {
    const piece = chunk.text;
    if (piece) {
      full += piece;
      onChunk(piece);
    }
  }
  return full || 'I could not generate a response.';
}

