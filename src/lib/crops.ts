/**
 * Shared client-side crop metadata — the display half of the crop catalogue.
 *
 * The authoritative list (and each crop's days-to-harvest / yield) lives in
 * server/constants/crops.ts. Growth length is never duplicated here: it arrives
 * on the zone payload as `total_growth_days` so the card can never drift from
 * what the server used to compute growth stage and harvest date.
 * Swahili names live in i18n.ts (CROP_NAMES_SW).
 */

export type CropGroup = 'cereal' | 'vegetables' | 'legumes' | 'rootCrops' | 'fruits' | 'cashCrops';

export const GROUP_ORDER: CropGroup[] = ['cereal', 'vegetables', 'legumes', 'rootCrops', 'fruits', 'cashCrops'];

export const CROP_LIST: { value: string; group: CropGroup }[] = [
  // Cereals
  { value: 'Maize',          group: 'cereal' },
  { value: 'Rice',           group: 'cereal' },
  { value: 'Sorghum',        group: 'cereal' },
  { value: 'Millet',         group: 'cereal' },
  { value: 'Wheat',          group: 'cereal' },
  { value: 'Barley',         group: 'cereal' },
  // Vegetables
  { value: 'Tomato',         group: 'vegetables' },
  { value: 'Kale',           group: 'vegetables' },
  { value: 'Onion',          group: 'vegetables' },
  { value: 'Cabbage',        group: 'vegetables' },
  { value: 'Spinach',        group: 'vegetables' },
  { value: 'Amaranth',       group: 'vegetables' },
  { value: 'Sweet Pepper',   group: 'vegetables' },
  { value: 'Pepper',         group: 'vegetables' },
  { value: 'Cucumber',       group: 'vegetables' },
  { value: 'Eggplant',       group: 'vegetables' },
  { value: 'Carrot',         group: 'vegetables' },
  { value: 'Watermelon',     group: 'vegetables' },
  { value: 'Pumpkin',        group: 'vegetables' },
  { value: 'Okra',           group: 'vegetables' },
  { value: 'Green Bean',     group: 'vegetables' },
  { value: 'Garlic',         group: 'vegetables' },
  { value: 'Lettuce',        group: 'vegetables' },
  // Legumes
  { value: 'Common Bean',    group: 'legumes' },
  { value: 'Cowpea',         group: 'legumes' },
  { value: 'Groundnut',      group: 'legumes' },
  { value: 'Pigeon Pea',     group: 'legumes' },
  { value: 'Soybean',        group: 'legumes' },
  { value: 'Chickpea',       group: 'legumes' },
  // Root Crops
  { value: 'Cassava',        group: 'rootCrops' },
  { value: 'Sweet Potato',   group: 'rootCrops' },
  { value: 'Irish Potato',   group: 'rootCrops' },
  { value: 'Yam',            group: 'rootCrops' },
  // Fruits
  { value: 'Banana',         group: 'fruits' },
  { value: 'Mango',          group: 'fruits' },
  { value: 'Avocado',        group: 'fruits' },
  { value: 'Coconut',        group: 'fruits' },
  { value: 'Papaya',         group: 'fruits' },
  { value: 'Pineapple',      group: 'fruits' },
  { value: 'Orange',         group: 'fruits' },
  { value: 'Passion Fruit',  group: 'fruits' },
  { value: 'Guava',          group: 'fruits' },
  { value: 'Jackfruit',      group: 'fruits' },
  // Cash Crops
  { value: 'Cashew',         group: 'cashCrops' },
  { value: 'Coffee',         group: 'cashCrops' },
  { value: 'Cotton',         group: 'cashCrops' },
  { value: 'Sisal',          group: 'cashCrops' },
  { value: 'Sunflower',      group: 'cashCrops' },
  { value: 'Tea',            group: 'cashCrops' },
  { value: 'Sugarcane',      group: 'cashCrops' },
  { value: 'Tobacco',        group: 'cashCrops' },
  { value: 'Sesame',         group: 'cashCrops' },
  { value: 'Clove',          group: 'cashCrops' },
  { value: 'Pyrethrum',      group: 'cashCrops' },
];

