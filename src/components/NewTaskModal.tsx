import { useState } from 'react';
import { X } from 'lucide-react';

export default function NewTaskModal({ onClose, onSave, zones }: { onClose: () => void, onSave: (task: any) => void, zones: any[] }) {
  const [zoneId, setZoneId] = useState(zones[0]?.id || '');
  const [type, setType] = useState('Scouting');
  const [duration, setDuration] = useState(30);
  const [reason, setReason] = useState('Manual Observation');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      zone_id: Number(zoneId),
      task_type: type,
      scheduled_time: new Date().toISOString(),
      duration_minutes: Number(duration),
      reasoning: reason,
      status: 'Pending'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">New Manual Task</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Zone</label>
            <select 
              value={zoneId} 
              onChange={e => setZoneId(e.target.value)}
              className="w-full rounded-lg border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
            >
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name} ({z.crop_type})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Task Type</label>
            <select 
              value={type} 
              onChange={e => setType(e.target.value)}
              className="w-full rounded-lg border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
            >
              <option value="Irrigation">Irrigation</option>
              <option value="Fertigation">Fertigation</option>
              <option value="Scouting">Scouting</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Duration (mins)</label>
            <input 
              type="number" 
              value={duration} 
              onChange={e => setDuration(Number(e.target.value))}
              className="w-full rounded-lg border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason / Notes</label>
            <input 
              type="text" 
              value={reason} 
              onChange={e => setReason(e.target.value)}
              className="w-full rounded-lg border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium shadow-sm shadow-emerald-200"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
