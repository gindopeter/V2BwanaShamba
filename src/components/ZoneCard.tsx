import { Zone, toggleIrrigation } from '../lib/api';
import { Sprout, Droplets, AlertTriangle, Calendar, Play, Square } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState } from 'react';

export default function ZoneCard({ zone, onUpdate }: { zone: Zone, onUpdate: () => void }) {
  const isTomato = zone.crop_type === 'Tomato';
  const isOnion = zone.crop_type === 'Onion';
  const [loading, setLoading] = useState(false);

  let stage = 'Vegetative';
  if (isTomato) {
    if (zone.current_growth_day > 40) stage = 'Flowering';
    if (zone.current_growth_day > 70) stage = 'Fruiting';
    if (zone.current_growth_day > 100) stage = 'Harvest';
  } else if (isOnion) {
    if (zone.current_growth_day > 60) stage = 'Bulb Formation';
    if (zone.current_growth_day > 100) stage = 'Maturation';
  }

  const handleIrrigationToggle = async () => {
    setLoading(true);
    try {
      const newStatus = zone.irrigation_status === 'Running' ? 'Off' : 'Running';
      await toggleIrrigation(zone.id, newStatus);
      onUpdate();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all h-full flex flex-col justify-between">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Sprout className="w-24 h-24 text-indigo-500" />
      </div>

      <div className="flex items-start justify-between mb-4 relative z-10">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{zone.name}</h3>
          <span className="text-sm text-slate-500 font-medium">{zone.area_size} Acres • {zone.crop_type}</span>
        </div>
        <div className="flex gap-2">
            <span className={cn(
            "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
            zone.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"
            )}>
            {zone.status}
            </span>
        </div>
      </div>

      <div className="space-y-4 relative z-10">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500 font-medium">Growth Stage</span>
            <span className="font-bold text-slate-900">{stage}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 rounded-full" 
              style={{ width: `${Math.min((zone.current_growth_day / (zone.crop_type === 'Tomato' ? 120 : 150)) * 100, 100)}%` }} 
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1 font-medium">
            <span>Day {zone.current_growth_day}</span>
            <span>Est. Harvest: {new Date(zone.expected_harvest_date).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Next Fertigation</p>
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    {zone.next_fertigation_date ? new Date(zone.next_fertigation_date).toLocaleDateString() : 'None'}
                </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Est. Yield</p>
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <Sprout className="w-3.5 h-3.5 text-indigo-500" />
                    {(zone.expected_yield_kg / 1000).toFixed(1)} tons
                </div>
            </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2 pt-2">
          <button 
            onClick={handleIrrigationToggle}
            disabled={loading}
            className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold tracking-wider transition-all active:scale-95 shadow-sm",
                zone.irrigation_status === 'Running' 
                    ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
            )}
          >
            {loading ? (
                <span className="animate-pulse">Processing...</span>
            ) : zone.irrigation_status === 'Running' ? (
                <>
                    <Square className="w-4 h-4 fill-current" />
                    STOP IRRIGATION
                </>
            ) : (
                <>
                    <Play className="w-4 h-4 fill-current" />
                    START IRRIGATION
                </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
