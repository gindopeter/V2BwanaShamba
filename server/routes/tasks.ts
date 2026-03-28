import { Router } from 'express';
import { dbAll, dbRun } from '../db.ts';
import { isAuthenticated } from '../middleware/auth.ts';

const router = Router();

router.get('/', isAuthenticated, async (req, res) => {
  const tasks = await dbAll(`
    SELECT tasks.*, zones.name as zone_name, zones.crop_type
    FROM tasks
    JOIN zones ON tasks.zone_id = zones.id
    ORDER BY scheduled_time ASC
  `);
  res.json(tasks);
});

router.post('/', isAuthenticated, async (req, res) => {
  const { zone_id, task_type, scheduled_time, duration_minutes, reasoning } = req.body;
  const info = await dbRun(
    'INSERT INTO tasks (zone_id, task_type, scheduled_time, duration_minutes, reasoning) VALUES (?, ?, ?, ?, ?)',
    zone_id, task_type, scheduled_time, duration_minutes, reasoning
  );
  res.json({ id: info.lastInsertRowid });
});

router.patch('/:id/status', isAuthenticated, async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  await dbRun('UPDATE tasks SET status = ? WHERE id = ?', status, id);
  res.json({ success: true });
});

export default router;
