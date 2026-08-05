import { Zone } from '../lib/api';
import { Plus } from 'lucide-react';
import ZoneCard from './ZoneCard';
import { getCropEmoji } from '../lib/crops';

// Ochre — the single accent the stat row spends, kept off the brand green so a
// filled meter never reads as "another green thing on a green dashboard".
const ACCENT = '#8f5b0f';

// Big totals get compacted so a five-figure yield can't overflow a narrow tile.
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
}

// Label above the value, no icon, no coloured edge. The only colour in the row is
// the optional meter, which carries the ratio it sits under.
function StatTile({ label, value, sub, meter }: { label: string; value: string | number; sub: string; meter?: number }) {
  return (
    <div className="rounded-2xl p-4 bg-[#fffdf8] border border-[#002c11]/[0.08]">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#7a7060]">{label}</p>
      <p
        className="text-[30px] font-black text-[#002c11] leading-none mt-2"
        style={{ fontFamily: "'Instrument Sans', sans-serif", letterSpacing: '-0.03em' }}
      >
        {value}
      </p>
      {meter !== undefined && (
        <div className="mt-2.5 h-1.5 w-full rounded-full overflow-hidden" style={{ background: `${ACCENT}1f` }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, meter)}%`, background: ACCENT }} />
        </div>
      )}
      <p className="text-[11px] text-[#7a7060] mt-2">{sub}</p>
    </div>
  );
}

export default function FarmMap({ zones, onUpdate, onEdit, onAdd, farmSizeAcres, lang }: { zones: Zone[]; onUpdate: () => void; onEdit: (z: Zone) => void; onAdd: () => void; farmSizeAcres?: number | null; lang?: string }) {
  const activeAcres = zones.reduce((sum, z) => sum + z.area_size, 0);
  const totalAcres = (farmSizeAcres && farmSizeAcres > 0) ? farmSizeAcres : Math.max(activeAcres, 1);
  const inactiveAcres = Math.max(0, totalAcres - activeAcres);
  const acresLabel = lang === 'sw' ? 'Ekari' : 'Acres';
  const utilizationPct = Math.round((activeAcres / totalAcres) * 100);
  const totalYieldKg = zones.reduce((sum, z) => sum + (z.expected_yield_kg || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-[#002c11] flex items-center gap-2" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
          The Farm ({totalAcres} {acresLabel})
        </h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Active zones" value={zones.length} sub={`${activeAcres.toFixed(1)} ${acresLabel.toLowerCase()} planted`} />
        <StatTile label="Inactive acres" value={inactiveAcres.toFixed(1)} sub="Unallocated land" />
        <StatTile label="Utilization" value={`${utilizationPct}%`} sub={`${activeAcres.toFixed(1)} of ${totalAcres} ${acresLabel.toLowerCase()}`} meter={utilizationPct} />
        <StatTile label="Expected yield" value={compact(totalYieldKg)} sub="kg across all zones" />
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-[#002c11]/[0.04]">
        <h3 className="text-sm font-black text-[#002c11] mb-3" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Farm Allocation</h3>
        <div className="w-full h-8 bg-[#002c11]/[0.06] rounded-full overflow-hidden flex">
          {zones.map(z => {
            const pct = (z.area_size / totalAcres) * 100;
            const emoji = getCropEmoji(z.crop_type);
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
              style={{ width: `${(inactiveAcres / totalAcres) * 100}%` }}
            >
              {(inactiveAcres / totalAcres) * 100 > 10 && <span>Inactive</span>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          {zones.map(z => {
            const emoji = getCropEmoji(z.crop_type);
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
