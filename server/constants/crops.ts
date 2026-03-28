export const VALID_CROP_TYPES = [
  'Tomato', 'Onion', 'Pepper', 'Cabbage', 'Spinach',
  'Cucumber', 'Watermelon', 'Eggplant', 'Carrot', 'Lettuce',
  'Okra', 'Green Bean', 'Maize',
];

const DAYS_TO_HARVEST: Record<string, number> = {
  Tomato: 120, Onion: 150, Pepper: 130, Cabbage: 100, Spinach: 50,
  Cucumber: 70, Watermelon: 90, Eggplant: 130, Carrot: 90, Lettuce: 65,
  Okra: 60, 'Green Bean': 60, Maize: 120,
};

const YIELD_PER_ACRE: Record<string, number> = {
  Tomato: 30000, Onion: 15000, Pepper: 20000, Cabbage: 25000, Spinach: 10000,
  Cucumber: 20000, Watermelon: 35000, Eggplant: 25000, Carrot: 18000,
  Lettuce: 12000, Okra: 10000, 'Green Bean': 8000, Maize: 6000,
};

export function getDaysToHarvest(cropType: string): number {
  return DAYS_TO_HARVEST[cropType] || 120;
}

export function getYieldPerAcre(cropType: string): number {
  return YIELD_PER_ACRE[cropType] || 15000;
}

export function getGrowthStage(growthDay: number, maxDays: number): string {
  if (growthDay <= maxDays * 0.25) return 'Seedling';
  if (growthDay <= maxDays * 0.5)  return 'Vegetative';
  if (growthDay <= maxDays * 0.75) return 'Flowering';
  return 'Harvest';
}
