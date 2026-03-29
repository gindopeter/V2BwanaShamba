import { useState } from 'react';
import { X, Trash2, Loader2 } from 'lucide-react';
import { Zone } from '../lib/api';
import { type Language, t, getCropName } from '../lib/i18n';

interface ZoneModalProps {
  zone?: Zone | null;
  onClose: () => void;
  onSave: (data: { name: string; crop_type: string; planting_date: string; area_size: number }) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  lang?: Language;
  maxAreaSize?: number;
}

const CROP_LIST = [
  { value: 'Tomato',      group: 'horticulture' },
  { value: 'Onion',       group: 'horticulture' },
  { value: 'Pepper',      group: 'horticulture' },
  { value: 'Cabbage',     group: 'horticulture' },
  { value: 'Spinach',     group: 'horticulture' },
  { value: 'Cucumber',    group: 'horticulture' },
  { value: 'Watermelon',  group: 'horticulture' },
  { value: 'Eggplant',    group: 'horticulture' },
  { value: 'Carrot',      group: 'horticulture' },
  { value: 'Lettuce',     group: 'horticulture' },
  { value: 'Okra',        group: 'horticulture' },
  { value: 'Green Bean',  group: 'horticulture' },
  { value: 'Maize',       group: 'cereal' },
];

const CROP_EMOJI: Record<string, string> = {
  Tomato: '🍅', Onion: '🧅', Pepper: '🌶️', Cabbage: '🥬', Spinach: '🥬',
  Cucumber: '🥒', Watermelon: '🍉', Eggplant: '🍆', Carrot: '🥕', Lettuce: '🥗',
  Okra: '🌿', 'Green Bean': '🫘', Maize: '🌽',
};

export default function ZoneModal({ zone, onClose, onSave, onDelete, lang = 'en', maxAreaSize }: ZoneModalProps) {
  const isEditing = !!zone;
  const today = new Date().toISOString().split('T')[0];

  const [name, setName] = useState(zone?.name || '');
  const [cropType, setCropType] = useState(zone?.crop_type || 'Tomato');
  const [plantingDate, setPlantingDate] = useState(zone?.planting_date?.split('T')[0] || today);
  const [areaSize, setAreaSize] = useState(zone?.area_size || 1.0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const inputClass = "w-full px-4 py-3 bg-white border-2 border-[#002c11]/10 rounded-lg text-[#002c11] text-sm font-medium transition-all duration-300 focus:border-[#035925] focus:shadow-[0_0_0_3px_rgba(3,89,37,0.1)] outline-none disabled:opacity-50";
  const labelClass = "block text-[11px] font-bold text-[#002c11]/60 mb-1.5 uppercase tracking-[0.12em]";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;

    if (maxAreaSize && Number(areaSize) > maxAreaSize) {
      setError(
        lang === 'sw'
          ? `Ukubwa wa eneo (${areaSize} ekari) hauwezi kuzidi ukubwa wa shamba lako (${maxAreaSize} ekari)`
          : `Zone size (${areaSize} acres) cannot exceed your total farm size (${maxAreaSize} acres)`
      );
      return;
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

  const horticultureCrops = CROP_LIST.filter(c => c.group === 'horticulture');
  const cerealCrops = CROP_LIST.filter(c => c.group === 'cereal');

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
            <select value={cropType} onChange={e => setCropType(e.target.value)} className={inputClass} disabled={saving}>
              <optgroup label={t(lang, 'horticulture')}>
                {horticultureCrops.map(c => (
                  <option key={c.value} value={c.value}>
                    {CROP_EMOJI[c.value]} {getCropName(c.value, lang)}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t(lang, 'cereal')}>
                {cerealCrops.map(c => (
                  <option key={c.value} value={c.value}>
                    {CROP_EMOJI[c.value]} {getCropName(c.value, lang)}
                  </option>
                ))}
              </optgroup>
            </select>
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
                  ({lang === 'sw' ? `max: ${maxAreaSize} ekari` : `max: ${maxAreaSize} acres`})
                </span>
              ) : null}
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max={maxAreaSize || undefined}
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
