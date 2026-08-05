#!/usr/bin/env node
/**
 * Crop catalogue consistency check.
 *
 * The 54-crop catalogue is spelled out in four places that no compiler ties
 * together — three languages and two runtimes, so there is no import that could
 * do it for us. Each consumer degrades quietly rather than crashing when a crop
 * is missing, which is exactly what makes drift expensive to notice:
 *
 *   server/constants/crops.ts   CROP_DATA       authoritative; drives harvest
 *                                               dates and yield forecasts
 *   src/lib/crops.ts            CROP_LIST       the zone dropdown — a crop
 *                                               missing here is unreachable
 *   src/lib/crops.ts            CROP_EMOJI      falls back to a generic seedling
 *   src/lib/i18n.ts             CROP_NAMES_SW   falls back to the English name
 *   adk_service/.../farm_tools  CROP_CATALOGUE  agent loses crop-group guidance
 *
 * CROP_DATA is the source of truth; every other list is checked against it.
 * Run via `npm run lint`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** Narrow a file to a single literal so unrelated code can't match the key patterns. */
function block(text, startMarker, endMarker, label) {
  const start = text.indexOf(startMarker);
  if (start === -1) throw new Error(`Could not find ${label} (marker: ${startMarker})`);
  const end = text.indexOf(endMarker, start);
  if (end === -1) throw new Error(`Could not find the end of ${label}`);
  return text.slice(start, end);
}

const matchAll = (text, re) => [...text.matchAll(re)].map((m) => (m[1] ?? m[2]).trim());

// ─── the five lists ───────────────────────────────────────────────────────────

const serverSrc = read('server/constants/crops.ts');
const clientSrc = read('src/lib/crops.ts');
const i18nSrc = read('src/lib/i18n.ts');
const pythonSrc = read('adk_service/tools/farm_tools.py');

// `  Maize: { ... }` / `  'Sweet Pepper': { ... }` — the `: {` keeps the nested
// daysToHarvest/yieldPerAcreKg keys from matching.
const cropData = matchAll(
  block(serverSrc, 'CROP_DATA: Record<string, CropInfo> = {', '\n};', 'CROP_DATA'),
  /^\s{2}(?:'([^']+)'|([A-Za-z][A-Za-z ]*?))\s*:\s*\{/gm,
);

const cropList = matchAll(
  block(clientSrc, 'CROP_LIST: { value: string; group: CropGroup }[] = [', '\n];', 'CROP_LIST'),
  /\{\s*value:\s*'([^']+)'/g,
);

// Several entries per line, keys quoted only when they contain a space.
const cropEmoji = matchAll(
  block(clientSrc, 'CROP_EMOJI: Record<string, string> = {', '\n};', 'CROP_EMOJI'),
  /(?:[{,]\s*)(?:'([^']+)'|([A-Za-z][A-Za-z ]*?))\s*:\s*'/g,
);

const cropNamesSw = matchAll(
  block(i18nSrc, 'CROP_NAMES_SW: Record<string, string> = {', '\n};', 'CROP_NAMES_SW'),
  /^\s*'([^']+)'\s*:/gm,
);

// Python keys are lowercase; compared case-insensitively below.
const cropCatalogue = matchAll(
  block(pythonSrc, 'CROP_CATALOGUE = {', '\n}', 'CROP_CATALOGUE'),
  /"([^"]+)"\s*:\s*"/g,
);

// ─── compare ──────────────────────────────────────────────────────────────────

const checks = [
  { label: 'CROP_LIST (zone dropdown)', file: 'src/lib/crops.ts', names: cropList },
  { label: 'CROP_EMOJI', file: 'src/lib/crops.ts', names: cropEmoji },
  { label: 'CROP_NAMES_SW (Swahili names)', file: 'src/lib/i18n.ts', names: cropNamesSw },
  {
    label: 'CROP_CATALOGUE (ADK agent groups)',
    file: 'adk_service/tools/farm_tools.py',
    names: cropCatalogue,
    lowercase: true,
  },
];

const problems = [];

if (cropData.length === 0) {
  problems.push('CROP_DATA in server/constants/crops.ts parsed as empty — the check itself is broken.');
}

for (const { label, file, names, lowercase } of checks) {
  const norm = (s) => (lowercase ? s.toLowerCase() : s);
  const expected = new Set(cropData.map(norm));
  const actual = new Set(names.map(norm));

  const missing = [...expected].filter((c) => !actual.has(c));
  const extra = [...actual].filter((c) => !expected.has(c));

  if (missing.length) problems.push(`${label} — ${file}\n    missing: ${missing.join(', ')}`);
  if (extra.length) problems.push(`${label} — ${file}\n    not in CROP_DATA: ${extra.join(', ')}`);
}

if (problems.length) {
  console.error(`\n✗ Crop catalogue out of sync (${cropData.length} crops in CROP_DATA):\n`);
  for (const p of problems) console.error(`  ${p}\n`);
  console.error('  Source of truth: server/constants/crops.ts\n');
  process.exit(1);
}

console.log(`✓ Crop catalogue in sync — ${cropData.length} crops across all 5 lists`);
