import { Task } from '../lib/api';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function TaskList({ tasks, onAction }: { tasks: Task[], onAction: (id: number, action: string) => void }) {
  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-200">
          <CheckCircle className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-slate-900 font-bold">All Caught Up</h3>
        <p className="text-slate-500 text-sm mt-1">No pending tasks for today.</p>
      </div>
    );
  }

  return (
    <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 py-2">
      {tasks.map((task) => (
        <div key={task.id} className="relative pl-6 sm:pl-8">
          {/* Timeline Dot */}
          <div className={cn(
            "absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 border-white shadow-sm flex items-center justify-center",
            task.status === 'Completed' ? "bg-emerald-500" :
            task.status === 'Missed' ? "bg-red-500" :
            "bg-indigo-500"
          )} />

          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:shadow-md transition-all group">
            <div className="flex items-start gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
                task.task_type === 'Irrigation' ? "bg-blue-50 text-blue-600 border-blue-100" :
                task.task_type === 'Fertigation' ? "bg-purple-50 text-purple-600 border-purple-100" :
                "bg-amber-50 text-amber-600 border-amber-100"
              )}>
                {task.task_type === 'Irrigation' && <DropletsIcon />}
                {task.task_type === 'Fertigation' && <FlaskIcon />}
                {task.task_type === 'Scouting' && <EyeIcon />}
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-slate-900 text-lg">{task.task_type}</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                    {task.zone_name}
                  </span>
                </div>
                <p className="text-sm text-slate-500 flex items-center gap-1.5 font-medium">
                  <Clock className="w-4 h-4 text-slate-400" />
                  {(() => {
                    const taskDate = new Date(task.scheduled_time);
                    const today = new Date();
                    const tomorrow = new Date();
                    tomorrow.setDate(today.getDate() + 1);
                    const taskDay = taskDate.toLocaleDateString();
                    if (taskDay === today.toLocaleDateString()) return 'Today';
                    if (taskDay === tomorrow.toLocaleDateString()) return 'Tomorrow';
                    return taskDate.toLocaleDateString();
                  })()} at {new Date(task.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                  <span className="text-slate-300">•</span> 
                  {task.duration_minutes} mins
                </p>
                {task.reasoning && (
                  <div className="flex items-start gap-1.5 mt-3 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 w-fit font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{task.reasoning}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:ml-auto pt-2 sm:pt-0">
              {task.status === 'Pending' && (
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                  <button 
                    onClick={() => onAction(task.id, 'Confirmed')}
                    className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg transition-all w-full sm:w-auto"
                  >
                    DELAY
                  </button>
                  <button 
                    onClick={() => onAction(task.id, 'Completed')}
                    className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all active:scale-95 tracking-wider w-full sm:w-auto"
                  >
                    START
                  </button>
                </div>
              )}
              {task.status === 'Completed' && (
                <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                  <CheckCircle className="w-4 h-4" />
                  COMPLETED
                </span>
              )}
               {task.status === 'Missed' && (
                <span className="flex items-center gap-1.5 text-sm font-bold text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                  <XCircle className="w-4 h-4" />
                  DELAYED
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DropletsIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.8-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/></svg>;
}

function FlaskIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.31"/><path d="M14 2v7.31"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/></svg>;
}

function EyeIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>;
}
