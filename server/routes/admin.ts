import { Router } from 'express';
import { isAdmin } from '../middleware/auth.ts';
import { collectMetrics } from '../analytics.ts';
import { reportError } from '../observability.ts';

const router = Router();

/**
 * GET /api/admin/metrics — everything the Metrics tab renders.
 *
 * Admin-only, and deliberately aggregate-only: no row ever identifies an
 * individual farmer. Managing specific accounts stays in /api/auth/users.
 */
router.get('/metrics', isAdmin, async (req, res) => {
  try {
    res.json(await collectMetrics());
  } catch (err) {
    reportError(err, req);
    res.status(500).json({ message: 'Could not load metrics' });
  }
});

export default router;
