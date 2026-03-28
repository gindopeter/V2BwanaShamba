import { Zone, updateZoneYield } from '../lib/api';
import { TrendingUp, Scale } from 'lucide-react';
import { useState } from 'react';

export default function YieldCard({ zone, onUpdate }: { zone: Zone, onUpdate: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [actualYield, setActualYield] = useState(zone.actual_yield_kg || '');

  const handleSave = async () => {
    if (!actualYield) return;
    await updateZoneYield(zone.id, Number(actualYield));
    setIsEditing(false);
    onUpdate();
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#002c11]/5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-[#002c11] flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#035925]" />
          Yield Forecast
        </h3>
        <span className="text-xs font-medium px-2 py-1 bg-[#002c11]/5 text-[#5d6c7b] rounded-full">
          {zone.name}
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs text-[#5d6c7b] uppercase font-medium mb-1">Predicted Yield</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-[#002c11]">
              {(zone.expected_yield_kg / 1000).toFixed(1)}
            </span>
            <span className="text-sm text-[#5d6c7b]">tons</span>
          </div>
          <p className="text-xs text-[#035925] mt-1">
            Based on current weather & growth
          </p>
        </div>

        <div className="pt-4 border-t border-[#002c11]/5">
          <p className="text-xs text-[#5d6c7b] uppercase font-medium mb-2">Actual Harvest</p>
          
          {zone.status === 'Harvested' || zone.actual_yield_kg > 0 ? (
             <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-[#002c11]">
                  {(zone.actual_yield_kg / 1000).toFixed(1)}
                </span>
                <span className="text-sm text-[#5d6c7b]">tons</span>
                <span className="ml-auto text-xs bg-emerald-100 text-[#035925] px-2 py-1 rounded-full">
                    Recorded
                </span>
             </div>
          ) : isEditing ? (
            <div className="flex gap-2">
                <input 
                    type="number" 
                    value={actualYield}
                    onChange={(e) => setActualYield(e.target.value)}
                    placeholder="kg"
                    className="w-full rounded-lg border-[#002c11]/10 text-sm py-1"
                />
                <button 
                    onClick={handleSave}
                    className="px-3 py-1 bg-[#035925] text-white rounded-lg text-sm font-medium"
                >
                    Save
                </button>
            </div>
          ) : (
            <button 
                onClick={() => setIsEditing(true)}
                className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-[#5d6c7b] hover:border-emerald-500 hover:text-[#035925] transition-colors flex items-center justify-center gap-2"
            >
                <Scale className="w-4 h-4" />
                Record Harvest
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
