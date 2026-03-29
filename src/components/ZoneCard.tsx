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

function getCropConfig(cropType: string) {
  return CROP_CONFIG[cropType] || { emoji: '🌱', totalDays: 120 };
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
  const progress = Math.min((zone.current_growth_day / totalDays) * 100, 100);
  const displayCropName = getCropName(zone.crop_type, lang);
  const growthLabel = lang === 'sw' ? 'Maendeleo ya Ukuaji' : 'Growth Progress';
  const dayLabel = lang === 'sw' ? 'Siku' : 'Day';

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-[#002c11]/[0.04] hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#f9f6f1] flex items-center justify-center text-2xl border border-[#002c11]/5">
            {emoji}
          </div>
          <div>
            <h4 className="font-black text-[#002c11] text-[15px]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
              {zone.name} — {displayCropName}
            </h4>
            <p className="text-[11px] text-[#5d6c7b]">
              {zone.area_size} {lang === 'sw' ? 'ekari' : 'acres'} · {dayLabel} {zone.current_growth_day}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={() => onEdit(zone)}
              className="w-8 h-8 flex items-center justify-center text-[#5d6c7b] hover:text-[#002c11] border border-[#002c11]/10 rounded-lg bg-white transition-colors hover:bg-[#f9f6f1]"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="flex items-center gap-1.5 bg-[#f9f6f1] px-2.5 py-1 rounded-full">
            <span className={`w-2 h-2 rounded-full ${zone.irrigation_status === 'Running' ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
            <span className="text-[10px] font-bold text-[#002c11]/60">
              {zone.irrigation_status === 'Running'
                ? (lang === 'sw' ? 'Inabwagika' : 'Running')
                : (lang === 'sw' ? 'Imezimwa' : 'Off')}
            </span>
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[11px] mb-1.5">
          <span className="font-bold text-[#002c11]/50">{growthLabel}</span>
          <span className="font-black text-[#002c11]">{Math.round(progress)}% · {dayLabel} {zone.current_growth_day}/{totalDays}</span>
        </div>
        <div className="w-full bg-[#002c11]/[0.06] rounded-full h-2.5">
          <div className="h-2.5 rounded-full bg-gradient-to-r from-[#035925] to-[#0a8f3f] transition-all" style={{ width: `${progress}%` }}></div>
        </div>
      </div>
    </div>
  );
}

export { CROP_CONFIG, getCropConfig };
