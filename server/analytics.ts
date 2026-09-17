import { dbAll, dbGet, dbRun, isPostgres } from './db.ts';
import { log } from './observability.ts';

/**
 * First-party usage analytics.
 *
 * Google Analytics only sees what a browser chooses to report, and a data-saver
 * browser or a blocked script reports nothing — so the numbers the business runs
 * on are derived here, from the app's own tables.
 *
 * Most figures need no instrumentation at all: signups come from users.created_at,
 * chat volume from chat_messages, guest interest from guest_chat_logs. Only
 * "is this person still using the app" needs recording, which is what
 * users.last_login_at and the user_events table are for.
 */

/** Days of history the dashboard reports on. Bounds every query below. */
const WINDOW_DAYS = 30;

/**
 * A timestamp the active driver compares correctly against its own columns.
 * SQLite's CURRENT_TIMESTAMP writes 'YYYY-MM-DD HH:MM:SS' and compares
 * lexically, so an ISO string with its 'T' would sort wrongly there.
 */
function cutoff(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return isPostgres ? d.toISOString() : d.toISOString().slice(0, 19).replace('T', ' ');
}

/** pg returns COUNT() as a string (bigint); better-sqlite3 returns a number. */
function count(value: unknown): number {
  return Number(value ?? 0);
}

/** pg returns DATE() as a Date; better-sqlite3 returns 'YYYY-MM-DD'. */
function day(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? '').slice(0, 10);
}

/**
 * Records one thing a person did. Deliberately not awaited by callers and never
 * throws: analytics must not add latency to a farmer's request, and must never
 * be the reason one fails.
 */
export function recordEvent(
  userId: number | null,
  event: string,
  metadata?: Record<string, unknown>
): void {
  dbRun(
    'INSERT INTO user_events (user_id, event, metadata) VALUES (?, ?, ?)',
    userId,
    event,
    metadata ? JSON.stringify(metadata) : null
  ).catch((err: any) => {
    log('WARNING', `[analytics] could not record "${event}": ${err?.message || err}`);
  });
}

/** Stamps a successful sign-in. Same fire-and-forget contract as recordEvent. */
export function recordLogin(userId: number, method: string): void {
  dbRun(
    'UPDATE users SET last_login_at = CURRENT_TIMESTAMP, login_count = COALESCE(login_count, 0) + 1 WHERE id = ?',
    userId
  ).catch((err: any) => {
    log('WARNING', `[analytics] could not stamp login for user ${userId}: ${err?.message || err}`);
  });
  recordEvent(userId, 'login', { method });
}

/**
 * Everything the metrics dashboard shows, in one pass.
 *
 * Each query is bounded by WINDOW_DAYS or a small LIMIT — this runs against the
 * same 10-connection pool serving real traffic, and it is admin-only, so a few
 * callers at most.
 */
export async function collectMetrics() {
  const [
    totals,
    activity,
    loginCoverage,
    signupsByDay,
    regions,
    engagement,
    guests,
    eventCounts,
    firstEvent,
  ] = await Promise.all([
    dbGet(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN email_verified = 1 OR phone_verified = 1 THEN 1 ELSE 0 END) AS verified,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admins
      FROM users
    `),

    dbGet(
      `
      SELECT
        SUM(CASE WHEN last_login_at >= ? THEN 1 ELSE 0 END) AS day_1,
        SUM(CASE WHEN last_login_at >= ? THEN 1 ELSE 0 END) AS day_7,
        SUM(CASE WHEN last_login_at >= ? THEN 1 ELSE 0 END) AS day_30
      FROM users
    `,
      cutoff(1),
      cutoff(7),
      cutoff(30)
    ),

    // last_login_at is only populated from the deploy that introduced it, so the
    // dashboard must be able to say how much of the user base it can speak for.
    dbGet('SELECT COUNT(*) AS seen FROM users WHERE last_login_at IS NOT NULL'),

    dbAll(
      `
      SELECT DATE(created_at) AS d, COUNT(*) AS c
      FROM users
      WHERE created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `,
      cutoff(WINDOW_DAYS)
    ),

    dbAll(`
      SELECT COALESCE(NULLIF(region, ''), 'Not set') AS region, COUNT(*) AS c
      FROM users
      GROUP BY COALESCE(NULLIF(region, ''), 'Not set')
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `),

    dbGet(
      `
      SELECT
        (SELECT COUNT(*) FROM zones) AS zones,
        (SELECT COUNT(DISTINCT user_id) FROM zones WHERE user_id IS NOT NULL) AS users_with_zones,
        (SELECT COUNT(*) FROM tasks WHERE status = 'Completed') AS tasks_completed,
        (SELECT COUNT(*) FROM tasks WHERE created_at >= ?) AS tasks_recent,
        (SELECT COUNT(*) FROM chat_messages WHERE created_at >= ? AND role = 'user') AS chat_messages_recent
    `,
      cutoff(WINDOW_DAYS),
      cutoff(WINDOW_DAYS)
    ),

    // Anonymous visitors who used the chatbot without registering — the top of
    // the funnel, and the only pre-signup signal the app currently keeps.
    dbGet('SELECT COUNT(*) AS total FROM guest_chat_logs').catch(() => ({ total: 0 })),

    dbAll(
      `
      SELECT event, COUNT(*) AS c
      FROM user_events
      WHERE created_at >= ?
      GROUP BY event
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `,
      cutoff(WINDOW_DAYS)
    ),

    dbGet('SELECT MIN(created_at) AS started FROM user_events'),
  ]);

  const totalUsers = count(totals?.total);

  return {
    window_days: WINDOW_DAYS,
    generated_at: new Date().toISOString(),

    users: {
      total: totalUsers,
      active: count(totals?.active),
      deactivated: totalUsers - count(totals?.active),
      verified: count(totals?.verified),
      unverified: totalUsers - count(totals?.verified),
      admins: count(totals?.admins),
    },

    activity: {
      day_1: count(activity?.day_1),
      day_7: count(activity?.day_7),
      day_30: count(activity?.day_30),
      // How many users the activity figures can actually speak for. Until
      // everyone has signed in once since this shipped, they undercount.
      users_with_login_recorded: count(loginCoverage?.seen),
      tracking_since: firstEvent?.started
        ? new Date(firstEvent.started).toISOString()
        : null,
    },

    signups_by_day: (signupsByDay || []).map((r: any) => ({
      date: day(r.d),
      count: count(r.c),
    })),

    regions: (regions || []).map((r: any) => ({
      region: r.region,
      count: count(r.c),
    })),

    engagement: {
      zones: count(engagement?.zones),
      users_with_zones: count(engagement?.users_with_zones),
      tasks_completed: count(engagement?.tasks_completed),
      tasks_recent: count(engagement?.tasks_recent),
      chat_messages_recent: count(engagement?.chat_messages_recent),
    },

    funnel: {
      guest_chatters: count(guests?.total),
      registered: totalUsers,
      verified: count(totals?.verified),
      added_a_zone: count(engagement?.users_with_zones),
    },

    events: (eventCounts || []).map((r: any) => ({
      event: r.event,
      count: count(r.c),
    })),
  };
}

export type Metrics = Awaited<ReturnType<typeof collectMetrics>>;
