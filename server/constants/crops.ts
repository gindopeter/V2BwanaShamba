/**
 * Shared crop constants used across the server.
 * Previously duplicated in getFarmContext() and GET /api/zones.
 */

export interface CropInfo {
  daysToHarvest: number;
  yieldPerAcreKg: number;
}

export const CROP_DATA: Record<string, CropInfo> = {
  Tomato:       { daysToHarvest: 120, yieldPerAcreKg: 30000 },
  Onion:        { daysToHarvest: 150, yieldPerAcreKg: 15000 },
  Pepper:       { daysToHarvest: 130, yieldPerAcreKg: 20000 },
  Cabbage:      { daysToHarvest: 100, yieldPerAcreKg: 25000 },
  Spinach:      { daysToHarvest: 50,  yieldPerAcreKg: 10000 },
  Cucumber:     { daysToHarvest: 70,  yieldPerAcreKg: 20000 },
  Watermelon:   { daysToHarvest: 90,  yieldPerAcreKg: 35000 },
  Eggplant:     { daysToHarvest: 130, yieldPerAcreKg: 25000 },
  Carrot:       { daysToHarvest: 90,  yieldPerAcreKg: 18000 },
  Lettuce:      { daysToHarvest: 65,  yieldPerAcreKg: 12000 },
  Okra:         { daysToHarvest: 60,  yieldPerAcreKg: 10000 },
  'Green Bean': { daysToHarvest: 60,  yieldPerAcreKg:  8000 },
  Maize:        { daysToHarvest: 120, yieldPerAcreKg:  6000 },
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
