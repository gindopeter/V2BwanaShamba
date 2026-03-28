import { Router } from 'express';
import { dbAll, dbGet, dbRun } from '../db.ts';
import { isAuthenticated } from '../middleware/auth.ts';

const router = Router();

router.get('/', isAuthenticated, async (req, res) => {
  const userId = req.session.userId!;
  const zones = await dbAll('SELECT * FROM zones WHERE user_id = ? OR user_id IS NULL', userId);
  const cropDaysMap: Record<string, number> = {
    Tomato: 120, Onion: 150, Pepper: 130, Cabbage: 100, Spinach: 50,
    Cucumber: 70, Watermelon: 90, Eggplant: 130, Carrot: 90, Lettuce: 65,
    Okra: 60, 'Green Bean': 60, Maize: 120,
  };
  const yieldMap: Record<string, number> = {
    Tomato: 30000, Onion: 15000, Pepper: 20000, Cabbage: 25000, Spinach: 10000,
    Cucumber: 20000, Watermelon: 35000, Eggplant: 25000, Carrot: 18000,
    Lettuce: 12000, Okra: 10000, 'Green Bean': 8000, Maize: 6000,
  };

  const zonesWithDetails = [];
  const today = new Date();

  for (const zone of zones as any[]) {
    const plantingDate = new Date(zone.planting_date);
    const diffDays = Math.ceil(Math.abs(today.getTime() - plantingDate.getTime()) / 86400000);
    const harvestDays = cropDaysMap[zone.crop_type] || 120;
    const harvestDate = new Date(plantingDate);
    harvestDate.setDate(harvestDate.getDate() + harvestDays);

    const nextFertigation = await dbGet(
      "SELECT scheduled_time FROM tasks WHERE zone_id = ? AND task_type = 'Fertigation' AND status = 'Pending' ORDER BY scheduled_time ASC LIMIT 1",
      zone.id
    );

    const baseYield = yieldMap[zone.crop_type] || 15000;
    const predicted = zone.expected_yield_kg
      ? zone.expected_yield_kg
      : zone.area_size * baseYield * (0.9 + Math.random() * 0.2);

    zonesWithDetails.push({
      ...zone,
      current_growth_day: diffDays,
      expected_yield_kg: Math.round(predicted),
      expected_harvest_date: harvestDate.toISOString(),
      next_fertigation_date: nextFertigation?.scheduled_time || null,
    });
  }
  res.json(zonesWithDetails);
});

router.post('/', isAuthenticated, async (req, res) => {
  const userId = req.session.userId!;
  const { name, crop_type, planting_date, area_size } = req.body;
  const info = await dbRun(
    'INSERT INTO zones (user_id, name, crop_type, planting_date, area_size) VALUES (?, ?, ?, ?, ?)',
    userId, name, crop_type, planting_date, area_size
  );
  res.json({ id: info.lastInsertRowid });
});

router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, crop_type, planting_date, area_size, status } = req.body;
    const zone = await dbGet('SELECT * FROM zones WHERE id = ?', Number(id)) as any;
    if (!zone) return res.status(404).json({ message: 'Zone not found' });
    await dbRun(
      'UPDATE zones SET name = ?, crop_type = ?, planting_date = ?, area_size = ?, status = ? WHERE id = ?',
      name ?? zone.name, crop_type ?? zone.crop_type, planting_date ?? zone.planting_date,
      area_size ?? zone.area_size, status ?? zone.status, Number(id)
    );
    const updated = await dbGet('SELECT * FROM zones WHERE id = ?', Number(id));
    res.json(updated);
  } catch (err: any) {
    console.error('[zones] Update error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const zone = await dbGet('SELECT id FROM zones WHERE id = ?', Number(id));
    if (!zone) return res.status(404).json({ message: 'Zone not found' });
    await dbRun('DELETE FROM tasks WHERE zone_id = ?', Number(id));
    await dbRun('DELETE FROM logs WHERE zone_id = ?', Number(id));
    await dbRun('DELETE FROM zones WHERE id = ?', Number(id));
    res.json({ success: true });
  } catch (err: any) {
    console.error('[zones] Delete error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/:id/yield', isAuthenticated, async (req, res) => {
  const { actual_yield_kg } = req.body;
  const { id } = req.params;
  await dbRun('UPDATE zones SET actual_yield_kg = ?, status = ? WHERE id = ?', actual_yield_kg, 'Harvested', id);
  res.json({ success: true });
});

router.post('/:id/irrigation', isAuthenticated, async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  if (!['Running', 'Off'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  await dbRun('UPDATE zones SET irrigation_status = ? WHERE id = ?', status, id);
  await dbRun('INSERT INTO logs (zone_id, message, severity) VALUES (?, ?, ?)', id, `Irrigation turned ${status}`, 'Info');
  res.json({ success: true, status });
});

export default router;
