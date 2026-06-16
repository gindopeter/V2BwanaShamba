// Lightweight, deterministic language detection used to steer AI responses.
//
// The chat models are instructed to reply in the language of the user's
// message, but they don't always obey — especially for short messages or when
// English farm-context is injected into the prompt. To make this reliable we
// detect the language server-side and inject an explicit directive. Detection
// is a simple distinctive-word vote between Kiswahili and English; when the
// vote is tied or empty we return null and let the model's own rule decide.

// Words that are distinctive to Kiswahili (avoiding tokens that collide with
// common English words).
const SWAHILI_WORDS = new Set([
  // function words & connectors
  'ni', 'na', 'ya', 'wa', 'za', 'la', 'cha', 'vya', 'kwa', 'ku', 'kwenye',
  'katika', 'kuhusu', 'lakini', 'sasa', 'pia', 'ndani', 'juu', 'chini',
  'kabla', 'baada', 'bila', 'hadi', 'tena', 'sana', 'hivyo', 'ili', 'kama',
  // pronouns & verbs
  'nina', 'naomba', 'nipe', 'naweza', 'unaweza', 'ninahitaji', 'nataka',
  'ninataka', 'nitafanya', 'tunaweza', 'ana', 'wana', 'yangu', 'yako', 'yake',
  'wangu', 'wako', 'wetu', 'wenu', 'langu', 'lako',
  // question words
  'nini', 'nani', 'wapi', 'lini', 'gani', 'vipi', 'ngapi', 'kwanini', 'mbona', 'je',
  // greetings / polite
  'habari', 'mambo', 'shikamoo', 'asante', 'karibu', 'tafadhali', 'samahani', 'pole',
  // affirmations
  'ndio', 'ndiyo', 'hapana', 'sawa',
  // time
  'leo', 'kesho', 'jana', 'asubuhi', 'jioni', 'usiku', 'mchana', 'mwaka',
  'mwezi', 'wiki', 'siku',
  // farming vocabulary
  'shamba', 'mashamba', 'mkulima', 'kilimo', 'mazao', 'zao', 'mbegu', 'mbolea',
  'samadi', 'mvua', 'jua', 'udongo', 'ardhi', 'wadudu', 'mdudu', 'magonjwa',
  'ugonjwa', 'mavuno', 'kuvuna', 'kupanda', 'kumwagilia', 'umwagiliaji',
  'ushauri', 'soko', 'bei', 'mimea', 'mmea', 'majani', 'mizizi', 'maua',
  'matunda', 'mboga',
  // crop names
  'mahindi', 'mpunga', 'mchele', 'maharage', 'maharagwe', 'kahawa', 'chai',
  'korosho', 'pamba', 'mihogo', 'muhogo', 'viazi', 'ndizi', 'nyanya', 'pilipili',
  'vitunguu', 'karoti', 'kabichi', 'alizeti', 'ufuta', 'dengu', 'choroko',
  'njugu', 'parachichi', 'embe', 'papai', 'nanasi',
]);

// Words that are distinctive to English in this domain.
const ENGLISH_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'can',
  'could', 'should', 'would', 'will', 'what', 'how', 'when', 'where', 'why',
  'who', 'my', 'your', 'our', 'their', 'i', 'you', 'we', 'they', 'he', 'she',
  'it', 'this', 'that', 'these', 'those', 'please', 'give', 'tell', 'want',
  'need', 'help', 'about', 'for', 'with', 'and', 'or', 'but', 'in', 'on', 'at',
  'to', 'of', 'from', 'best', 'good', 'grow', 'plant', 'soil', 'weather',
  'fertilizer', 'fertiliser', 'crop', 'crops', 'maize', 'rice', 'beans',
  'market', 'price', 'advice', 'disease', 'pest', 'pests', 'water', 'season',
  'yield', 'harvest', 'farm', 'farming',
]);

export type DetectedLanguage = 'sw' | 'en';

/**
 * Detect whether a piece of text is Kiswahili or English.
 * Returns null when the result is ambiguous (tie or no recognised words),
 * in which case callers should fall back to the model's own language rule.
 */
export function detectLanguage(text: string): DetectedLanguage | null {
  const tokens = (text || '').toLowerCase().match(/[a-zà-ÿ']+/g);
  if (!tokens || tokens.length === 0) return null;

  let sw = 0;
  let en = 0;
  for (const token of tokens) {
    if (SWAHILI_WORDS.has(token)) sw++;
    if (ENGLISH_WORDS.has(token)) en++;
  }

  if (sw > en) return 'sw';
  if (en > sw) return 'en';
  return null;
}

/**
 * Build an explicit, high-priority instruction telling the model which
 * language to reply in. Returns '' when the language is undetermined so the
 * existing in-prompt LANGUAGE RULE remains the source of truth.
 */
export function languageDirective(lang: DetectedLanguage | null): string {
  if (lang === 'sw') {
    return 'RESPONSE LANGUAGE — MANDATORY: The user is writing in Kiswahili. Your ENTIRE response MUST be written in Kiswahili. Do not use any English.';
  }
  if (lang === 'en') {
    return 'RESPONSE LANGUAGE — MANDATORY: The user is writing in English. Your ENTIRE response MUST be written in English. Do not use any Kiswahili.';
  }
  return '';
}
