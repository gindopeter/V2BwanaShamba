/**
 * Farmer-facing controls for the AI's memory.
 * Lets a farmer see what BwanaShamba remembers about them and delete any fact.
 * All endpoints are scoped to the logged-in user (per-user data isolation).
 */
import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.ts';
import { listMemories, deleteMemory } from '../services/memory.ts';

const router = Router();

// ─── GET /api/memory ──────────────────────────────────────────────────────────
// Returns the durable facts BwanaShamba has remembered about this farmer.
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const memories = await listMemories(userId);
    res.json({ memories });
  } catch (err: any) {
    console.error('[memory] list error:', err.message);
    res.status(500).json({ error: 'Failed to load memory' });
  }
});

// ─── DELETE /api/memory/:id ───────────────────────────────────────────────────
// Lets a farmer forget a single remembered fact.
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const removed = await deleteMemory(userId, id);
    if (!removed) return res.status(404).json({ error: 'Memory not found' });
    res.json({ success: true });
  } catch (err: any) {
    console.error('[memory] delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

export default router;
