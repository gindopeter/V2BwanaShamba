import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { fetchMetrics, type Metrics } from '../lib/api';

/**
 * Admin-only usage dashboard.
 *
 * Charts are hand-drawn rather than pulled from a charting library: a few bars
 * do not justify shipping ~100KB of JavaScript to farmers on mobile data.
 */

const CARD = 'bg-white border border-[#002c11]/10 rounded-2xl shadow-sm';

export default function MetricsSection() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setMetrics(await fetchMetrics());
    } catch (err: any) {
      setError(err?.message || 'Could not load metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading && !metrics) {
    return (
      <div className={`${CARD} p-6 text-sm text-[#5d6c7b]`}>Loading metrics…</div>
    );
  }

  if (error) {
    return (
      <div className={`${CARD} p-6 flex items-start gap-3`}>
        <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-[#002c11]">Could not load metrics</p>
          <p className="text-sm text-[#5d6c7b] mt-1">{error}</p>
          <button
            onClick={load}
            className="mt-3 text-sm font-medium text-[#035925] hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const { users, activity, signups_by_day, regions, engagement, funnel, events } = metrics;

  // Activity is derived from last_login_at, which only started being written
  // when this shipped. Saying so is the difference between a low number meaning
  // "few people came back" and "we have not been counting long enough".
  const coverage = users.total > 0
    ? Math.round((activity.users_with_login_recorded / users.total) * 100)
    : 0;

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-[#002c11]">Usage</h2>
          <p className="text-sm text-[#5d6c7b]">
            Last {metrics.window_days} days · updated {new Date(metrics.generated_at).toLocaleString()}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-sm font-medium text-[#5d6c7b] hover:text-[#002c11] disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {coverage < 100 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertCircle size={17} className="text-amber-700 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">
            Sign-in tracking started recently, so the active-user figures below only
            cover the{' '}
            <strong>{activity.users_with_login_recorded} of {users.total} accounts</strong>{' '}
            ({coverage}%) that have signed in since. They will undercount until
            everyone has been back at least once. Signups, regions and totals are
            complete — those come from data the app already kept.
          </p>
        </div>
      )}

      {/* ── Headline numbers ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Registered" value={users.total} note={`${users.verified} verified`} />
        <Stat label="Active today" value={activity.day_1} note="signed in today" />
        <Stat label="Active this week" value={activity.day_7} note="last 7 days" />
        <Stat label="Active this month" value={activity.day_30} note="last 30 days" />
      </div>

      {/* ── Signups ──────────────────────────────────────────────── */}
      <div className={`${CARD} p-6`}>
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
          <h3 className="font-semibold text-[#002c11]">New signups</h3>
          <span className="text-xs text-[#5d6c7b]">
            {signups_by_day.reduce((sum, d) => sum + d.count, 0)} in the last {metrics.window_days} days
          </span>
        </div>
        <SignupChart data={signups_by_day} />
      </div>

      {/* ── Funnel + regions ─────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-3">
        <div className={`${CARD} p-6`}>
          <h3 className="font-semibold text-[#002c11] mb-1">From visitor to farmer</h3>
          <p className="text-xs text-[#5d6c7b] mb-4">Where people stop on the way in</p>
          <Funnel
            steps={[
              { label: 'Used the chatbot as a guest', value: funnel.guest_chatters },
              { label: 'Created an account', value: funnel.registered },
              { label: 'Verified email or phone', value: funnel.verified },
              { label: 'Added their first zone', value: funnel.added_a_zone },
            ]}
          />
        </div>

        <div className={`${CARD} p-6`}>
          <h3 className="font-semibold text-[#002c11] mb-1">Where they farm</h3>
          <p className="text-xs text-[#5d6c7b] mb-4">Registered users by region</p>
          {regions.length === 0 ? (
            <p className="text-sm text-[#5d6c7b]">No regions recorded yet.</p>
          ) : (
            <div className="space-y-2.5">
              {regions.map(r => (
                <Bar
                  key={r.region}
                  label={r.region}
                  value={r.count}
                  max={regions[0].count}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Engagement + events ──────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-3">
        <div className={`${CARD} p-6`}>
          <h3 className="font-semibold text-[#002c11] mb-4">What the app is being used for</h3>
          <dl className="space-y-3">
            <Row label="Zones created" value={engagement.zones} />
            <Row label="Farmers with at least one zone" value={engagement.users_with_zones} />
            <Row label="Tasks completed (all time)" value={engagement.tasks_completed} />
            <Row label={`Tasks created (${metrics.window_days}d)`} value={engagement.tasks_recent} />
            <Row label={`Chat questions asked (${metrics.window_days}d)`} value={engagement.chat_messages_recent} />
          </dl>
        </div>

        <div className={`${CARD} p-6`}>
          <h3 className="font-semibold text-[#002c11] mb-1">Recorded activity</h3>
          <p className="text-xs text-[#5d6c7b] mb-4">
            Events in the last {metrics.window_days} days
          </p>
          {events.length === 0 ? (
            <p className="text-sm text-[#5d6c7b]">
              Nothing recorded yet. Events appear here as people sign in and register.
            </p>
          ) : (
            <dl className="space-y-3">
              {events.map(e => (
                <Row key={e.event} label={e.event.replace(/_/g, ' ')} value={e.count} capitalize />
              ))}
            </dl>
          )}
        </div>
      </div>

      {/* ── Account health ───────────────────────────────────────── */}
      <div className={`${CARD} p-6`}>
        <h3 className="font-semibold text-[#002c11] mb-4">Accounts</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat small label="Verified" value={users.verified} />
          <Stat small label="Unverified" value={users.unverified} />
          <Stat small label="Deactivated" value={users.deactivated} />
          <Stat small label="Administrators" value={users.admins} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, note, small }: { label: string; value: number; note?: string; small?: boolean }) {
  return (
    <div className={small ? '' : `${CARD} p-5`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-[#5d6c7b]">{label}</div>
      <div className={`${small ? 'text-2xl' : 'text-3xl'} font-bold text-[#002c11] tabular-nums mt-1`}>
        {value.toLocaleString()}
      </div>
      {note && <div className="text-xs text-[#5d6c7b] mt-0.5">{note}</div>}
    </div>
  );
}

/** `capitalize` is for raw event names ("login"); written labels keep their own case. */
function Row({ label, value, capitalize }: { label: string; value: number; capitalize?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`text-sm text-[#5d6c7b] ${capitalize ? 'first-letter:uppercase' : ''}`}>{label}</dt>
      <dd className="text-sm font-semibold text-[#002c11] tabular-nums">{value.toLocaleString()}</dd>
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="grid grid-cols-[minmax(80px,110px)_1fr_auto] items-center gap-3">
      <span className="text-sm text-[#002c11] truncate" title={label}>{label}</span>
      <span className="h-3.5 bg-[#002c11]/5 rounded overflow-hidden">
        <span className="block h-full bg-[#035925] rounded" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-sm text-[#5d6c7b] tabular-nums w-10 text-right">{value}</span>
    </div>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(steps[0]?.value ?? 0, 1);
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const drop = prev && prev > 0 ? Math.round(((prev - s.value) / prev) * 100) : null;
        return (
          <div key={s.label}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-sm text-[#002c11]">{s.label}</span>
              <span className="text-sm font-semibold text-[#002c11] tabular-nums">
                {s.value.toLocaleString()}
              </span>
            </div>
            <div className="h-5 bg-[#002c11]/5 rounded overflow-hidden">
              <div
                className="h-full bg-[#035925] rounded"
                style={{ width: `${Math.min((s.value / top) * 100, 100)}%` }}
              />
            </div>
            {drop !== null && drop > 0 && (
              <div className="text-xs text-red-700 mt-1">−{drop}% from the step above</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SignupChart({ data }: { data: { date: string; count: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-[#5d6c7b]">No signups in this period.</p>;
  }

  const max = Math.max(...data.map(d => d.count), 1);

  return (
    <div>
      <div className="flex items-end gap-1 h-32">
        {data.map(d => (
          <div
            key={d.date}
            className="flex-1 min-w-[3px] bg-[#035925] rounded-t hover:bg-[#002c11] transition-colors"
            style={{ height: `${Math.max((d.count / max) * 100, 2)}%` }}
            title={`${d.date} — ${d.count} signup${d.count === 1 ? '' : 's'}`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-[#5d6c7b]">
        <span>{data[0].date}</span>
        <span>peak {max}/day</span>
        <span>{data[data.length - 1].date}</span>
      </div>
    </div>
  );
}
