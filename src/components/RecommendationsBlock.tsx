import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { type Language, t } from '../lib/i18n';

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  icon: string;
  title: string;
  description: string;
}

const PRIORITY_STYLES = {
  high:   { bar: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200',   label: { en: 'Urgent', sw: 'Haraka' } },
  medium: { bar: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 border-amber-200', label: { en: 'Soon', sw: 'Hivi Karibuni' } },
  low:    { bar: 'bg-[#035925]',  badge: 'bg-green-50 text-green-700 border-green-200',  label: { en: 'Routine', sw: 'Kawaida' } },
};

export default function RecommendationsBlock({ lang = 'en' }: { lang?: Language }) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ language: lang }),
      });
      if (!res.ok) throw new Error('Failed to fetch recommendations');
      const data = await res.json();
      setRecommendations(data.recommendations || []);
      setLastFetched(new Date());
    } catch {
      setError(lang === 'sw' ? 'Imeshindwa kupata mapendekezo.' : 'Could not load recommendations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#002c11]/[0.04] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#002c11]/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#035925]/10 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-base">🌿</span>
          </div>
          <div>
            <h3 className="text-xs font-black text-[#002c11] uppercase tracking-[0.12em]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
              {t(lang, 'recommendations')}
            </h3>
            {lastFetched && (
              <p className="text-[10px] text-[#5d6c7b]/60 mt-0.5">
                {lang === 'sw' ? 'Imesasishwa' : 'Updated'} {lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={fetchRecommendations}
          disabled={loading}
          className="flex items-center gap-1.5 text-[11px] font-bold text-[#035925] hover:text-[#002c11] px-2.5 py-1.5 bg-[#035925]/5 hover:bg-[#035925]/10 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {t(lang, 'refreshRecommendations')}
        </button>
      </div>

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
          <div className="space-y-3">
            {recommendations.map((rec, i) => {
              const style = PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.low;
              return (
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-[#f9f6f1] border border-[#002c11]/[0.04]">
                  <div className={`w-1 rounded-full shrink-0 ${style.bar}`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{rec.icon}</span>
                        <p className="text-sm font-black text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                          {rec.title}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${style.badge}`}>
                        {style.label[lang]}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#5d6c7b] leading-relaxed">{rec.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