export const CROP_EMOJI: Record<string, string> = {
  Maize: '🌽', Rice: '🌾', Sorghum: '🌾', Millet: '🌾', Wheat: '🌾', Barley: '🌾',
  Tomato: '🍅', Kale: '🥬', Onion: '🧅', Cabbage: '🥬', Spinach: '🥬', Amaranth: '🥬',
  'Sweet Pepper': '🫑', Pepper: '🌶️', Cucumber: '🥒', Eggplant: '🍆', Carrot: '🥕',
  Watermelon: '🍉', Pumpkin: '🎃', Okra: '🌿', 'Green Bean': '🫘', Garlic: '🧄', Lettuce: '🥗',
  'Common Bean': '🫘', Cowpea: '🫘', Groundnut: '🥜', 'Pigeon Pea': '🫘', Soybean: '🫘', Chickpea: '🫘',
  Cassava: '🌿', 'Sweet Potato': '🍠', 'Irish Potato': '🥔', Yam: '🍠',
  Banana: '🍌', Mango: '🥭', Avocado: '🥑', Coconut: '🥥', Papaya: '🍈', Pineapple: '🍍',
  Orange: '🍊', 'Passion Fruit': '🍈', Guava: '🍈', Jackfruit: '🍈',
  Cashew: '🌰', Coffee: '☕', Cotton: '🌿', Sisal: '🌿', Sunflower: '🌻', Tea: '🍵',
  Sugarcane: '🌿', Tobacco: '🌿', Sesame: '🌿', Clove: '🌿', Pyrethrum: '🌸',
};

const CROP_GROUP: Record<string, CropGroup> = Object.fromEntries(
  CROP_LIST.map(c => [c.value, c.group])
) as Record<string, CropGroup>;

export interface CropColors {
  bg: string;
  bar: string;
  dot: string;
}

const GROUP_COLORS: Record<CropGroup, CropColors> = {
  cereal:     { bg: '#fef3c7', bar: '#d97706', dot: '#f59e0b' },
  vegetables: { bg: '#dcfce7', bar: '#15803d', dot: '#22c55e' },
  legumes:    { bg: '#d1fae5', bar: '#047857', dot: '#10b981' },
  rootCrops:  { bg: '#ffedd5', bar: '#c2410c', dot: '#f97316' },
  fruits:     { bg: '#fce7f3', bar: '#db2777', dot: '#ec4899' },
  cashCrops:  { bg: '#ede9fe', bar: '#6d28d9', dot: '#8b5cf6' },
};

const DEFAULT_COLORS: CropColors = { bg: '#f0fdf4', bar: '#035925', dot: '#22c55e' };

/** Per-crop overrides, so the crops that shipped first keep their familiar card colour. */
const CROP_COLORS: Record<string, CropColors> = {
  'Tomato':     { bg: '#fee2e2', bar: '#dc2626', dot: '#ef4444' },
  'Onion':      { bg: '#ede9fe', bar: '#7c3aed', dot: '#8b5cf6' },
  'Pepper':     { bg: '#fef9c3', bar: '#ca8a04', dot: '#eab308' },
  'Cabbage':    { bg: '#dcfce7', bar: '#15803d', dot: '#22c55e' },
  'Spinach':    { bg: '#dcfce7', bar: '#166534', dot: '#22c55e' },
  'Cucumber':   { bg: '#ccfbf1', bar: '#0f766e', dot: '#14b8a6' },
  'Watermelon': { bg: '#fce7f3', bar: '#db2777', dot: '#ec4899' },
  'Eggplant':   { bg: '#f3e8ff', bar: '#6d28d9', dot: '#8b5cf6' },
  'Carrot':     { bg: '#ffedd5', bar: '#ea580c', dot: '#f97316' },
  'Lettuce':    { bg: '#ecfccb', bar: '#4d7c0f', dot: '#84cc16' },
  'Okra':       { bg: '#d1fae5', bar: '#059669', dot: '#10b981' },
  'Green Bean': { bg: '#dcfce7', bar: '#16a34a', dot: '#22c55e' },
  'Maize':      { bg: '#fef3c7', bar: '#d97706', dot: '#f59e0b' },
};

/** Fallback used when a zone predates `total_growth_days` on the API payload. */
const FALLBACK_GROWTH_DAYS = 120;

export function getCropEmoji(cropType: string): string {
  return CROP_EMOJI[cropType] || '🌱';
}

export function getCropColors(cropType: string): CropColors {
  return CROP_COLORS[cropType] || GROUP_COLORS[CROP_GROUP[cropType]] || DEFAULT_COLORS;
}

/**
 * Days from planting to harvest for a zone, as the server calculated it.
 * Falls back to the planting → expected-harvest span, then to a generic season.
 */
export function getTotalGrowthDays(zone: {
  total_growth_days?: number;
  planting_date?: string;
  expected_harvest_date?: string;
}): number {
  if (zone.total_growth_days && zone.total_growth_days > 0) return zone.total_growth_days;

  if (zone.planting_date && zone.expected_harvest_date) {
    const planted = new Date(zone.planting_date).getTime();
    const harvest = new Date(zone.expected_harvest_date).getTime();
    if (!isNaN(planted) && !isNaN(harvest) && harvest > planted) {
      return Math.round((harvest - planted) / (1000 * 60 * 60 * 24));
    }
  }

  return FALLBACK_GROWTH_DAYS;
}
