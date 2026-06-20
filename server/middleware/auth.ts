import type { Request, RequestHandler } from 'express';
import { dbGet } from '../db.ts';

// Auto-expire sessions after this much inactivity (security requirement).
// Must stay in sync with INACTIVITY_LIMIT_MS in src/App.tsx.
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

declare module 'express-session' {
  interface SessionData {
    userId: number;
    lastActivity: number;
  }
}

/**
 * Returns false when the session has been idle longer than IDLE_TIMEOUT_MS.
 * Otherwise refreshes the activity stamp and returns true. Pre-existing
 * sessions without a stamp are treated as active (and stamped) on first hit.
 */
function withinIdleWindow(req: Request): boolean {
  const now = Date.now();
  const last = req.session.lastActivity;
  if (last != null && now - last > IDLE_TIMEOUT_MS) {
    return false;
  }
  req.session.lastActivity = now;
  return true;
}

/**
 * Ensures the request has a valid, active session that hasn't timed out.
 */
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!withinIdleWindow(req)) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: 'Session expired due to inactivity', code: 'SESSION_TIMEOUT' });
  }

  const user = await dbGet(
    'SELECT is_active FROM users WHERE id = ?',
    req.session.userId
  );

  if (!user || user.is_active === 0) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: 'Account deactivated' });
  }

  return next();
};

/**
 * Ensures the request belongs to an admin user.
 * Must be used after isAuthenticated.
 */
export const isAdmin: RequestHandler = async (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!withinIdleWindow(req)) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: 'Session expired due to inactivity', code: 'SESSION_TIMEOUT' });
  }

  const user = await dbGet(
    'SELECT role, is_active FROM users WHERE id = ?',
    req.session.userId
  );

  if (!user || user.is_active === 0) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: 'Account deactivated' });
  }

  if (user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: admin access required' });
  }

  next();
};
