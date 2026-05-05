/**
 * Shared crop constants used across the server.
 * Previously duplicated in getFarmContext() and GET /api/zones.
 */

export interface CropInfo {
  daysToHarvest: number;
  yieldPerAcreKg: number;
}

export const CROP_DATA: Record<string, CropInfo> = {
  // Cereals — targets a well-managed irrigated smallholder (not national average)
  Maize:           { daysToHarvest: 120, yieldPerAcreKg:  1600 }, // ~4 t/ha irrigated; national avg 1.6 t/ha
  Rice:            { daysToHarvest: 150, yieldPerAcreKg:  2000 }, // ~5 t/ha irrigated (SRI methods)
  Sorghum:         { daysToHarvest: 120, yieldPerAcreKg:   900 }, // ~2.2 t/ha managed
  Millet:          { daysToHarvest: 90,  yieldPerAcreKg:   700 }, // ~1.7 t/ha managed
  Wheat:           { daysToHarvest: 120, yieldPerAcreKg:  1600 }, // ~4 t/ha highland managed
  Barley:          { daysToHarvest: 100, yieldPerAcreKg:  1000 }, // ~2.5 t/ha highland
  // Vegetables — irrigated, good inputs
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
  // Root Crops
  Cassava:         { daysToHarvest: 365, yieldPerAcreKg:  6000 }, // ~15 t/ha improved varieties
  'Sweet Potato':  { daysToHarvest: 120, yieldPerAcreKg:  6500 }, // ~16 t/ha improved
  'Irish Potato':  { daysToHarvest: 90,  yieldPerAcreKg:  6000 }, // ~15 t/ha highland irrigated
  Yam:             { daysToHarvest: 270, yieldPerAcreKg:  4000 }, // ~10 t/ha managed
  // Fruits — per season/annual cycle
  Banana:          { daysToHarvest: 365, yieldPerAcreKg:  7000 }, // ~17 t/ha managed (Kagera, Kilimanjaro)
  Mango:           { daysToHarvest: 120, yieldPerAcreKg:  3000 }, // ~7.4 t/ha per season
  Avocado:         { daysToHarvest: 180, yieldPerAcreKg:  3000 }, // ~7.4 t/ha managed
  Coconut:         { daysToHarvest: 365, yieldPerAcreKg:  2500 }, // ~6 t/ha (fresh weight, coastal)
  Papaya:          { daysToHarvest: 270, yieldPerAcreKg:  8000 }, // ~20 t/ha irrigated
  Pineapple:       { daysToHarvest: 540, yieldPerAcreKg: 10000 }, // ~25 t/ha managed
  Orange:          { daysToHarvest: 270, yieldPerAcreKg:  5000 }, // ~12 t/ha managed
  'Passion Fruit': { daysToHarvest: 270, yieldPerAcreKg:  5000 }, // ~12 t/ha irrigated
  Guava:           { daysToHarvest: 180, yieldPerAcreKg:  4000 }, // ~10 t/ha managed
  Jackfruit:       { daysToHarvest: 365, yieldPerAcreKg:  4000 }, // ~10 t/ha managed
  // Cash Crops
  Cashew:          { daysToHarvest: 270, yieldPerAcreKg:   400 }, // ~1 t/ha raw nuts (Mtwara, Lindi)
  Coffee:          { daysToHarvest: 365, yieldPerAcreKg:   500 }, // ~1.2 t/ha green beans, good management
  Cotton:          { daysToHarvest: 180, yieldPerAcreKg:   650 }, // ~1.6 t/ha seed cotton managed
  Sisal:           { daysToHarvest: 730, yieldPerAcreKg:  2000 }, // ~5 t/ha dry fibre over 2 years
  Sunflower:       { daysToHarvest: 100, yieldPerAcreKg:   800 }, // ~2 t/ha managed
  Tea:             { daysToHarvest: 365, yieldPerAcreKg:  1500 }, // ~3.7 t/ha green leaf managed
  Sugarcane:       { daysToHarvest: 365, yieldPerAcreKg: 22000 }, // ~54 t/ha irrigated managed
  Tobacco:         { daysToHarvest: 120, yieldPerAcreKg:   900 }, // ~2.2 t/ha cured leaf managed
  Sesame:          { daysToHarvest: 90,  yieldPerAcreKg:   500 }, // ~1.2 t/ha managed
  Clove:           { daysToHarvest: 365, yieldPerAcreKg:   600 }, // ~1.5 t/ha dried (Zanzibar managed)
  Pyrethrum:       { daysToHarvest: 180, yieldPerAcreKg:   200 }, // ~0.5 t/ha dried flowers (highland)
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

export function getYieldPerAcre(cropType: string): number {
  return CROP_DATA[cropType]?.yieldPerAcreKg ?? 15000;
}
