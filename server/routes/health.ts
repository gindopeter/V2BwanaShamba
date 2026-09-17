import { Router } from 'express';
import { dbGet, isPostgres } from '../db.ts';
import { log } from '../observability.ts';

/**
 * Health endpoints.
 *
 * Until now /api/health answered `{status:'ok'}` unconditionally, so a dead
 * database still read as healthy and the uptime check stayed green while every
 * real request failed. It now actually queries the database.
 */

// Long enough to absorb a slow Neon round trip, short enough that a hung
// connection is reported as down rather than sitting on the request.
const DB_TIMEOUT_MS = 2000;

interface CheckResult {
  ok: boolean;
  latency_ms: number;
  error?: string;
}

async function pingDatabase(): Promise<CheckResult> {
  const start = Date.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      dbGet('SELECT 1 AS ok'),
      new Promise((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${DB_TIMEOUT_MS}ms`)),
          DB_TIMEOUT_MS
        );
      }),
    ]);
    return { ok: true, latency_ms: Date.now() - start };
  } catch (err: any) {
    return { ok: false, latency_ms: Date.now() - start, error: err?.message || 'unknown error' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const router = Router();

/**
 * GET /api/health/live — liveness.
 *
 * Checks nothing but that the process is running and the event loop responsive.
 * Suitable for a Cloud Run startup probe, where depending on the database would
 * mean a database blip restarts healthy containers.
 */
router.get('/live', (_req, res) => {
  res.json({ status: 'ok', uptime_s: Math.round(process.uptime()) });
});

/**
 * GET /api/health — readiness.
 *
 * The database is the one hard dependency: without it nothing in the app works,
 * so an unreachable database answers 503 and trips the uptime check.
 *
 * The healthy payload keeps `status` and `database` exactly as they were, so the
 * existing uptime check's `"status":"ok"` content match still passes.
 */
router.get('/', async (_req, res) => {
  const database = await pingDatabase();

  const body = {
    status: database.ok ? 'ok' : 'error',
    database: isPostgres ? 'postgresql' : 'sqlite',
    checks: { database },
    uptime_s: Math.round(process.uptime()),
    // Cloud Run sets K_REVISION, so hitting this endpoint tells you which
    // deploy is actually serving — the first thing worth knowing in an incident.
    revision: process.env.K_REVISION || null,
  };

  if (!database.ok) {
    log('ERROR', `[health] database unreachable: ${database.error}`, {
      latency_ms: database.latency_ms,
    });
    return res.status(503).json(body);
  }

  res.json(body);
});

export default router;
