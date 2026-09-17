/**
 * Shared crop constants used across the server.
 * Previously duplicated in getFarmContext() and GET /api/zones.
 *
 * ── How to read the two numbers ──────────────────────────────────────────────
 *
 * `daysToHarvest` is the time from PLANTING to the FIRST harvest.
 *
 *   For annuals that is the growing season. For perennials and tree crops it is
 *   the juvenile period — the years a tree spends unproductive before it bears
 *   at all — NOT the interval between later harvests. A farmer planting coffee
 *   waits about three years for the first cherry, then picks every year after.
 *   The app models a zone from its planting date, so the juvenile period is what
 *   the first harvest date has to be built on.
 *
 * `yieldPerAcreKg` targets a WELL-MANAGED smallholder with good inputs and, where
 * noted, irrigation. It is deliberately NOT the national average — Tanzanian
 * maize averages ~1.6 t/ha against the 4 t/ha assumed here. Treat it as a target
 * a good farmer can reach, not as a prediction of what any given plot will do.
 *
 * `yieldBasis` says what one `yieldPerAcreKg` actually covers:
 *
 *   'per-season' (the default, omitted)  the total off one planting cycle,
 *                                        including repeat picking for crops like
 *                                        tomato, kale and okra.
 *   'per-year'                           a MATURE stand's annual yield, repeating
 *                                        every year once bearing starts. The first
 *                                        harvest after the juvenile period is
 *                                        typically well below this.
 */

export type YieldBasis = 'per-season' | 'per-year';

export interface CropInfo {
  /** Days from planting to first harvest (juvenile period for perennials). */
  daysToHarvest: number;
  /** Kg per acre for a well-managed crop — a target, not a forecast. */
  yieldPerAcreKg: number;
  /** What one `yieldPerAcreKg` covers. Defaults to 'per-season'. */
  yieldBasis?: YieldBasis;
}

