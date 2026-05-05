import { Zone } from '../lib/api';
import { Pencil } from 'lucide-react';
import { type Language, getCropName } from '../lib/i18n';

const CROP_CONFIG: Record<string, { emoji: string; totalDays: number }> = {
  'Tomato':     { emoji: '🍅', totalDays: 120 },
  'Onion':      { emoji: '🧅', totalDays: 150 },
  'Pepper':     { emoji: '🌶️', totalDays: 130 },
  'Cabbage':    { emoji: '🥬', totalDays: 100 },
  'Spinach':    { emoji: '🥬', totalDays: 50  },
  'Cucumber':   { emoji: '🥒', totalDays: 70  },
  'Watermelon': { emoji: '🍉', totalDays: 90  },
  'Eggplant':   { emoji: '🍆', totalDays: 130 },
  'Carrot':     { emoji: '🥕', totalDays: 90  },
  'Lettuce':    { emoji: '🥗', totalDays: 65  },
  'Okra':       { emoji: '🌿', totalDays: 60  },
  'Green Bean': { emoji: '🫘', totalDays: 60  },
  'Maize':      { emoji: '🌽', totalDays: 120 },
};

const CROP_COLORS: Record<string, { bg: string; bar: string; dot: string }> = {
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

function getCropConfig(cropType: string) {
  return CROP_CONFIG[cropType] || { emoji: '🌱', totalDays: 120 };
}

function getCropColors(cropType: string) {
  return CROP_COLORS[cropType] || { bg: '#f0fdf4', bar: '#035925', dot: '#22c55e' };
}

export default function ZoneCard({
  zone,
  onUpdate,
  onEdit,
  lang = 'en',
}: {
  zone: Zone;
  onUpdate: () => void;
  onEdit?: (zone: Zone) => void;
  lang?: Language;
}) {
  const { emoji, totalDays } = getCropConfig(zone.crop_type);
  const { bg: cropBg, bar: cropBar } = getCropColors(zone.crop_type);
  const progress = Math.min((zone.current_growth_day / totalDays) * 100, 100);
  const displayCropName = getCropName(zone.crop_type, lang);
  const dayLabel = lang === 'sw' ? 'Siku' : 'Day';

  return (
    <div
      className="rounded-2xl overflow-hidden transition-shadow hover:shadow-md"
      style={{
        background: 'white',
        boxShadow: '0 1px 4px rgba(0,44,17,0.06)',
        border: '1px solid rgba(0,44,17,0.06)',
      }}
    >
      {/* ── Coloured header band ── */}
      <div
        className="flex items-center gap-3 px-3.5 py-3"
        style={{ background: cropBg }}
      >
        {/* Crop emoji */}
        <div
          className="w-9 h-9 rounded-[11px] bg-white flex items-center justify-center text-xl flex-shrink-0"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
        >
          {emoji}
        </div>

        {/* Zone name + details */}
        <div className="flex-1 min-w-0">
          <p
            className="font-black text-[#002c11] text-[13px] truncate"
            style={{ fontFamily: "'Instrument Sans', sans-serif" }}
          >
            {zone.name} — {displayCropName}
          </p>
          <p className="text-[10px] text-[#5d6c7b] mt-0.5">
            {zone.area_size} {lang === 'sw' ? 'ekari' : 'ac'} · {dayLabel} {zone.current_growth_day}/{totalDays}
          </p>
        </div>

        {/* Edit button */}
        {onEdit && (
          <button
            onClick={() => onEdit(zone)}
            className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors touch-manipulation flex-shrink-0"
            style={{ color: '#5d6c7b' }}
            onMouseOver={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Progress bar + stats ── */}
      <div className="px-3.5 py-2.5 flex items-center gap-2.5">
        {/* Progress track */}
        <div
          className="flex-1 rounded-full overflow-hidden"
          style={{ height: 5, background: 'rgba(0,44,17,0.07)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.round(progress)}%`,
              background: `linear-gradient(90deg, #035925, ${cropBar})`,
            }}
          />
        </div>

        <span
          className="font-black text-[11px] text-[#002c11] flex-shrink-0"
          style={{ fontFamily: "'Instrument Sans', sans-serif" }}
        >
          {Math.round(progress)}%
        </span>

        <span className="text-[10px] text-gray-400 flex-shrink-0">
          {(zone.expected_yield_kg || 0).toLocaleString()} kg
        </span>
      </div>
    </div>
  );
}

export { CROP_CONFIG, getCropConfig, CROP_COLORS, getCropColors };
