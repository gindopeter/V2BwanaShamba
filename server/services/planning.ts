import { llm, MODELS } from './llm/index.ts';
import { dbRun, dbGet } from '../db.ts';
import { getDaysToHarvest } from '../constants/crops.ts';

export interface StoredMilestone {
  name: string;
  date: string;   // YYYY-MM-DD
  icon: string;
  actions: string[];
  completed: boolean;
}

export function computeStatus(ms: StoredMilestone, today: Date): 'completed' | 'current' | 'upcoming' {
  if (ms.completed) return 'completed';
  const msDate = new Date(ms.date);
  const diffDays = (msDate.getTime() - today.getTime()) / 86400000;
  // Auto-complete milestones whose date passed more than 7 days ago
  if (diffDays < -7) return 'completed';
  // "current" = within a 14-day window centred on today (7 days past to 7 days future)
  if (diffDays <= 7) return 'current';
  return 'upcoming';
}

export async function generateAndSavePlan(
  zone: { id: number; user_id: number; name: string; crop_type: string; planting_date: string; area_size: number },
  location: string,
  lang: 'en' | 'sw'
): Promise<void> {
  const planted = new Date(zone.planting_date);
  const maxDays = getDaysToHarvest(zone.crop_type);
  const harvest = new Date(planted);
  harvest.setDate(harvest.getDate() + maxDays);
  const harvestStr = harvest.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const isSwahili = lang === 'sw';

  const enPrompt = `You are an expert crop planning advisor for smallholder farms in ${location}. Today is ${today}.

ZONE: zone_id:${zone.id}  name:"${zone.name}"  crop:"${zone.crop_type}"  planted:${zone.planting_date}  harvest:${harvestStr}  area:${zone.area_size}ac

Produce exactly 5–7 key milestones from planting through to harvest (e.g. Land Prep & Planting, Germination, Seedling Establishment, Vegetative Growth, Flowering/Fruiting, Maturity Assessment, Harvest). Tailor milestone names and dates to the specific crop "${zone.crop_type}".

Rules:
1. Distribute milestone dates evenly between planting date and harvest date.
2. For each milestone provide exactly 2–3 brief, specific actions (max 10 words each).
3. Assign an emoji icon per milestone.
4. Dates must be ISO format YYYY-MM-DD.
5. Set "completed": false for all milestones (user will mark them complete manually).

Reply ONLY with valid JSON — no markdown, no code fences:
{"milestones":[{"name":"","date":"YYYY-MM-DD","icon":"","actions":["",""],"completed":false}]}`;

  const swPrompt = `Wewe ni mshauri wa upangaji wa kilimo kwa wakulima wadogo ${location}. Leo ni ${today}.

ENEO: zone_id:${zone.id}  name:"${zone.name}"  crop:"${zone.crop_type}"  planted:${zone.planting_date}  harvest:${harvestStr}  area:${zone.area_size}ac

Toa hatua muhimu 5–7 kuanzia kupanda hadi mavuno kwa zao "${zone.crop_type}". Rekebisha majina ya hatua na tarehe kwa zao hili.

Kanuni:
1. Gawanya tarehe za hatua sawa kati ya tarehe ya kupanda na mavuno.
2. Kwa kila hatua, toa vitendo 2–3 maalum na vifupi (maneno 10 kwa upeo).
3. Weka emoji kwa kila hatua.
4. Tarehe ziwe katika muundo wa ISO YYYY-MM-DD.
5. Weka "completed": false kwa hatua zote (mkulima ataziandika kama zilizokamilika).

Jibu kwa JSON tu — bila markdown:
{"milestones":[{"name":"","date":"YYYY-MM-DD","icon":"","actions":["",""],"completed":false}]}`;

  const resultText = await llm.generate({
    model: MODELS.planning,
    contents: [{ role: 'user', parts: [{ text: isSwahili ? swPrompt : enPrompt }] }],
  });

  const raw = (resultText || '{}').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(raw);
  const milestones: StoredMilestone[] = (parsed.milestones || []).map((m: any) => ({
    name: m.name || '',
    date: m.date || '',
    icon: m.icon || '📌',
    actions: Array.isArray(m.actions) ? m.actions : [],
    completed: false,
  }));

  if (milestones.length === 0) throw new Error('No milestones returned');

  // Upsert into zone_plans
  await dbRun(
    `INSERT INTO zone_plans (zone_id, user_id, milestones, lang, generated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(zone_id) DO UPDATE SET
       milestones = excluded.milestones,
       lang = excluded.lang,
       generated_at = excluded.generated_at`,
    zone.id, zone.user_id, JSON.stringify(milestones), lang, new Date().toISOString()
  );

  console.log(`[planning] Generated plan for zone ${zone.id} (${zone.name})`);
}
