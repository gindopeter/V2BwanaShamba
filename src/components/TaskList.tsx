import { Task } from '../lib/api';
import { CheckCircle } from 'lucide-react';

export default function TaskList({ tasks, onAction }: { tasks: Task[], onAction: (id: number, action: string) => void }) {
  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-[#002c11]/[0.04] text-center">
        <div className="w-10 h-10 bg-[#035925]/10 rounded-full flex items-center justify-center mx-auto mb-2">
          <CheckCircle className="w-5 h-5 text-[#035925]" />
        </div>
        <p className="text-sm font-bold text-[#002c11]">All Caught Up</p>
        <p className="text-[11px] text-[#5d6c7b] mt-0.5">No pending tasks for today.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#002c11]/[0.04] divide-y divide-[#002c11]/[0.04]">
      {tasks.map((task) => {
        const isPending = task.status === 'Pending';
        const isDone = task.status === 'Completed';
        const dotColor = isDone ? 'bg-[#035925]' : 'bg-[#fc8e44]';

        return (
          <div key={task.id} className="flex items-center gap-3 p-3.5 group">
            <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`}></span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[#002c11] truncate">{task.task_type}</p>
              <p className="text-[10px] text-[#5d6c7b]">
                {task.zone_name} · {new Date(task.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {isPending ? (
              <button
                onClick={() => onAction(task.id, 'Completed')}
                className="text-[10px] font-black text-[#fc8e44] bg-[#fc8e44]/10 px-2.5 py-1 rounded-full border border-[#fc8e44]/20 shrink-0 hover:bg-[#fc8e44]/20 transition-colors"
              >
                TODO
              </button>
            ) : (
              <span className="text-[10px] font-black text-[#035925] bg-[#035925]/10 px-2.5 py-1 rounded-full border border-[#035925]/20 shrink-0">
                DONE
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
