/**
 * Internal agent API.
 *
 * The Python ADK tools call these endpoints instead of opening their own
 * database. That keeps agent reads and writes on the same database the app
 * reads from (Postgres in production), and routes them through the same
 * per-user ownership checks the browser-facing routes use.
 *
 * Auth: the shared ADK_INTERNAL_TOKEN as a bearer token, plus an x-user-id
 * header naming the farmer the agent is acting for. No browser session is
 * involved, so every handler scopes on that id explicitly.
 */
import { Router } from 'express';
import { dbGet } from '../db.ts';
import { isValidInternalToken } from '../services/internalAuth.ts';
import {
  FarmDataError,
  createTask,
  getFarmSummary,
  getZone,
  listLogs,
  listTasks,
  listZoneLogs,
  listZones,
} from '../services/farmData.ts';

const router = Router();

declare global {
  namespace Express {
    interface Request {
      agentUserId?: number;
    }
  }
}

router.use(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';

  let ok = false;
  try {
    ok = isValidInternalToken(presented);
  } catch (err: any) {
    console.error('[internal] token check failed:', err.message);
    return res.status(500).json({ error: 'Internal auth is not configured' });
  }
  if (!ok) return res.status(401).json({ error: 'Unauthorized' });

  const rawUserId = req.headers['x-user-id'];
  const userId = Number(Array.isArray(rawUserId) ? rawUserId[0] : rawUserId);
  if (!userId || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'A valid x-user-id header is required' });
  }

  const user = await dbGet('SELECT id FROM users WHERE id = ?', userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  req.agentUserId = userId;
  next();
});

/** Wraps a handler so FarmDataError surfaces its status and message. */
function handle(fn: (req: any, res: any) => Promise<any>) {
  return async (req: any, res: any) => {
    try {
      await fn(req, res);
    } catch (err: any) {
      if (err instanceof FarmDataError) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('[internal] error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

const zoneIdOf = (req: any) => Number(req.params.id);

router.get('/zones', handle(async (req, res) => {
  const zones = await listZones(req.agentUserId);
  res.json({ zones, count: zones.length });
}));

router.get('/zones/:id', handle(async (req, res) => {
  res.json(await getZone(req.agentUserId, zoneIdOf(req)));
}));

router.get('/zones/:id/tasks', handle(async (req, res) => {
  const zoneId = zoneIdOf(req);
  await getZone(req.agentUserId, zoneId);
  const tasks = await listTasks(req.agentUserId, { zoneId });
  res.json({ tasks, zone_id: zoneId, count: tasks.length });
}));

router.get('/zones/:id/logs', handle(async (req, res) => {
  const zoneId = zoneIdOf(req);
  const logs = await listZoneLogs(req.agentUserId, zoneId);
  res.json({ logs, zone_id: zoneId, count: logs.length });
}));

router.get('/tasks', handle(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const tasks = await listTasks(req.agentUserId, { status });
  res.json({ tasks, count: tasks.length });
}));

router.post('/tasks', handle(async (req, res) => {
  const task = await createTask(req.agentUserId, req.body || {});
  console.log(`[internal] agent created task ${task.id} (${task.task_type}) for user ${req.agentUserId}`);
  res.status(201).json({ success: true, task });
}));

router.get('/logs', handle(async (req, res) => {
  const logs = await listLogs(req.agentUserId, Number(req.query.limit) || 20);
  res.json({ logs, count: logs.length });
}));

router.get('/summary', handle(async (req, res) => {
  res.json(await getFarmSummary(req.agentUserId));
}));

export default router;
