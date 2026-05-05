import { useState, useEffect } from 'react';
import { RefreshCw, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { type Language, t } from '../lib/i18n';

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  icon: string;
  title: string;
  description: string;
}

interface CacheEntry {
  recommendations: Recommendation[];
  fetchedAt: number;   // Unix ms
  lang: Language;
}

const CACHE_KEY    = 'bwana_recommendations_cache';
const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

const PRIORITY_STYLES = {
  high:   { bar: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200',       label: { en: 'Urgent',  sw: 'Haraka' } },
  medium: { bar: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 border-amber-200', label: { en: 'Soon',    sw: 'Hivi Karibuni' } },
  low:    { bar: 'bg-[#035925]',  badge: 'bg-green-50 text-green-700 border-green-200', label: { en: 'Routine', sw: 'Kawaida' } },
};

function loadCache(lang: Language): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    const age = Date.now() - entry.fetchedAt;
    if (entry.lang !== lang || age > CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

function saveCache(recommendations: Recommendation[], lang: Language) {
  try {
    const entry: CacheEntry = { recommendations, fetchedAt: Date.now(), lang };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch { /* storage full or unavailable */ }
}

function timeAgo(ms: number, lang: Language) {
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1)  return lang === 'sw' ? 'Sasa hivi' : 'Just now';
  if (mins < 60) return lang === 'sw' ? `Dakika ${mins} zilizopita` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return lang === 'sw' ? `Saa ${hrs} zilizopita` : `${hrs}h ago`;
}

export default function RecommendationsBlock({
  lang = 'en',
  onLearnMore,
}: {
  lang?: Language;
  onLearnMore?: (message: string) => void;
}) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');
  const [fetchedAt,       setFetchedAt]       = useState<number | null>(null);
  const [expandedIdx,     setExpandedIdx]     = useState<number | null>(null);

  const fetchRecommendations = async (forceRefresh = false) => {
    // Use cache if available and not forcing a refresh
    if (!forceRefresh) {
      const cached = loadCache(lang);
      if (cached) {
        setRecommendations(cached.recommendations);
        setFetchedAt(cached.fetchedAt);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError('');
    setExpandedIdx(null);
    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ language: lang }),
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const recs: Recommendation[] = data.recommendations || [];
      setRecommendations(recs);
      const now = Date.now();
      setFetchedAt(now);
      saveCache(recs, lang);
    } catch {
      setError(lang === 'sw' ? 'Imeshindwa kupata mapendekezo.' : 'Could not load recommendations.');
    } finally {
      setLoading(false);
    }
  };

  // On mount or lang change: load from cache first, fetch only if stale
  useEffect(() => {
    setLoading(true);
    fetchRecommendations(false);
  }, [lang]);

  const toggle = (idx: number) => setExpandedIdx(prev => prev === idx ? null : idx);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#002c11]/[0.04] overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#002c11]/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#035925]/10 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-base">🌿</span>
          </div>
          <div>
            <h3 className="text-xs font-black text-[#002c11] uppercase tracking-[0.12em]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
              {t(lang, 'recommendations')}
            </h3>
            {fetchedAt && (
              <p className="text-[10px] text-[#5d6c7b]/60 mt-0.5">
                {lang === 'sw' ? 'Imesasishwa' : 'Updated'} {timeAgo(fetchedAt, lang)}
                {' · '}{lang === 'sw' ? 'Inasasishwa kila masaa 3' : 'Refreshes every 3 h'}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => fetchRecommendations(true)}
          disabled={loading}
          className="flex items-center gap-1.5 text-[11px] font-bold text-[#035925] hover:text-[#002c11] px-2.5 py-1.5 bg-[#035925]/5 hover:bg-[#035925]/10 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {t(lang, 'refreshRecommendations')}
        </button>
      </div>

      {/* Body */}
      <div className="p-5">
        {loading && (
          <div className="flex items-center gap-3 py-6 justify-center text-[#5d6c7b]">
            <RefreshCw className="w-4 h-4 animate-spin text-[#035925]" />
            <span className="text-sm">{t(lang, 'loadingRecommendations')}</span>
          </div>
        )}

        {!loading && error && (
          <p className="text-sm text-[#5d6c7b] text-center py-4">{error}</p>
        )}

        {!loading && !error && recommendations.length === 0 && (
          <p className="text-sm text-[#5d6c7b] text-center py-4">
            {lang === 'sw' ? 'Hakuna mapendekezo kwa sasa.' : 'No recommendations at this time.'}
          </p>
        )}

        {!loading && !error && recommendations.length > 0 && (
          <div className="space-y-2">
            {recommendations.map((rec, i) => {
              const style    = PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.low;
              const dashIdx  = rec.title.indexOf(' – ');
              const zoneTag  = dashIdx !== -1 ? rec.title.slice(0, dashIdx) : null;
              const action   = dashIdx !== -1 ? rec.title.slice(dashIdx + 3) : rec.title;
              const open     = expandedIdx === i;

              return (
                <div
                  key={i}
                  className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                    open
                      ? 'bg-white border-[#035925]/20 shadow-sm'
                      : 'bg-[#f9f6f1] border-[#002c11]/[0.04] hover:border-[#002c11]/10'
                  }`}
                >
                  {/* ── Heading row (always visible) ───────────────────── */}
                  <button
                    onClick={() => toggle(i)}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left"
                  >
                    {/* priority bar */}
                    <div className={`w-1 self-stretch rounded-full shrink-0 ${style.bar}`} />

                    {/* icon */}
                    <span className="text-base leading-none shrink-0">{rec.icon}</span>

                    {/* title */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {zoneTag && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#035925]/10 text-[#035925] shrink-0">
                            {zoneTag}
                          </span>
                        )}
                        <p className="text-[13px] font-black text-[#002c11] leading-snug" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                          {action}
                        </p>
                      </div>
                    </div>

                    {/* priority badge */}
                    <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${style.badge}`}>
                      {style.label[lang]}
                    </span>

                    {/* chevron */}
                    <span className="shrink-0 text-[#5d6c7b]">
                      {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>

                  {/* ── Detail (expanded only) ───────────────────────────── */}
                  {open && (
                    <div className="px-4 pb-4 pt-1 border-t border-[#002c11]/[0.05]">
                      <p className="text-[12px] text-[#5d6c7b] leading-relaxed mb-3">{rec.description}</p>
                      {onLearnMore && (
                        <button
                          onClick={() => {
                            const msg = lang === 'sw'
                              ? `Niambie zaidi kuhusu mapendekezo haya: ${rec.title} — ${rec.description}`
                              : `Tell me more about this recommendation: ${rec.title} — ${rec.description}`;
                            onLearnMore(msg);
                          }}
                          className="flex items-center gap-1.5 text-[11px] font-bold text-[#035925] hover:text-white bg-[#035925]/10 hover:bg-[#035925] px-3 py-1.5 rounded-lg transition-all"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          {lang === 'sw' ? 'Uliza BwanaShamba' : 'Ask BwanaShamba'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
