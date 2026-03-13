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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-[#002c11]/5">
          <h3 className="text-lg font-black text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>New Manual Task</h3>
          <button onClick={onClose} className="text-[#5d6c7b] hover:text-[#002c11] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[#002c11]/60 mb-1.5 uppercase tracking-[0.12em]">Zone</label>
            <select 
              value={zoneId} 
              onChange={e => setZoneId(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-[#002c11]/10 rounded-lg text-[#002c11] text-sm font-medium transition-all duration-300 focus:border-[#035925] focus:shadow-[0_0_0_3px_rgba(3,89,37,0.1)] outline-none"
            >
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name} ({z.crop_type})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#002c11]/60 mb-1.5 uppercase tracking-[0.12em]">Task Type</label>
            <select 
              value={type} 
              onChange={e => setType(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-[#002c11]/10 rounded-lg text-[#002c11] text-sm font-medium transition-all duration-300 focus:border-[#035925] focus:shadow-[0_0_0_3px_rgba(3,89,37,0.1)] outline-none"
            >
              <option value="Irrigation">Irrigation</option>
              <option value="Fertigation">Fertigation</option>
              <option value="Scouting">Scouting</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#002c11]/60 mb-1.5 uppercase tracking-[0.12em]">Duration (mins)</label>
            <input 
              type="number" 
              value={duration} 
              onChange={e => setDuration(Number(e.target.value))}
              className="w-full px-4 py-3 bg-white border-2 border-[#002c11]/10 rounded-lg text-[#002c11] text-sm font-medium transition-all duration-300 focus:border-[#035925] focus:shadow-[0_0_0_3px_rgba(3,89,37,0.1)] outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#002c11]/60 mb-1.5 uppercase tracking-[0.12em]">Reason / Notes</label>
            <input 
              type="text" 
              value={reason} 
              onChange={e => setReason(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-[#002c11]/10 rounded-lg text-[#002c11] text-sm font-medium transition-all duration-300 focus:border-[#035925] focus:shadow-[0_0_0_3px_rgba(3,89,37,0.1)] outline-none"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-[#002c11] bg-[#f9f6f1] hover:bg-[#002c11]/10 rounded-lg font-bold text-sm transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2.5 text-white bg-[#035925] hover:bg-[#002c11] rounded-lg font-bold text-sm shadow-sm transition-colors"
              style={{ fontFamily: "'Instrument Sans', sans-serif" }}
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
