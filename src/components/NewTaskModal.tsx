import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { type Language, t } from '../lib/i18n';

const TASK_SUGGESTIONS = [
  'Irrigation', 'Fertigation', 'Pest Scouting', 'Harvesting',
  'Planting', 'Weeding', 'Soil Testing', 'Pruning', 'Spraying', 'Other',
];

const TASK_SUGGESTIONS_SW = [
  'Umwagiliaji', 'Uwekaji Mbolea', 'Ukaguzi wa Wadudu', 'Kuvuna',
  'Kupanda', 'Kupalilia', 'Kupima Udongo', 'Kupogoa', 'Kunyunyizia', 'Nyingine',
];

export default function NewTaskModal({
  onClose,
  onSave,
  zones,
  lang = 'en',
}: {
  onClose: () => void;
  onSave: (task: any) => void;
  zones: any[];
  lang?: Language;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [zoneId, setZoneId] = useState(zones[0]?.id || '');
  const [taskType, setTaskType] = useState('');
  const [taskDate, setTaskDate] = useState(today);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const inputClass = "w-full px-4 py-3 bg-white border-2 border-[#002c11]/10 rounded-lg text-[#002c11] text-sm font-medium transition-all duration-300 focus:border-[#035925] focus:shadow-[0_0_0_3px_rgba(3,89,37,0.1)] outline-none";
  const labelClass = "block text-[11px] font-bold text-[#002c11]/60 mb-1.5 uppercase tracking-[0.12em]";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskType.trim() || saving) return;
    setSaving(true);
    onSave({
      zone_id: Number(zoneId),
      task_type: taskType.trim(),
      scheduled_time: new Date(taskDate).toISOString(),
      reasoning: reason || null,
      status: 'Pending',
    });
  };

  const suggestions = lang === 'sw' ? TASK_SUGGESTIONS_SW : TASK_SUGGESTIONS;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-[#002c11]/5">
          <h3 className="text-lg font-black text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
            {lang === 'sw' ? 'Kazi Mpya' : 'New Task'}
          </h3>
          <button onClick={onClose} disabled={saving} className="text-[#5d6c7b] hover:text-[#002c11] transition-colors disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelClass}>{lang === 'sw' ? 'Eneo' : 'Zone'}</label>
            <select
              value={zoneId}
              onChange={e => setZoneId(e.target.value)}
              className={inputClass}
              disabled={saving}
            >
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name} ({z.crop_type})</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>{t(lang, 'taskType')}</label>
            <input
              type="text"
              list="task-type-suggestions"
              value={taskType}
              onChange={e => setTaskType(e.target.value)}
              placeholder={t(lang, 'taskTypeSuggestions')}
              className={inputClass}
              required
              disabled={saving}
            />
            <datalist id="task-type-suggestions">
              {suggestions.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div>
            <label className={labelClass}>{t(lang, 'taskDate')}</label>
            <input
              type="date"
              value={taskDate}
              onChange={e => setTaskDate(e.target.value)}
              min={today}
              className={inputClass}
              required
              disabled={saving}
            />
          </div>

          <div>
            <label className={labelClass}>{t(lang, 'notes')}</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={lang === 'sw' ? 'Maelezo ya ziada (hiari)' : 'Additional notes (optional)'}
              className={inputClass}
              disabled={saving}
            />
          </div>

          <div className="pt-4 flex gap-3">
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
              disabled={saving || !taskType.trim()}
              className="flex-1 px-4 py-2.5 text-white bg-[#035925] hover:bg-[#002c11] rounded-lg font-bold text-sm shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              style={{ fontFamily: "'Instrument Sans', sans-serif" }}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {lang === 'sw' ? 'Unda Kazi' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
