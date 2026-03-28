import { useState, useEffect } from 'react';
import { Clock, XCircle } from 'lucide-react';

interface UpcomingTaskProps {
  tasks: { id: number; zone_id: number; task_type: string; scheduled_time: string; duration_minutes: number; status: string; reasoning?: string }[];
  zones: { id: number; name: string; crop_type: string }[];
}

export default function ActionQueue({ tasks, zones }: UpcomingTaskProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [nextTask, setNextTask] = useState<any>(null);

  useEffect(() => {
    const checkNext = () => {
      const now = new Date();
      const pending = tasks
        .filter(t => t.status === 'Pending')
        .map(t => {
          const scheduled = new Date(t.scheduled_time);
          const diffMs = scheduled.getTime() - now.getTime();
          const diffMin = diffMs / 60000;
          return { ...t, diffMs, diffMin, scheduled };
        })
        .filter(t => t.diffMin > 0 && t.diffMin <= 15)
        .sort((a, b) => a.diffMs - b.diffMs);

      if (pending.length > 0) {
        setNextTask((prev: any) => {
          if (!prev || prev.id !== pending[0].id) {
            setIsCancelled(false);
          }
          return pending[0];
        });
        setTimeLeft(Math.max(0, Math.floor(pending[0].diffMs / 1000)));
      } else {
        setNextTask(null);
        setTimeLeft(null);
      }
    };

    checkNext();
    const interval = setInterval(checkNext, 30000);
    return () => clearInterval(interval);
  }, [tasks]);

  useEffect(() => {
    if (timeLeft !== null && timeLeft > 0 && !isCancelled) {
      const timer = setInterval(() => setTimeLeft(t => (t !== null && t > 0) ? t - 1 : 0), 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, isCancelled]);

  if (!nextTask || isCancelled) return null;

  const minutes = Math.floor((timeLeft || 0) / 60);
  const seconds = (timeLeft || 0) % 60;
  const showCountdown = (timeLeft || 0) <= 600;
  const zone = zones.find(z => z.id === nextTask.zone_id);
  const taskEmoji = nextTask.task_type === 'Irrigation' ? '💧' : nextTask.task_type === 'Fertigation' ? '🧪' : '🔍';

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-[#002c11]/[0.04] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#035925] to-[#0a8f3f]"></div>

      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-[#5d6c7b]" />
        <h3 className="text-xs font-black text-[#002c11] uppercase tracking-[0.15em]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Upcoming Task</h3>
        <div className="h-[2px] w-8 bg-[#fc8e44] rounded-full"></div>
      </div>

      <div className="bg-[#f9f6f1] border border-[#002c11]/5 rounded-lg p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-[13px] font-bold text-[#002c11] mb-0.5">{taskEmoji} {nextTask.task_type}</p>
            <p className="text-[10px] text-[#5d6c7b]">{zone ? `${zone.name} (${zone.crop_type})` : `Zone ${nextTask.zone_id}`} · {nextTask.duration_minutes || 60} mins</p>
          </div>
          {showCountdown && (
            <div className="text-right">
              <div className="text-xl font-mono font-black text-[#035925] tracking-wider">
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </div>
              <p className="text-[9px] text-[#5d6c7b] uppercase font-bold tracking-widest">T-Minus</p>
            </div>
          )}
        </div>

        {showCountdown && (
          <div className="w-full bg-[#002c11]/[0.06] h-1.5 rounded-full mb-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#035925] to-[#0a8f3f] transition-all duration-1000"
              style={{ width: `${((timeLeft || 0) / 600) * 100}%` }}
            ></div>
          </div>
        )}

        <button
          onClick={() => setIsCancelled(true)}
          className="w-full py-2.5 bg-white hover:bg-red-50 border border-[#002c11]/10 hover:border-red-200 text-red-600 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
        >
          <XCircle className="w-3.5 h-3.5" />
          OVERRIDE / CANCEL
        </button>
      </div>
    </div>
  );
}
