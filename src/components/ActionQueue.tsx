import React, { useState, useEffect } from 'react';
import { AlertOctagon, Clock, Droplets, XCircle } from 'lucide-react';

export default function ActionQueue() {
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [isCancelled, setIsCancelled] = useState(false);

  useEffect(() => {
    if (timeLeft > 0 && !isCancelled) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, isCancelled]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  if (isCancelled) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm h-full flex flex-col justify-center">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Clock className="text-indigo-600" /> Action Queue
        </h3>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
          <p className="text-red-600 font-medium">Irrigation Sequence Cancelled</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm relative overflow-hidden h-full flex flex-col justify-center">
      {/* Subtle top border accent */}
      <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
      
      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Clock className="text-indigo-600" /> Action Queue
      </h3>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="flex items-center gap-2 text-indigo-700 font-bold mb-1">
              <Droplets className="w-4 h-4" />
              Irrigation Pump Start
            </div>
            <p className="text-xs text-slate-500 font-medium">Zone A (Tomatoes) • 60 mins</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono font-bold text-indigo-600 tracking-wider">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">T-Minus</p>
          </div>
        </div>

        <div className="w-full bg-slate-200 h-1.5 rounded-full mb-4 overflow-hidden">
          <div 
            className="h-full bg-indigo-500 transition-all duration-1000" 
            style={{ width: `${(timeLeft / 600) * 100}%` }}
          ></div>
        </div>

        <button 
          onClick={() => setIsCancelled(true)}
          className="w-full py-3 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-red-600 rounded-xl font-semibold tracking-wide flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
        >
          <XCircle className="w-5 h-5" />
          OVERRIDE / CANCEL
        </button>
      </div>
    </div>
  );
}