export const CROP_DATA: Record<string, CropInfo> = {
  // Cereals — targets a well-managed irrigated smallholder (not national average)
  Maize:           { daysToHarvest: 120, yieldPerAcreKg:  1600 }, // ~4 t/ha irrigated; national avg 1.6 t/ha
  Rice:            { daysToHarvest: 150, yieldPerAcreKg:  2000 }, // ~5 t/ha irrigated (SRI methods)
  Sorghum:         { daysToHarvest: 120, yieldPerAcreKg:   900 }, // ~2.2 t/ha managed
  Millet:          { daysToHarvest: 90,  yieldPerAcreKg:   700 }, // ~1.7 t/ha managed
  Wheat:           { daysToHarvest: 120, yieldPerAcreKg:  1600 }, // ~4 t/ha highland managed
  Barley:          { daysToHarvest: 100, yieldPerAcreKg:  1000 }, // ~2.5 t/ha highland
  // Vegetables — irrigated, good inputs. Season totals: most are picked repeatedly.
  Tomato:          { daysToHarvest: 120, yieldPerAcreKg: 10000 }, // ~25 t/ha irrigated managed
  Kale:            { daysToHarvest: 60,  yieldPerAcreKg:  5000 }, // ~12 t/ha continuous harvest
  Onion:           { daysToHarvest: 150, yieldPerAcreKg:  6000 }, // ~15 t/ha irrigated (Iringa, Arusha)
  Cabbage:         { daysToHarvest: 100, yieldPerAcreKg:  8000 }, // ~20 t/ha managed
  Spinach:         { daysToHarvest: 50,  yieldPerAcreKg:  3500 }, // ~8.6 t/ha
  Amaranth:        { daysToHarvest: 45,  yieldPerAcreKg:  3000 }, // ~7.4 t/ha
  'Sweet Pepper':  { daysToHarvest: 90,  yieldPerAcreKg:  6000 }, // ~15 t/ha irrigated
  Pepper:          { daysToHarvest: 130, yieldPerAcreKg:  4000 }, // ~10 t/ha fresh hot pepper
  Cucumber:        { daysToHarvest: 70,  yieldPerAcreKg:  8000 }, // ~20 t/ha irrigated
  Eggplant:        { daysToHarvest: 130, yieldPerAcreKg:  6000 }, // ~15 t/ha managed
  Carrot:          { daysToHarvest: 90,  yieldPerAcreKg:  7000 }, // ~17 t/ha highland irrigated
  Watermelon:      { daysToHarvest: 90,  yieldPerAcreKg: 10000 }, // ~25 t/ha irrigated
  Pumpkin:         { daysToHarvest: 100, yieldPerAcreKg:  5000 }, // ~12 t/ha
  Okra:            { daysToHarvest: 60,  yieldPerAcreKg:  3000 }, // ~7.4 t/ha
  'Green Bean':    { daysToHarvest: 60,  yieldPerAcreKg:  3000 }, // ~7.4 t/ha irrigated
  Garlic:          { daysToHarvest: 150, yieldPerAcreKg:  2500 }, // ~6.2 t/ha
  Lettuce:         { daysToHarvest: 65,  yieldPerAcreKg:  5000 }, // ~12 t/ha irrigated
  // Legumes — dryland/light irrigation
  'Common Bean':   { daysToHarvest: 90,  yieldPerAcreKg:  1000 }, // ~2.5 t/ha improved varieties
  Cowpea:          { daysToHarvest: 75,  yieldPerAcreKg:   600 }, // ~1.5 t/ha
  Groundnut:       { daysToHarvest: 110, yieldPerAcreKg:  1000 }, // ~2.5 t/ha managed
  'Pigeon Pea':    { daysToHarvest: 180, yieldPerAcreKg:   600 }, // ~1.5 t/ha
  Soybean:         { daysToHarvest: 100, yieldPerAcreKg:  1200 }, // ~3 t/ha improved varieties
  Chickpea:        { daysToHarvest: 100, yieldPerAcreKg:   600 }, // ~1.5 t/ha highland
  // Root Crops — lifted once at the end of the cycle
  Cassava:         { daysToHarvest: 365, yieldPerAcreKg:  6000 }, // ~15 t/ha improved varieties
  'Sweet Potato':  { daysToHarvest: 120, yieldPerAcreKg:  6500 }, // ~16 t/ha improved
  'Irish Potato':  { daysToHarvest: 90,  yieldPerAcreKg:  6000 }, // ~15 t/ha highland irrigated
  Yam:             { daysToHarvest: 270, yieldPerAcreKg:  4000 }, // ~10 t/ha managed
  // Fruits — daysToHarvest is planting to FIRST fruit; grafted stock assumed for trees
  Banana:          { daysToHarvest:  365, yieldPerAcreKg:  7000, yieldBasis: 'per-year' }, // ~17 t/ha managed (Kagera, Kilimanjaro); sucker to first bunch ~12 mo
  Mango:           { daysToHarvest: 1095, yieldPerAcreKg:  3000, yieldBasis: 'per-year' }, // ~7.4 t/ha mature; grafted bears at ~3 yr (was 120 — that is flower to ripe fruit, not planting)
  Avocado:         { daysToHarvest: 1095, yieldPerAcreKg:  3000, yieldBasis: 'per-year' }, // ~7.4 t/ha mature; grafted bears at ~3 yr
  Coconut:         { daysToHarvest: 2190, yieldPerAcreKg:  2500, yieldBasis: 'per-year' }, // ~6 t/ha mature (fresh weight, coastal); tall palms bear at ~6 yr
  Papaya:          { daysToHarvest:  270, yieldPerAcreKg:  8000, yieldBasis: 'per-year' }, // ~20 t/ha irrigated; fruits from ~9 mo, then continuously
  Pineapple:       { daysToHarvest:  540, yieldPerAcreKg: 10000 }, // ~25 t/ha managed; ~18 mo plant crop, fruits once
  Orange:          { daysToHarvest: 1095, yieldPerAcreKg:  5000, yieldBasis: 'per-year' }, // ~12 t/ha mature; grafted citrus bears at ~3 yr
  'Passion Fruit': { daysToHarvest:  270, yieldPerAcreKg:  5000, yieldBasis: 'per-year' }, // ~12 t/ha irrigated; vine fruits in its first year
  Guava:           { daysToHarvest:  730, yieldPerAcreKg:  4000, yieldBasis: 'per-year' }, // ~10 t/ha mature; bears at ~2 yr
  Jackfruit:       { daysToHarvest: 1460, yieldPerAcreKg:  4000, yieldBasis: 'per-year' }, // ~10 t/ha mature; bears at ~4 yr
  // Cash Crops — the perennials here spend years unproductive before first harvest
  Cashew:          { daysToHarvest: 1095, yieldPerAcreKg:   400, yieldBasis: 'per-year' }, // ~1 t/ha raw nuts mature (Mtwara, Lindi); bears at ~3 yr
  Coffee:          { daysToHarvest: 1095, yieldPerAcreKg:   500, yieldBasis: 'per-year' }, // ~1.2 t/ha green beans mature, good management; first cherry at ~3 yr
  Cotton:          { daysToHarvest:  180, yieldPerAcreKg:   650 }, // ~1.6 t/ha seed cotton managed
  Sisal:           { daysToHarvest:  730, yieldPerAcreKg:  2000 }, // ~5 t/ha dry fibre over the 2 years to first cut
  Sunflower:       { daysToHarvest:  100, yieldPerAcreKg:   800 }, // ~2 t/ha managed
  Tea:             { daysToHarvest: 1095, yieldPerAcreKg:  1500, yieldBasis: 'per-year' }, // ~3.7 t/ha green leaf mature; first plucking at ~3 yr, then every 7-14 days
  Sugarcane:       { daysToHarvest:  365, yieldPerAcreKg: 22000, yieldBasis: 'per-year' }, // ~54 t/ha irrigated managed; plant cane then annual ratoons
  Tobacco:         { daysToHarvest:  120, yieldPerAcreKg:   900 }, // ~2.2 t/ha cured leaf managed
  Sesame:          { daysToHarvest:   90, yieldPerAcreKg:   500 }, // ~1.2 t/ha managed
  Clove:           { daysToHarvest: 2190, yieldPerAcreKg:   250, yieldBasis: 'per-year' }, // ~0.6 t/ha dried (Zanzibar managed); trees bear at ~6 yr. Was 600 kg/acre = 1.5 t/ha, roughly 3x what a mature stand of ~100 trees/ha yields
  Pyrethrum:       { daysToHarvest:  180, yieldPerAcreKg:   200, yieldBasis: 'per-year' }, // ~0.5 t/ha dried flowers (highland); perennial, picked repeatedly each year
};

