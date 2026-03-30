import { Router } from 'express';
import { dbAll, dbGet, dbRun } from '../db.ts';
import { isAuthenticated } from '../middleware/auth.ts';
import {
  VALID_CROP_TYPES,
  getDaysToHarvest,
  getGrowthStage,
  getYieldPerAcre,
} from '../constants/crops.ts';

const router = Router();

// ─── GET /api/zones ────────────────────────────────────────────────────────────
// N+1 query replaced with a single LEFT JOIN for next_fertigation_date
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId!;

    const zones = await dbAll(
      `SELECT z.*,
              t.scheduled_time AS next_fertigation_date
       FROM zones z
       LEFT JOIN (
         SELECT zone_id, MIN(scheduled_time) AS scheduled_time
         FROM tasks
         WHERE task_type = 'Fertigation' AND status = 'Pending'
         GROUP BY zone_id
       ) t ON t.zone_id = z.id
       WHERE z.user_id = ?`,
      userId
    );

    const today = new Date();

    const zonesWithDetails = zones.map((zone: any) => {
      const plantingDate = new Date(zone.planting_date);
      const diffDays = Math.ceil(
        Math.abs(today.getTime() - plantingDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const maxDays = getDaysToHarvest(zone.crop_type);
      const harvestDate = new Date(plantingDate);
      harvestDate.setDate(harvestDate.getDate() + maxDays);

      const baseYield = getYieldPerAcre(zone.crop_type);
      const predictedYield = zone.expected_yield_kg
        ? zone.expected_yield_kg
        : Math.round(zone.area_size * baseYield * (0.9 + Math.random() * 0.2));

      return {
        ...zone,
        current_growth_day: diffDays,
        growth_stage: getGrowthStage(diffDays, maxDays),
        expected_yield_kg: predictedYield,
        expected_harvest_date: harvestDate.toISOString(),
      };
    });

    res.json(zonesWithDetails);
  } catch (err: any) {
    console.error('[zones] GET error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── POST /api/zones ───────────────────────────────────────────────────────────
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const { name, crop_type, planting_date, area_size } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'Zone name is required' });
    }
    if (!crop_type || !VALID_CROP_TYPES.includes(crop_type)) {
      return res.status(400).json({ message: `crop_type must be one of: ${VALID_CROP_TYPES.join(', ')}` });
    }
    if (!planting_date || isNaN(Date.parse(planting_date))) {
      return res.status(400).json({ message: 'A valid planting_date (ISO string) is required' });
    }
    const parsedArea = parseFloat(area_size);
    if (isNaN(parsedArea) || parsedArea <= 0) {
      return res.status(400).json({ message: 'area_size must be a positive number' });
    }

    // Enforce farm size limit
    const userRecord = await dbGet('SELECT farm_size_acres FROM users WHERE id = ?', userId) as any;
    const farmSizeAcres = userRecord?.farm_size_acres ? parseFloat(userRecord.farm_size_acres) : null;
    if (farmSizeAcres) {
      const existing = await dbGet('SELECT COALESCE(SUM(area_size), 0) AS total FROM zones WHERE user_id = ?', userId) as any;
      const usedAcres = parseFloat(existing?.total || 0);
      if (usedAcres + parsedArea > farmSizeAcres) {
        const available = parseFloat((farmSizeAcres - usedAcres).toFixed(2));
        return res.status(400).json({ message: `Zone size exceeds available farm space. You have ${available} acres remaining of your ${farmSizeAcres}-acre farm.` });
      }
    }

    const info = await dbRun(
      'INSERT INTO zones (user_id, name, crop_type, planting_date, area_size) VALUES (?, ?, ?, ?, ?)',
      userId,
      name.trim(),
      crop_type,
      planting_date,
      parsedArea
    );

    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err: any) {
    console.error('[zones] POST error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── PUT /api/zones/:id ────────────────────────────────────────────────────────
// Ownership check: users can only update their own zones
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId!;
    const { name, crop_type, planting_date, area_size, status } = req.body;

    const zone = await dbGet(
      'SELECT * FROM zones WHERE id = ? AND user_id = ?',
      Number(id),
      userId
    ) as any;

    if (!zone) {
      return res.status(404).json({ message: 'Zone not found or access denied' });
    }

    if (crop_type !== undefined && !VALID_CROP_TYPES.includes(crop_type)) {
      return res.status(400).json({ message: `crop_type must be one of: ${VALID_CROP_TYPES.join(', ')}` });
    }
    if (planting_date !== undefined && isNaN(Date.parse(planting_date))) {
      return res.status(400).json({ message: 'planting_date must be a valid ISO date string' });
    }
    if (area_size !== undefined) {
      const parsed = parseFloat(area_size);
      if (isNaN(parsed) || parsed <= 0) {
        return res.status(400).json({ message: 'area_size must be a positive number' });
      }

      // Enforce farm size limit (exclude current zone from the sum)
      const userRecord = await dbGet('SELECT farm_size_acres FROM users WHERE id = ?', userId) as any;
      const farmSizeAcres = userRecord?.farm_size_acres ? parseFloat(userRecord.farm_size_acres) : null;
      if (farmSizeAcres) {
        const others = await dbGet(
          'SELECT COALESCE(SUM(area_size), 0) AS total FROM zones WHERE user_id = ? AND id != ?',
          userId, Number(id)
        ) as any;
        const otherAcres = parseFloat(others?.total || 0);
        if (otherAcres + parsed > farmSizeAcres) {
          const available = parseFloat((farmSizeAcres - otherAcres).toFixed(2));
          return res.status(400).json({ message: `Zone size exceeds available farm space. You can allocate up to ${available} acres for this zone.` });
        }
      }
    }

    await dbRun(
      'UPDATE zones SET name = ?, crop_type = ?, planting_date = ?, area_size = ?, status = ? WHERE id = ?',
      name ?? zone.name,
      crop_type ?? zone.crop_type,
      planting_date ?? zone.planting_date,
      area_size ?? zone.area_size,
      status ?? zone.status,
      Number(id)
    );

    const updated = await dbGet('SELECT * FROM zones WHERE id = ?', Number(id));
    res.json(updated);
  } catch (err: any) {
    console.error('[zones] PUT error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── DELETE /api/zones/:id ─────────────────────────────────────────────────────
// Ownership check enforced
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId!;

    const zone = await dbGet(
      'SELECT id FROM zones WHERE id = ? AND user_id = ?',
      Number(id),
      userId
    );

    if (!zone) {
      return res.status(404).json({ message: 'Zone not found or access denied' });
    }

    await dbRun('DELETE FROM tasks WHERE zone_id = ?', Number(id));
    await dbRun('DELETE FROM logs WHERE zone_id = ?', Number(id));
    await dbRun('DELETE FROM zones WHERE id = ?', Number(id));

    res.json({ success: true });
  } catch (err: any) {
    console.error('[zones] DELETE error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── PATCH /api/zones/:id/yield ────────────────────────────────────────────────
// Ownership check + validation
router.patch('/:id/yield', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId!;
    const { actual_yield_kg } = req.body;

    const parsedYield = parseFloat(actual_yield_kg);
    if (isNaN(parsedYield) || parsedYield < 0) {
      return res.status(400).json({ message: 'actual_yield_kg must be a non-negative number' });
    }

    const zone = await dbGet(
      'SELECT id FROM zones WHERE id = ? AND user_id = ?',
      Number(id),
      userId
    );
    if (!zone) {
      return res.status(404).json({ message: 'Zone not found or access denied' });
    }

    await dbRun(
      'UPDATE zones SET actual_yield_kg = ?, status = ? WHERE id = ?',
      parsedYield,
      'Harvested',
      Number(id)
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error('[zones] PATCH yield error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── POST /api/zones/:id/irrigation ───────────────────────────────────────────
// Ownership check enforced
router.post('/:id/irrigation', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId!;
    const { status } = req.body;

    if (!['Running', 'Off'].includes(status)) {
      return res.status(400).json({ error: "status must be 'Running' or 'Off'" });
    }

    const zone = await dbGet(
      'SELECT id FROM zones WHERE id = ? AND user_id = ?',
      Number(id),
      userId
    );
    if (!zone) {
      return res.status(404).json({ message: 'Zone not found or access denied' });
    }

    await dbRun('UPDATE zones SET irrigation_status = ? WHERE id = ?', status, Number(id));
    await dbRun(
      'INSERT INTO logs (zone_id, message, severity) VALUES (?, ?, ?)',
      Number(id),
      `Irrigation turned ${status}`,
      'Info'
    );

    res.json({ success: true, status });
  } catch (err: any) {
    console.error('[zones] irrigation error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
