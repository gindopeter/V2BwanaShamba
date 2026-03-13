import { useState, useEffect } from 'react';
import { Clock, XCircle } from 'lucide-react';

export default function ActionQueue() {
  const [timeLeft, setTimeLeft] = useState(600);
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
      <div className="bg-white rounded-xl p-5 shadow-sm border border-[#002c11]/[0.04]">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-[#5d6c7b]" />
          <h3 className="text-xs font-black text-[#002c11] uppercase tracking-[0.15em]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Action Queue</h3>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <p className="text-red-700 font-bold text-sm">Irrigation Sequence Cancelled</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-[#002c11]/[0.04] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#035925] to-[#0a8f3f]"></div>

      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-[#5d6c7b]" />
        <h3 className="text-xs font-black text-[#002c11] uppercase tracking-[0.15em]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Action Queue</h3>
        <div className="h-[2px] w-8 bg-[#fc8e44] rounded-full"></div>
      </div>

      <div className="bg-[#f9f6f1] border border-[#002c11]/5 rounded-lg p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-[13px] font-bold text-[#002c11] mb-0.5">💧 Irrigation Pump Start</p>
            <p className="text-[10px] text-[#5d6c7b]">Zone A (Tomatoes) · 60 mins</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-mono font-black text-[#035925] tracking-wider">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>
            <p className="text-[9px] text-[#5d6c7b] uppercase font-bold tracking-widest">T-Minus</p>
          </div>
        </div>

        <div className="w-full bg-[#002c11]/[0.06] h-1.5 rounded-full mb-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#035925] to-[#0a8f3f] transition-all duration-1000"
            style={{ width: `${(timeLeft / 600) * 100}%` }}
          ></div>
        </div>

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