export const VALID_CROP_TYPES = Object.keys(CROP_DATA);

export function getGrowthStage(growthDay: number, maxDays: number): string {
  if (growthDay <= maxDays * 0.25) return 'Seedling';
  if (growthDay <= maxDays * 0.50) return 'Vegetative';
  if (growthDay <= maxDays * 0.75) return 'Flowering';
  return 'Harvest';
}

export function getDaysToHarvest(cropType: string): number {
  return CROP_DATA[cropType]?.daysToHarvest ?? 120;
}

/**
 * Unknown crops get a deliberately conservative figure rather than a flattering
 * one. The previous fallback of 15000 kg/acre (~37 t/ha) was higher than every
 * crop in the catalogue except sugarcane and 23x the maize figure, so a zone
 * that missed the catalogue was promised an impossible harvest. Both POST and
 * PUT /api/zones validate crop_type against VALID_CROP_TYPES, so this is only
 * reachable by rows already stored with an off-catalogue crop name.
 */
export function getYieldPerAcre(cropType: string): number {
  return CROP_DATA[cropType]?.yieldPerAcreKg ?? 1000;
}

/** Whether `yieldPerAcreKg` is one season's total or a mature stand's yearly yield. */
export function getYieldBasis(cropType: string): YieldBasis {
  return CROP_DATA[cropType]?.yieldBasis ?? 'per-season';
}
