/**
 * Farmer memory — the first "learning" layer.
 *
 * After each conversation we extract a few DURABLE facts about the farmer
 * (crops grown, preferences, recurring pests, irrigation method, market, etc.)
 * and store them. On future chats those facts are injected into the prompt so
 * advice is personal and consistent instead of starting from zero every time.
 *
 * Extraction runs in the background AFTER the reply is sent, so it never slows
 * down the farmer's chat.
 */
import { llm, MODELS } from './llm/index.ts';
import { dbAll, dbRun } from '../db.ts';

export interface MemoryRow {
  id: number;
  category: string;
  fact: string;
  source: string;
  created_at: string;
}

const VALID_CATEGORIES = ['crop', 'pest', 'preference', 'market', 'practice', 'location', 'other'];
const MAX_FACTS_PER_USER = 60;        // cap stored facts so prompts stay bounded
const MAX_FACTS_IN_PROMPT = 40;       // most-recent facts injected per request
const MAX_NEW_FACTS_PER_TURN = 3;     // extract at most a few per exchange

/** Returns a farmer's stored facts, newest first. */
export async function listMemories(userId: number): Promise<MemoryRow[]> {
  return dbAll(
    'SELECT id, category, fact, source, created_at FROM user_memory WHERE user_id = ? ORDER BY created_at DESC',
    userId
  );
}

/** Deletes a single fact, scoped to the owning farmer. Returns true if removed. */
export async function deleteMemory(userId: number, id: number): Promise<boolean> {
  const res = await dbRun('DELETE FROM user_memory WHERE id = ? AND user_id = ?', id, userId);
  return res.changes > 0;
}

/**
 * Builds a short text block of remembered facts to inject into a prompt.
 * Returns '' when the farmer has no memories yet.
 */
export async function getMemoryContext(userId?: number): Promise<string> {
  if (!userId) return '';
  const rows = await dbAll(
    'SELECT category, fact FROM user_memory WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    userId,
    MAX_FACTS_IN_PROMPT
  );
  if (!rows.length) return '';
  const lines = rows.map((r: any) => `- [${r.category}] ${r.fact}`).join('\n');
  return `\n=== WHAT WE KNOW ABOUT THIS FARMER (remembered from past chats) ===
${lines}
Use these remembered facts to personalise your advice. If a fact conflicts with what the farmer says now, trust the current message.
=== END MEMORY ===\n`;
}

function normalise(fact: string): string {
  return fact.toLowerCase().replace(/[^a-z0-9À-ɏ ]/gi, '').replace(/\s+/g, ' ').trim();
}

/**
 * Extracts up to a few durable facts from the latest exchange and stores any
 * that are genuinely new. Safe to fire-and-forget: never throws.
 */
export async function extractAndSaveMemories(
  userId: number,
  userMessage: string,
  aiReply: string
): Promise<void> {
  try {
    if (!userId || !userMessage?.trim()) return;

    const existing = await dbAll(
      'SELECT fact FROM user_memory WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      userId,
      MAX_FACTS_PER_USER
    );
    const existingNorm = new Set(existing.map((r: any) => normalise(r.fact)));

    const knownBlock = existing.length
      ? `Already known (do NOT repeat these):\n${existing.map((r: any) => `- ${r.fact}`).join('\n')}\n\n`
      : '';

    const prompt = `You maintain a long-term memory about a farmer using an agriculture assistant in Tanzania.
From the exchange below, extract at most ${MAX_NEW_FACTS_PER_TURN} DURABLE facts worth remembering for future conversations.

Only keep facts that are stable over time, e.g.:
- crops the farmer grows, farm/zone details
- recurring pests or diseases they face
- preferences (e.g. preferred language, irrigation method, organic-only)
- where/how they sell, market preferences
- location specifics they mention

Do NOT keep: one-off/transient details (today's weather, a single price quote),
greetings, the assistant's generic advice, or anything already known.

${knownBlock}Exchange:
Farmer: ${userMessage.slice(0, 1500)}
Assistant: ${(aiReply || '').slice(0, 1500)}

Reply ONLY with valid JSON, no markdown:
{"facts":[{"category":"crop|pest|preference|market|practice|location|other","fact":"short factual statement"}]}
If there is nothing durable to remember, reply {"facts":[]}.`;

    const raw = (await llm.generate({
      model: MODELS.fast,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }))
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(raw || '{}');
    } catch {
      console.warn('[memory] could not parse extraction output');
      return;
    }

    const facts: any[] = Array.isArray(parsed?.facts) ? parsed.facts.slice(0, MAX_NEW_FACTS_PER_TURN) : [];
    let saved = 0;
    for (const f of facts) {
      const fact = String(f?.fact || '').trim().slice(0, 280);
      if (!fact) continue;
      const norm = normalise(fact);
      if (!norm || existingNorm.has(norm)) continue;
      const category = VALID_CATEGORIES.includes(String(f?.category)) ? String(f.category) : 'other';
      await dbRun(
        'INSERT INTO user_memory (user_id, category, fact, source) VALUES (?, ?, ?, ?)',
        userId,
        category,
        fact,
        'chat'
      );
      existingNorm.add(norm);
      saved++;
    }
    if (saved > 0) console.log(`[memory] saved ${saved} new fact(s) for user ${userId}`);
  } catch (err: any) {
    console.warn('[memory] extraction failed:', err?.message);
  }
}
