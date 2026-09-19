/**
 * Farm data access shared by the HTTP routes, the internal agent API and the
 * direct-Gemini tool loop.
 *
 * Every function here takes the acting user's id and scopes its query to zones
 * that user owns. This is the single place farm reads and writes are defined so
 * the AI agents and the app can never diverge — the ADK tools used to talk to
 * their own SQLite file, which is how AI-created tasks went missing.
 */
import { dbAll, dbGet, dbRun } from '../db.ts';

export const VALID_TASK_TYPES = ['Irrigation', 'Fertigation', 'Scouting'] as const;
export type TaskType = (typeof VALID_TASK_TYPES)[number];

/** Error carrying the HTTP status the internal routes should surface. */
export class FarmDataError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'FarmDataError';
    this.status = status;
  }
}

export async function listZones(userId: number): Promise<any[]> {
  return dbAll('SELECT * FROM zones WHERE user_id = ? ORDER BY id ASC', userId);
}

export async function getZone(userId: number, zoneId: number): Promise<any> {
  const zone = await dbGet('SELECT * FROM zones WHERE id = ? AND user_id = ?', zoneId, userId);
  if (!zone) throw new FarmDataError(`Zone ${zoneId} not found for this farmer`, 404);
  return zone;
}

export async function listTasks(
  userId: number,
  opts: { status?: string; zoneId?: number } = {}
): Promise<any[]> {
  const clauses = ['zones.user_id = ?'];
  const params: any[] = [userId];
  if (opts.status) {
    clauses.push('tasks.status = ?');
    params.push(opts.status);
  }
  if (opts.zoneId != null) {
    clauses.push('tasks.zone_id = ?');
    params.push(opts.zoneId);
  }
  return dbAll(
    `SELECT tasks.*, zones.name AS zone_name, zones.crop_type
     FROM tasks
     JOIN zones ON tasks.zone_id = zones.id
     WHERE ${clauses.join(' AND ')}
     ORDER BY tasks.scheduled_time ASC`,
    ...params
  );
}

export async function countTasks(userId: number): Promise<number> {
  const row = await dbGet(
    `SELECT COUNT(*) AS count
     FROM tasks JOIN zones ON tasks.zone_id = zones.id
     WHERE zones.user_id = ?`,
    userId
  );
  return Number(row?.count ?? 0);
}

export interface CreateTaskInput {
  zone_id: number | string;
  task_type: string;
  scheduled_time: string;
  duration_minutes?: number | string | null;
  reasoning?: string | null;
}

export interface ValidatedTask {
  zoneId: number;
  zoneName: string;
  taskType: TaskType;
  scheduledTime: string;
  duration: number | null;
  reasoning: string | null;
}

/**
 * Checks everything createTask checks — zone ownership, task type, date — and
 * resolves the zone name, without writing anything. Lets a caller offer the
 * farmer an accurate read-back before committing (the voice flow does this).
 */
export async function validateTask(userId: number, input: CreateTaskInput): Promise<ValidatedTask> {
  const zoneId = Number(input.zone_id);
  if (!zoneId || Number.isNaN(zoneId)) {
    throw new FarmDataError('A valid zone_id is required');
  }

  const taskType = String(input.task_type || '').trim();
  if (!VALID_TASK_TYPES.includes(taskType as TaskType)) {
    throw new FarmDataError(
      `Invalid task_type '${taskType}'. Must be one of: ${VALID_TASK_TYPES.join(', ')}`
    );
  }

  const scheduledTime = String(input.scheduled_time || '');
  if (!scheduledTime || Number.isNaN(Date.parse(scheduledTime))) {
    throw new FarmDataError('A valid scheduled_time (ISO string) is required');
  }

  // Ownership check — throws 404 for a zone belonging to another farmer.
  const zone = await getZone(userId, zoneId);

  const parsed =
    input.duration_minutes != null && input.duration_minutes !== ''
      ? parseInt(String(input.duration_minutes), 10)
      : null;

  return {
    zoneId,
    zoneName: zone.name,
    taskType: taskType as TaskType,
    scheduledTime,
    duration: parsed != null && Number.isNaN(parsed) ? null : parsed,
    reasoning: input.reasoning || null,
  };
}

export async function createTask(userId: number, input: CreateTaskInput): Promise<any> {
  const { zoneId, zoneName, taskType, scheduledTime, duration, reasoning } =
    await validateTask(userId, input);

  const info = await dbRun(
    'INSERT INTO tasks (zone_id, task_type, scheduled_time, duration_minutes, reasoning) VALUES (?, ?, ?, ?, ?)',
    zoneId,
    taskType,
    scheduledTime,
    duration,
    reasoning
  );

  return {
    id: info.lastInsertRowid,
    zone_id: zoneId,
    zone_name: zoneName,
    task_type: taskType,
    scheduled_time: scheduledTime,
    duration_minutes: duration,
    status: 'Pending',
    reasoning,
  };
}

export async function listLogs(userId: number, limit = 20): Promise<any[]> {
  const capped = Math.min(Math.max(Number(limit) || 20, 1), 100);
  return dbAll(
    `SELECT logs.*, zones.name AS zone_name
     FROM logs JOIN zones ON logs.zone_id = zones.id
     WHERE zones.user_id = ?
     ORDER BY logs.timestamp DESC
     LIMIT ${capped}`,
    userId
  );
}

export async function listZoneLogs(userId: number, zoneId: number): Promise<any[]> {
  await getZone(userId, zoneId);
  return dbAll(
    'SELECT * FROM logs WHERE zone_id = ? ORDER BY timestamp DESC LIMIT 20',
    zoneId
  );
}

export async function getFarmSummary(userId: number): Promise<any> {
  const [zones, pending, alerts, profile] = await Promise.all([
    listZones(userId),
    countPendingTasks(userId),
    dbAll(
      `SELECT logs.*, zones.name AS zone_name
       FROM logs JOIN zones ON logs.zone_id = zones.id
       WHERE zones.user_id = ? AND LOWER(logs.severity) IN ('warning', 'error', 'critical')
       ORDER BY logs.timestamp DESC
       LIMIT 5`,
      userId
    ),
    dbGet('SELECT first_name, last_name, region, district, farm_size_acres FROM users WHERE id = ?', userId),
  ]);

  const totalArea = zones.reduce((sum: number, z: any) => sum + (Number(z.area_size) || 0), 0);
  const location = [
    profile?.district ? `${profile.district} District` : null,
    profile?.region ? `${profile.region} Region` : null,
    'Tanzania',
  ].filter(Boolean).join(', ');

  return {
    farmer: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Farmer',
    location,
    total_area: `${totalArea} acres`,
    zones,
    pending_tasks: pending,
    recent_alerts: alerts,
    date: new Date().toISOString(),
  };
}

async function countPendingTasks(userId: number): Promise<number> {
  const row = await dbGet(
    `SELECT COUNT(*) AS count
     FROM tasks JOIN zones ON tasks.zone_id = zones.id
     WHERE zones.user_id = ? AND tasks.status = 'Pending'`,
    userId
  );
  return Number(row?.count ?? 0);
}
