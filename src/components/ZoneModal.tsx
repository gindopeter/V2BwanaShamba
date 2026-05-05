import { useState, useRef, useEffect } from 'react';
import { X, Trash2, Loader2, ChevronDown, Search } from 'lucide-react';
import { Zone } from '../lib/api';
import { type Language, t, getCropName } from '../lib/i18n';

interface ZoneModalProps {
  zone?: Zone | null;
  onClose: () => void;
  onSave: (data: { name: string; crop_type: string; planting_date: string; area_size: number }) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  lang?: Language;
  maxAreaSize?: number;
  usedAcres?: number;
}

const CROP_LIST: { value: string; group: string }[] = [
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

const CROP_EMOJI: Record<string, string> = {
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

const GROUP_ORDER = ['cereal', 'vegetables', 'legumes', 'rootCrops', 'fruits', 'cashCrops'] as const;

export default function ZoneModal({ zone, onClose, onSave, onDelete, lang = 'en', maxAreaSize, usedAcres = 0 }: ZoneModalProps) {
  const isEditing = !!zone;
  const today = new Date().toISOString().split('T')[0];

  const [name, setName] = useState(zone?.name || '');
  const [cropType, setCropType] = useState(zone?.crop_type || 'Maize');
  const [plantingDate, setPlantingDate] = useState(zone?.planting_date?.split('T')[0] || today);
  const [areaSize, setAreaSize] = useState(zone?.area_size || 1.0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [cropSearch, setCropSearch] = useState('');
  const [cropPickerOpen, setCropPickerOpen] = useState(false);
  const cropPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cropPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (cropPickerRef.current && !cropPickerRef.current.contains(e.target as Node)) {
        setCropPickerOpen(false);
        setCropSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cropPickerOpen]);

  const inputClass = "w-full px-4 py-3 bg-white border-2 border-[#002c11]/10 rounded-lg text-[#002c11] text-sm font-medium transition-all duration-300 focus:border-[#035925] focus:shadow-[0_0_0_3px_rgba(3,89,37,0.1)] outline-none disabled:opacity-50";
  const labelClass = "block text-[11px] font-bold text-[#002c11]/60 mb-1.5 uppercase tracking-[0.12em]";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;

    if (maxAreaSize) {
      const available = parseFloat((maxAreaSize - usedAcres).toFixed(2));
      if (Number(areaSize) > available) {
        setError(
          lang === 'sw'
            ? `Ukubwa wa eneo (${areaSize} ekari) unazidi nafasi iliyobaki kwenye shamba lako (${available} ekari)`
            : `Zone size (${areaSize} acres) exceeds remaining farm space (${available} acres available)`
        );
        return;
      }
    }

    if (plantingDate > today) {
      setError(lang === 'sw' ? 'Tarehe ya kupanda haiwezi kuwa tarehe ya baadaye' : 'Planting date cannot be in the future');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave({ name: name.trim(), crop_type: cropType, planting_date: plantingDate, area_size: Number(areaSize) });
    } catch (err: any) {
      setError(err.message || (lang === 'sw' ? 'Hitilafu imetokea' : 'Something went wrong'));
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !zone || saving) return;
    setSaving(true);
    setError('');
    try {
      await onDelete(zone.id);
    } catch (err: any) {
      setError(err.message || (lang === 'sw' ? 'Imeshindwa kufuta eneo' : 'Failed to delete zone'));
      setSaving(false);
    }
  };

  const filteredCrops = cropSearch.trim()
    ? CROP_LIST.filter(c => {
        const query = cropSearch.toLowerCase();
        const enName = c.value.toLowerCase();
        const swName = getCropName(c.value, 'sw').toLowerCase();
        return enName.includes(query) || swName.includes(query);
      })
    : CROP_LIST;

  const groupedCrops = GROUP_ORDER.map(group => ({
    group,
    label: t(lang, group as any),
    crops: filteredCrops.filter(c => c.group === group),
  })).filter(g => g.crops.length > 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-[#002c11]/5">
          <h3 className="text-lg font-black text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
            {isEditing
              ? (lang === 'sw' ? 'Hariri Eneo' : 'Edit Zone')
              : (lang === 'sw' ? 'Ongeza Eneo Jipya' : 'Add New Zone')}
          </h3>
          <button onClick={onClose} disabled={saving} className="text-[#5d6c7b] hover:text-[#002c11] transition-colors disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          <div>
            <label className={labelClass}>{t(lang, 'zoneName')}</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={lang === 'sw' ? 'mfano: Eneo A' : 'e.g. Zone A'}
              className={inputClass}
              required
              disabled={saving}
            />
          </div>

          <div>
            <label className={labelClass}>{t(lang, 'cropType')}</label>
            <div ref={cropPickerRef} className="relative">
              <button
                type="button"
                onClick={() => { if (!saving) { setCropPickerOpen(o => !o); setCropSearch(''); } }}
                disabled={saving}
                className={`${inputClass} flex items-center justify-between text-left`}
              >
                <span>{CROP_EMOJI[cropType]} {getCropName(cropType, lang)}</span>
                <ChevronDown className={`w-4 h-4 text-[#5d6c7b] flex-shrink-0 transition-transform ${cropPickerOpen ? 'rotate-180' : ''}`} />
              </button>

              {cropPickerOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border-2 border-[#002c11]/10 rounded-lg shadow-xl overflow-hidden">
                  <div className="p-2 border-b border-[#002c11]/5">
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#f9f6f1] rounded-md">
                      <Search className="w-3.5 h-3.5 text-[#5d6c7b] flex-shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        value={cropSearch}
                        onChange={e => setCropSearch(e.target.value)}
                        placeholder={t(lang, 'searchCrops' as any)}
                        className="flex-1 bg-transparent text-sm text-[#002c11] placeholder-[#5d6c7b]/60 outline-none"
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {groupedCrops.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-[#5d6c7b]/60 text-center">
                        {lang === 'sw' ? 'Hakuna zao lililopatikana' : 'No crops found'}
                      </div>
                    ) : groupedCrops.map(({ group, label, crops }) => (
                      <div key={group}>
                        <div className="px-3 py-1.5 text-[10px] font-bold text-[#002c11]/40 uppercase tracking-widest bg-[#f9f6f1]/60 sticky top-0">
                          {label}
                        </div>
                        {crops.map(c => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => { setCropType(c.value); setCropPickerOpen(false); setCropSearch(''); }}
                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors
                              ${cropType === c.value
                                ? 'bg-[#035925]/10 text-[#035925] font-semibold'
                                : 'text-[#002c11] hover:bg-[#f9f6f1]'}`}
                          >
                            <span className="text-base leading-none">{CROP_EMOJI[c.value]}</span>
                            <span>{getCropName(c.value, lang)}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>{t(lang, 'plantingDate')}</label>
            <input
              type="date"
              value={plantingDate}
              onChange={e => setPlantingDate(e.target.value)}
              max={today}
              className={inputClass}
              required
              disabled={saving}
            />
          </div>

          <div>
            <label className={labelClass}>
              {t(lang, 'areaSize')}
              {maxAreaSize ? (
                <span className="ml-2 normal-case font-normal text-[#5d6c7b]/60">
                  {lang === 'sw'
                    ? `zilizobaki: ${parseFloat((maxAreaSize - usedAcres).toFixed(2))} / ${maxAreaSize} ekari`
                    : `available: ${parseFloat((maxAreaSize - usedAcres).toFixed(2))} / ${maxAreaSize} acres`}
                </span>
              ) : null}
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max={maxAreaSize ? parseFloat((maxAreaSize - usedAcres).toFixed(2)) : undefined}
              value={areaSize}
              onChange={e => setAreaSize(Number(e.target.value))}
              className={inputClass}
              required
              disabled={saving}
            />
          </div>

          <div className="pt-4 flex gap-3">
            {isEditing && onDelete && (
              <>
                {showDeleteConfirm ? (
                  <div className="flex-1 flex gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={saving}
                      className="flex-1 px-3 py-2.5 text-white bg-red-600 hover:bg-red-700 rounded-lg font-bold text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      {lang === 'sw' ? 'Thibitisha Kufuta' : 'Confirm Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={saving}
                      className="px-3 py-2.5 text-[#002c11] bg-[#f9f6f1] hover:bg-[#002c11]/10 rounded-lg font-bold text-xs transition-colors disabled:opacity-50"
                    >
                      {lang === 'sw' ? 'Ghairi' : 'Cancel'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={saving}
                    className="px-3 py-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-bold text-xs transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
            {!showDeleteConfirm && (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 text-[#002c11] bg-[#f9f6f1] hover:bg-[#002c11]/10 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
                >
                  {lang === 'sw' ? 'Ghairi' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 text-white bg-[#035925] hover:bg-[#002c11] rounded-lg font-bold text-sm shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {isEditing
                    ? (lang === 'sw' ? 'Hifadhi Mabadiliko' : 'Save Changes')
                    : (lang === 'sw' ? 'Unda Eneo' : 'Create Zone')}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
