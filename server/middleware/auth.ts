import type { RequestHandler } from 'express';
import { dbGet } from '../db.ts';

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

/**
 * Ensures the request has a valid, active session.
 */
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
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

  const user = await dbGet(
    'SELECT role FROM users WHERE id = ?',
    req.session.userId
  );

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: admin access required' });
  }

  next();
};
