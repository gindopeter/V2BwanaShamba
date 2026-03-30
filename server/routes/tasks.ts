import { Router } from 'express';
import { dbAll, dbGet, dbRun } from '../db.ts';
import { isAuthenticated } from '../middleware/auth.ts';

const router = Router();

const VALID_STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled'];

// ─── GET /api/tasks ────────────────────────────────────────────────────────────
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const tasks = await dbAll(`
      SELECT tasks.*, zones.name AS zone_name, zones.crop_type
      FROM tasks
      JOIN zones ON tasks.zone_id = zones.id
      WHERE zones.user_id = ?
      ORDER BY scheduled_time ASC
    `, userId);
    res.json(tasks);
  } catch (err: any) {
    console.error('[tasks] GET error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── POST /api/tasks ───────────────────────────────────────────────────────────
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const { zone_id, task_type, scheduled_time, duration_minutes, reasoning } = req.body;

    if (!zone_id || isNaN(Number(zone_id))) {
      return res.status(400).json({ message: 'A valid zone_id is required' });
    }
    if (!task_type || typeof task_type !== 'string' || task_type.trim().length === 0) {
      return res.status(400).json({ message: 'task_type is required' });
    }
    if (!scheduled_time || isNaN(Date.parse(scheduled_time))) {
      return res.status(400).json({ message: 'A valid scheduled_time (ISO string) is required' });
    }
    const parsedDuration = duration_minutes != null ? parseInt(duration_minutes, 10) : null;

    const zone = await dbGet(
      'SELECT id FROM zones WHERE id = ? AND user_id = ?',
      Number(zone_id), userId
    );
    if (!zone) {
      return res.status(404).json({ message: 'Zone not found or access denied' });
    }

    const info = await dbRun(
      'INSERT INTO tasks (zone_id, task_type, scheduled_time, duration_minutes, reasoning) VALUES (?, ?, ?, ?, ?)',
      Number(zone_id),
      task_type.trim(),
      scheduled_time,
      parsedDuration,
      reasoning || null
    );

    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err: any) {
    console.error('[tasks] POST error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── PATCH /api/tasks/:id/status ──────────────────────────────────────────────
router.patch('/:id/status', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId!;
    const { status } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const task = await dbGet(`
      SELECT tasks.id FROM tasks
      JOIN zones ON tasks.zone_id = zones.id
      WHERE tasks.id = ? AND zones.user_id = ?
    `, Number(id), userId);

    if (!task) {
      return res.status(404).json({ message: 'Task not found or access denied' });
    }

    await dbRun('UPDATE tasks SET status = ? WHERE id = ?', status, Number(id));
    res.json({ success: true });
  } catch (err: any) {
    console.error('[tasks] PATCH status error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
