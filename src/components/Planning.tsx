import { useState, useEffect } from 'react';
import { RefreshCw, CalendarDays, CheckCircle2, Clock, Circle } from 'lucide-react';
import { type Language } from '../lib/i18n';

// ─── types ────────────────────────────────────────────────────────────────────

interface Milestone {
  name: string;
  date: string;           // YYYY-MM-DD
  icon: string;
  status: 'completed' | 'current' | 'upcoming';
  actions: string[];
  completed: boolean;
}

interface ZonePlan {
  zone_id: number;
  zone_name: string;
  crop_type: string;
  planting_date: string;
  harvest_date: string;
  area_size: number;
  generated_at: string;
  milestones: Milestone[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysFromNow(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
}

const STATUS_CONFIG = {
  completed: {
    icon: <CheckCircle2 className="w-4 h-4 text-[#035925]" />,
    dot:  'bg-[#035925]',
    line: 'bg-[#035925]/30',
    row:  'opacity-60',
    badge: 'bg-green-50 text-green-700',
  },
  current: {
    icon: <Clock className="w-4 h-4 text-amber-500" />,
    dot:  'bg-amber-400 ring-4 ring-amber-100',
    line: 'bg-[#002c11]/10',
    row:  '',
    badge: 'bg-amber-50 text-amber-700',
  },
  upcoming: {
    icon: <Circle className="w-4 h-4 text-[#002c11]/20" />,
    dot:  'bg-[#002c11]/15',
    line: 'bg-[#002c11]/10',
    row:  '',
    badge: 'bg-gray-50 text-gray-500',
  },
};

// ─── main component ───────────────────────────────────────────────────────────

export default function Planning({ lang = 'en' }: { lang?: Language }) {
  const [plans,    setPlans]    = useState<ZonePlan[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [regenerating, setRegenerating] = useState<Partial<Record<number | 'all', boolean>>>({});

  async function fetchPlanning() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/planning?lang=${lang}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const fetched: ZonePlan[] = data.plans || [];
      setPlans(fetched);
      // Auto-expand the zone with a "current" milestone
      setExpanded(prev => {
        const next: Record<number, boolean> = { ...prev };
        fetched.forEach(p => {
          if (!(p.zone_id in next)) {
            next[p.zone_id] = p.milestones.some(m => m.status === 'current');
          }
        });
        if (Object.values(next).every(v => !v) && fetched.length > 0) {
          next[fetched[0].zone_id] = true;
        }
        return next;
      });
    } catch {
      setError(lang === 'sw'
        ? 'Imeshindwa kupata mpango wa kilimo.'
        : 'Could not load crop planning data.');
    } finally {
      setLoading(false);
    }
  }

  async function regeneratePlan(zoneId?: number) {
    const key = zoneId ?? 'all';
    setRegenerating(prev => ({ ...prev, [key]: true }));
    try {
      const body: Record<string, any> = { lang };
      if (zoneId) body.zone_id = zoneId;
      const res = await fetch('/api/planning/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Regenerate failed');
      await fetchPlanning();
    } catch {
      // silently ignore — fetchPlanning will show error state if needed
    } finally {
      setRegenerating(prev => ({ ...prev, [key]: false }));
    }
  }

  async function markMilestone(zoneId: number, idx: number, completed: boolean) {
    // Optimistic update
    setPlans(prev => prev.map(p => {
      if (p.zone_id !== zoneId) return p;
      const milestones = p.milestones.map((ms, i) =>
        i === idx ? { ...ms, completed, status: completed ? 'completed' as const : ms.status } : ms
      );
      return { ...p, milestones };
    }));

    try {
      const res = await fetch(`/api/planning/${zoneId}/milestone/${idx}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ completed }),
      });
      if (!res.ok) throw new Error('PATCH failed');
    } catch {
      // Rollback on error
      setPlans(prev => prev.map(p => {
        if (p.zone_id !== zoneId) return p;
        const milestones = p.milestones.map((ms, i) =>
          i === idx ? { ...ms, completed: !completed } : ms
        );
        return { ...p, milestones };
      }));
    }
  }

  useEffect(() => {
    fetchPlanning();
  }, [lang]);

  const toggleZone = (id: number) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-10">

      {/* Page header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
            📅 {lang === 'sw' ? 'Mipango ya Mazao' : 'Crop Planning'}
          </h2>
          <p className="text-xs text-[#5d6c7b] mt-0.5">
            {lang === 'sw'
              ? 'Hatua muhimu na vitendo kwa kila zao, hadi mavuno'
              : 'Key milestones and actions for each crop through to harvest'}
          </p>
        </div>
        <button
          onClick={() => regeneratePlan()}
          disabled={loading || !!regenerating['all']}
          className="flex items-center gap-1.5 text-[11px] font-bold text-[#035925] hover:text-white bg-[#035925]/10 hover:bg-[#035925] px-3 py-2 rounded-xl transition-all disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${regenerating['all'] ? 'animate-spin' : ''}`} />
          {lang === 'sw' ? 'Onyesha Upya Zote' : 'Regenerate All'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl p-10 flex flex-col items-center gap-3 shadow-sm border border-[#002c11]/[0.06]">
          <RefreshCw className="w-6 h-6 animate-spin text-[#035925]" />
          <p className="text-sm text-[#5d6c7b]">
            {lang === 'sw' ? 'BwanaShamba anachambua mazao yako...' : 'Loading your crop plans...'}
          </p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-[#002c11]/[0.06]">
          <p className="text-sm text-[#5d6c7b]">{error}</p>
          <button onClick={() => fetchPlanning()} className="mt-3 text-[12px] font-bold text-[#035925] underline">
            {lang === 'sw' ? 'Jaribu tena' : 'Try again'}
          </button>
        </div>
      )}

      {/* No zones */}
      {!loading && !error && plans.length === 0 && (
        <div className="bg-white rounded-xl p-10 text-center shadow-sm border border-[#002c11]/[0.06]">
          <CalendarDays className="w-8 h-8 text-[#002c11]/20 mx-auto mb-3" />
          <p className="text-sm text-[#5d6c7b]">
            {lang === 'sw'
              ? 'Hakuna mipango iliyohifadhiwa. Ongeza eneo ili mipango yako itayarishwe.'
              : 'No crop plans yet. Add a zone — plans are generated automatically.'}
          </p>
        </div>
      )}

      {/* Zone cards */}
      {!loading && !error && plans.map(plan => {
        const isOpen      = !!expanded[plan.zone_id];
        const currentMs   = plan.milestones.find(m => m.status === 'current');
        const completedN  = plan.milestones.filter(m => m.status === 'completed' || m.completed).length;
        const totalN      = plan.milestones.length;
        const progressPct = totalN > 0 ? Math.round((completedN / totalN) * 100) : 0;
        const daysLeft    = plan.harvest_date ? daysFromNow(plan.harvest_date) : null;
        const isRegenerating = !!regenerating[plan.zone_id];

        return (
          <div key={plan.zone_id} className="bg-white rounded-xl shadow-sm border border-[#002c11]/[0.06] overflow-hidden">

            {/* ── Zone header (always visible) ─────────────────── */}
            <div className="flex items-center gap-2 px-5 py-4 hover:bg-[#f9f6f1]/60 transition-colors">
              <button
                onClick={() => toggleZone(plan.zone_id)}
                className="flex items-center gap-4 flex-1 text-left min-w-0"
              >
                {/* Crop emoji + name */}
                <div className="shrink-0 w-10 h-10 rounded-xl bg-[#035925]/10 flex items-center justify-center">
                  <span className="text-xl">🌿</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-[#002c11] text-sm" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                      {plan.zone_name}
                    </p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#035925]/10 text-[#035925]">
                      {plan.crop_type}
                    </span>
                    {currentMs && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                        ⏳ {currentMs.name}
                      </span>
                    )}
                  </div>

                  {/* Mini progress bar */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 bg-[#002c11]/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#035925] to-[#0a8f3f] transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-[#5d6c7b] shrink-0">
                      {completedN}/{totalN} {lang === 'sw' ? 'hatua' : 'milestones'}
                    </span>
                  </div>
                </div>

                {/* Dates + days left */}
                <div className="text-right shrink-0 hidden sm:block">
                  {daysLeft !== null && daysLeft >= 0 ? (
                    <>
                      <p className="text-[13px] font-black text-[#002c11]">{daysLeft}d</p>
                      <p className="text-[10px] text-[#5d6c7b]">{lang === 'sw' ? 'hadi mavuno' : 'to harvest'}</p>
                    </>
                  ) : (
                    <p className="text-[10px] text-[#5d6c7b]">{fmtDate(plan.harvest_date)}</p>
                  )}
                </div>

                {/* Chevron */}
                <span className={`shrink-0 text-[#5d6c7b] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>

              {/* Days left (mobile only) + Regenerate button — stacked vertically */}
              <div className="flex flex-col items-center gap-1 shrink-0 ml-1">
                {/* Days to harvest — shown above regen icon on mobile, hidden on sm+ (shown inline in header) */}
                <div className="sm:hidden text-center leading-none">
                  {daysLeft !== null && daysLeft >= 0 ? (
                    <>
                      <p className="text-[12px] font-black text-[#002c11]">{daysLeft}d</p>
                      <p className="text-[9px] text-[#5d6c7b]">{lang === 'sw' ? 'mavuno' : 'harvest'}</p>
                    </>
                  ) : daysLeft !== null && daysLeft < 0 ? (
                    <p className="text-[9px] font-bold text-amber-600">{lang === 'sw' ? 'Imevunwa' : 'Harvested'}</p>
                  ) : null}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); regeneratePlan(plan.zone_id); }}
                  disabled={isRegenerating}
                  title={lang === 'sw' ? 'Onyesha Upya' : 'Regenerate plan'}
                  className="flex items-center gap-1 text-[10px] font-bold text-[#035925] hover:text-white bg-[#035925]/10 hover:bg-[#035925] px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{lang === 'sw' ? 'Upya' : 'Regen'}</span>
                </button>
              </div>
            </div>

            {/* ── Milestone table (expanded) ────────────────────── */}
            {isOpen && (
              <div className="border-t border-[#002c11]/[0.05]">

                {/* Date range + generated_at sub-header */}
                <div className="px-5 py-2.5 bg-[#f9f6f1] flex flex-wrap gap-x-4 gap-y-1">
                  <span className="text-[11px] text-[#5d6c7b]">
                    🌱 {lang === 'sw' ? 'Kupanda' : 'Planted'}: <strong className="text-[#002c11]">{fmtDate(plan.planting_date)}</strong>
                  </span>
                  <span className="text-[11px] text-[#5d6c7b]">
                    🌾 {lang === 'sw' ? 'Mavuno' : 'Harvest'}: <strong className="text-[#002c11]">{fmtDate(plan.harvest_date)}</strong>
                  </span>
                  <span className="text-[11px] text-[#5d6c7b]">
                    📐 {plan.area_size} {lang === 'sw' ? 'ekari' : 'acres'}
                  </span>
                  {plan.generated_at && (
                    <span className="text-[10px] text-[#5d6c7b]/60 ml-auto">
                      {lang === 'sw' ? 'Imetayarishwa' : 'Generated'}{' '}
                      {new Date(plan.generated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {/* Timeline table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#002c11]/[0.05]">
                        <th className="text-left px-5 py-2.5 text-[10px] font-bold text-[#002c11]/50 uppercase tracking-wider w-[180px]">
                          {lang === 'sw' ? 'Hatua' : 'Milestone'}
                        </th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-bold text-[#002c11]/50 uppercase tracking-wider w-[110px]">
                          {lang === 'sw' ? 'Tarehe' : 'Date'}
                        </th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-bold text-[#002c11]/50 uppercase tracking-wider">
                          {lang === 'sw' ? 'Vitendo Muhimu' : 'Key Actions'}
                        </th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-bold text-[#002c11]/50 uppercase tracking-wider w-[110px]">
                          {lang === 'sw' ? 'Hali' : 'Status'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.milestones.map((ms, idx) => {
                        const cfg = STATUS_CONFIG[ms.status] || STATUS_CONFIG.upcoming;
                        const isLast = idx === plan.milestones.length - 1;
                        const canMark = ms.status !== 'completed' && !ms.completed;

                        return (
                          <tr
                            key={idx}
                            className={`border-b border-[#002c11]/[0.03] transition-colors
                              ${ms.status === 'current' ? 'bg-amber-50/50' : idx % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}
                              ${cfg.row}`}
                          >
                            {/* Milestone name with vertical timeline dot */}
                            <td className="px-5 py-3">
                              <div className="flex items-start gap-2.5">
                                {/* Timeline column */}
                                <div className="flex flex-col items-center shrink-0 pt-0.5">
                                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                                  {!isLast && <div className={`w-0.5 flex-1 mt-1 min-h-[16px] ${cfg.line}`} />}
                                </div>
                                <div>
                                  <span className="mr-1.5">{ms.icon}</span>
                                  <span className={`text-[12px] font-bold ${ms.status === 'current' ? 'text-amber-800' : ms.status === 'completed' ? 'text-[#002c11]/60' : 'text-[#002c11]'}`}
                                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                                    {ms.name}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Date */}
                            <td className="px-3 py-3 text-[11px] text-[#5d6c7b] whitespace-nowrap align-top">
                              {fmtDate(ms.date)}
                            </td>

                            {/* Actions */}
                            <td className="px-3 py-3 align-top">
                              <ul className="space-y-1">
                                {ms.actions.map((action, ai) => (
                                  <li key={ai} className="flex items-start gap-1.5 text-[11px] text-[#5d6c7b]">
                                    <span className="shrink-0 mt-0.5 text-[#035925]">▸</span>
                                    {action}
                                  </li>
                                ))}
                              </ul>
                            </td>

                            {/* Status badge + mark complete button */}
                            <td className="px-3 py-3 align-top">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                                  {ms.status === 'completed'
                                    ? (lang === 'sw' ? 'Imekamilika' : 'Done')
                                    : ms.status === 'current'
                                    ? (lang === 'sw' ? 'Sasa Hivi' : 'Now')
                                    : (lang === 'sw' ? 'Ijayo' : 'Upcoming')}
                                </span>
                                {canMark && (
                                  <button
                                    onClick={() => markMilestone(plan.zone_id, idx, true)}
                                    title={lang === 'sw' ? 'Andika kama imekamilika' : 'Mark as complete'}
                                    className="shrink-0 w-5 h-5 rounded-full border border-[#035925]/30 hover:border-[#035925] hover:bg-[#035925]/10 flex items-center justify-center transition-all"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#035925]/50 hover:text-[#035925]" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
