import React from 'react';
import { Droplets, Map as MapIcon } from 'lucide-react';

export default function FarmMap() {
  const zones = [
    { id: 'A', name: 'Acre 1', crop: 'Tomatoes', moisture: 42, status: 'dry' },
    { id: 'B', name: 'Acre 2', crop: 'Tomatoes', moisture: 68, status: 'optimal' },
    { id: 'C', name: 'Acre 3', crop: 'Onions', moisture: 85, status: 'wet' },
    { id: 'D', name: 'Acre 4', crop: 'Onions', moisture: 75, status: 'optimal' },
    { id: 'E', name: 'Acre 5', crop: 'Fallow', moisture: 30, status: 'dry' },
  ];

  const getColor = (status: string) => {
    switch(status) {
      case 'dry': return 'bg-amber-500/20 border-amber-500/50 text-amber-700';
      case 'optimal': return 'bg-[#035925]/10 border-[#035925]/40 text-[#035925]';
      case 'wet': return 'bg-blue-500/20 border-blue-500/50 text-blue-700';
      default: return 'bg-[#f9f6f1] border-[#002c11]/10 text-[#5d6c7b]';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-[#002c11] flex items-center gap-2" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
          <MapIcon className="text-[#035925]" /> Farm Map (5 Acres)
        </h2>
        <div className="flex gap-4 text-xs font-bold text-[#002c11]/60">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-amber-500/50 rounded-sm"></div> Dry</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#035925]/50 rounded-sm"></div> Optimal</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-500/50 rounded-sm"></div> Wet</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {zones.map(zone => (
          <div key={zone.id} className={`p-6 rounded-xl border-2 ${getColor(zone.status)} transition-all hover:scale-[1.02] cursor-pointer`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-black" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Zone {zone.id}</h3>
                <p className="text-sm opacity-80">{zone.name} · {zone.crop}</p>
              </div>
              <Droplets className="w-6 h-6 opacity-70" />
            </div>
            
            <div className="mt-8">
              <div className="flex justify-between text-sm mb-1 opacity-80">
                <span>Soil Moisture</span>
                <span className="font-bold">{zone.moisture}%</span>
              </div>
              <div className="w-full bg-[#002c11]/10 h-2.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${zone.status === 'dry' ? 'bg-amber-500' : zone.status === 'optimal' ? 'bg-[#035925]' : 'bg-blue-500'}`}
                  style={{ width: `${zone.moisture}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
