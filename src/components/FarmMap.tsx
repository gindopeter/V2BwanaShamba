import { Zone } from '../lib/api';
import { Plus, Map as MapIcon } from 'lucide-react';
import ZoneCard from './ZoneCard';
import { getCropConfig } from './ZoneCard';

const TOTAL_FARM_ACRES = 5;

export default function FarmMap({ zones, onUpdate, onEdit, onAdd }: { zones: Zone[]; onUpdate: () => void; onEdit: (z: Zone) => void; onAdd: () => void }) {
  const activeAcres = zones.reduce((sum, z) => sum + z.area_size, 0);
  const inactiveAcres = Math.max(0, TOTAL_FARM_ACRES - activeAcres);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-[#002c11] flex items-center gap-2" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
          <MapIcon className="text-[#035925]" /> The Farm ({TOTAL_FARM_ACRES} Acres)
        </h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border-l-[3px] border-l-[#035925] shadow-sm">
          <span className="text-lg">🌱</span>
          <p className="text-[22px] font-black text-[#002c11] mt-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{zones.length}</p>
          <p className="text-[11px] font-bold text-[#002c11]/60">Active Zones</p>
          <p className="text-[10px] text-[#5d6c7b]">{activeAcres.toFixed(1)} acres</p>
        </div>
        <div className="bg-white rounded-xl p-4 border-l-[3px] border-l-[#5d6c7b] shadow-sm">
          <span className="text-lg">🏗️</span>
          <p className="text-[22px] font-black text-[#002c11] mt-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{inactiveAcres.toFixed(1)}</p>
          <p className="text-[11px] font-bold text-[#002c11]/60">Inactive Acres</p>
          <p className="text-[10px] text-[#5d6c7b]">Unallocated land</p>
        </div>
        <div className="bg-white rounded-xl p-4 border-l-[3px] border-l-[#fc8e44] shadow-sm">
          <span className="text-lg">📊</span>
          <p className="text-[22px] font-black text-[#002c11] mt-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{Math.round((activeAcres / TOTAL_FARM_ACRES) * 100)}%</p>
          <p className="text-[11px] font-bold text-[#002c11]/60">Utilization</p>
          <p className="text-[10px] text-[#5d6c7b]">{activeAcres.toFixed(1)} of {TOTAL_FARM_ACRES} acres</p>
        </div>
        <div className="bg-white rounded-xl p-4 border-l-[3px] border-l-blue-500 shadow-sm">
          <span className="text-lg">💧</span>
          <p className="text-[22px] font-black text-[#002c11] mt-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{zones.filter(z => z.irrigation_status === 'Running').length}</p>
          <p className="text-[11px] font-bold text-[#002c11]/60">Irrigating</p>
          <p className="text-[10px] text-[#5d6c7b]">of {zones.length} zones</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-[#002c11]/[0.04]">
        <h3 className="text-sm font-black text-[#002c11] mb-3" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Farm Allocation</h3>
        <div className="w-full h-8 bg-[#002c11]/[0.06] rounded-full overflow-hidden flex">
          {zones.map(z => {
            const pct = (z.area_size / TOTAL_FARM_ACRES) * 100;
            const { emoji } = getCropConfig(z.crop_type);
            return (
              <div
                key={z.id}
                className="h-full bg-gradient-to-r from-[#035925] to-[#0a8f3f] border-r border-white/50 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
                style={{ width: `${pct}%` }}
                title={`${z.name}: ${z.crop_type} (${z.area_size} acres)`}
              >
                {pct > 10 && <span>{emoji} {z.name}</span>}
              </div>
            );
          })}
          {inactiveAcres > 0 && (
            <div
              className="h-full bg-[#002c11]/[0.08] flex items-center justify-center text-[10px] font-bold text-[#5d6c7b]"
              style={{ width: `${(inactiveAcres / TOTAL_FARM_ACRES) * 100}%` }}
            >
              {(inactiveAcres / TOTAL_FARM_ACRES) * 100 > 10 && <span>Inactive</span>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          {zones.map(z => {
            const { emoji } = getCropConfig(z.crop_type);
            return (
              <div key={z.id} className="flex items-center gap-1.5 text-[10px] text-[#5d6c7b]">
                <div className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-[#035925] to-[#0a8f3f]"></div>
                <span className="font-bold">{emoji} {z.name}</span>
                <span>({z.area_size} ac)</span>
              </div>
            );
          })}
          {inactiveAcres > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-[#5d6c7b]">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#002c11]/[0.08]"></div>
              <span className="font-bold">Inactive</span>
              <span>({inactiveAcres.toFixed(1)} ac)</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>All Zones</h3>
        </div>

        <button
          onClick={onAdd}
          className="w-full h-12 mb-4 border-2 border-dashed border-[#035925]/20 rounded-xl text-sm font-bold text-[#035925]/60 hover:border-[#035925]/40 hover:text-[#035925] hover:bg-[#035925]/5 transition-all flex items-center justify-center gap-2"
          style={{ fontFamily: "'Instrument Sans', sans-serif" }}
        >
          <Plus className="w-4 h-4" /> Add New Zone
        </button>

        <div className="space-y-4">
          {zones.map(zone => (
            <ZoneCard key={zone.id} zone={zone} onUpdate={onUpdate} onEdit={onEdit} />
          ))}
        </div>

        {zones.length === 0 && (
          <div className="text-center py-12 text-[#5d6c7b]">
            <p className="text-lg font-bold mb-2">No zones yet</p>
            <p className="text-sm">Add your first farm zone to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
