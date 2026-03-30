import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { dbAll, dbGet, dbRun, isPostgres, getSqliteDb, getPgPool } from '../db.ts';
import { isAuthenticated, isAdmin } from '../middleware/auth.ts';
import { createOtp, verifyOtp, sendSmsOtp, ensureOtpTable } from '../services/otp.ts';

ensureOtpTable().catch(err => console.error('[OTP] Table init error:', err));

const router = Router();

// ─── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, phone_number, password } = req.body;
    const identifier = (email || phone_number || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email or phone number, and password are required' });
    }

    const user = await dbGet(
      'SELECT * FROM users WHERE email = ? OR phone_number = ?',
      identifier, identifier
    );

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.is_active === 0) {
      return res.status(403).json({ message: 'Account has been deactivated. Contact your administrator.' });
    }

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ message: 'Session error' });

      req.session.userId = user.id;

      req.session.save((err) => {
        if (err) return res.status(500).json({ message: 'Session error' });
        res.json({
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
        });
      });
    });
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// ─── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, phone_number, password, first_name, last_name, language, region, district, farm_size_acres } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    if (!email && !phone_number) {
      return res.status(400).json({ message: 'Email or phone number is required' });
    }
    if (!first_name) {
      return res.status(400).json({ message: 'First name is required' });
    }

    if (email) {
      const existing = await dbGet('SELECT id FROM users WHERE email = ?', email);
      if (existing) return res.status(409).json({ message: 'An account with this email already exists' });
    }

    if (phone_number) {
      const existing = await dbGet('SELECT id FROM users WHERE phone_number = ?', phone_number);
      if (existing) return res.status(409).json({ message: 'An account with this phone number already exists' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const info = await dbRun(
      'INSERT INTO users (email, phone_number, password_hash, first_name, last_name, role, language, region, district, farm_size_acres) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      email || null, phone_number || null, hash, first_name, last_name || null, 'user',
      language || 'en', region || null, district || null, farm_size_acres || null
    );

    const newUser = await dbGet(
      'SELECT id, email, phone_number, first_name, last_name, role, language, region, district, farm_size_acres FROM users WHERE id = ?',
      info.lastInsertRowid
    );

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ message: 'Session error' });
      req.session.userId = newUser.id;
      req.session.save((err) => {
        if (err) return res.status(500).json({ message: 'Session error' });
        res.json(newUser);
      });
    });
  } catch (err: any) {
    console.error('[register] Error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── POST /api/auth/send-otp ───────────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    const { phone_number, email, lang } = req.body;
    if (!phone_number && !email) {
      return res.status(400).json({ message: 'Phone number or email is required' });
    }

    if (phone_number) {
      const existing = await dbGet('SELECT id FROM users WHERE phone_number = ?', phone_number);
      if (existing) return res.status(409).json({ message: 'An account with this phone number already exists' });

      const code = await createOtp(phone_number, 'phone');
      await sendSmsOtp(phone_number, code, lang || 'en');
      console.log(`[OTP] SMS sent to ${phone_number}`);
      return res.json({ success: true, target: phone_number, type: 'phone' });
    }

    if (email) {
      const existing = await dbGet('SELECT id FROM users WHERE email = ?', email);
      if (existing) return res.status(409).json({ message: 'An account with this email already exists' });

      const code = await createOtp(email, 'email');
      console.log(`[OTP] Email OTP for ${email}: ${code}`);
      return res.json({ success: true, target: email, type: 'email', dev_code: process.env.NODE_ENV !== 'production' ? code : undefined });
    }
  } catch (err: any) {
    console.error('[send-otp] Error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to send verification code' });
  }
});

// ─── POST /api/auth/verify-otp ────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { target, code, type, phone_number, email, password, first_name, last_name, language, region, district, farm_size_acres } = req.body;

    const t = target || phone_number || email;
    const tp = type || (phone_number ? 'phone' : 'email');

    if (!t || !code || !tp) {
      return res.status(400).json({ message: 'Target, code, and type are required' });
    }

    const valid = await verifyOtp(t, code, tp as 'phone' | 'email');
    if (!valid) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    // OTP verified — now create the account
    const pw = password;
    if (!pw || pw.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const hash = bcrypt.hashSync(pw, 10);
    const info = await dbRun(
      'INSERT INTO users (email, phone_number, password_hash, first_name, last_name, role, language, region, district, farm_size_acres, phone_verified, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      tp === 'phone' ? null : t,
      tp === 'phone' ? t : null,
      hash,
      first_name, last_name || null, 'user',
      language || 'en', region || null, district || null, farm_size_acres || null,
      tp === 'phone' ? 1 : 0,
      tp === 'email' ? 1 : 0
    );

    const newUser = await dbGet(
      'SELECT id, email, phone_number, first_name, last_name, role, language, region, district, farm_size_acres FROM users WHERE id = ?',
      info.lastInsertRowid
    );

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ message: 'Session error' });
      req.session.userId = newUser.id;
      req.session.save((err) => {
        if (err) return res.status(500).json({ message: 'Session error' });
        res.json(newUser);
      });
    });
  } catch (err: any) {
    console.error('[verify-otp] Error:', err.message);
    res.status(500).json({ message: err.message || 'Internal server error' });
  }
});

// ─── GET /api/auth/user ────────────────────────────────────────────────────────
router.get('/user', isAuthenticated, async (req, res) => {
  const user = await dbGet(
    'SELECT id, email, phone_number, first_name, last_name, role, language, region, district, farm_size_acres, created_at FROM users WHERE id = ?',
    req.session.userId!
  );
  if (!user) return res.status(401).json({ message: 'User not found' });
  res.json(user);
});

// ─── PUT /api/auth/password ────────────────────────────────────────────────────
router.put('/password', isAuthenticated, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await dbGet('SELECT * FROM users WHERE id = ?', req.session.userId!);
    if (!user || !bcrypt.compareSync(current_password, user.password_hash)) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const hash = bcrypt.hashSync(new_password, 10);
    await dbRun(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      hash, req.session.userId!
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── PUT /api/auth/profile ─────────────────────────────────────────────────────
router.put('/profile', isAuthenticated, async (req, res) => {
  try {
    const { first_name, last_name, language, region, district, farm_size_acres } = req.body;
    await dbRun(
      'UPDATE users SET first_name = ?, last_name = ?, language = ?, region = ?, district = ?, farm_size_acres = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      first_name || null, last_name || null, language || 'en',
      region || null, district || null, farm_size_acres || null,
      req.session.userId!
    );
    const user = await dbGet(
      'SELECT id, email, phone_number, first_name, last_name, role, language, region, district, farm_size_acres, created_at FROM users WHERE id = ?',
      req.session.userId!
    );
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── Admin user management ─────────────────────────────────────────────────────

router.post('/users', isAdmin, async (req, res) => {
  try {
    const { email, password, first_name, last_name, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const existing = await dbGet('SELECT id FROM users WHERE email = ?', email);
    if (existing) return res.status(409).json({ message: 'A user with this email already exists' });

    const hash = bcrypt.hashSync(password, 10);
    const info = await dbRun(
      'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)',
      email, hash, first_name || null, last_name || null, role || 'user'
    );
    res.json({ id: info.lastInsertRowid, email, first_name, last_name, role: role || 'user' });
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/users', isAdmin, async (req, res) => {
  const users = await dbAll(
    'SELECT id, email, first_name, last_name, role, is_active, created_at FROM users'
  );
  res.json(users);
});

router.put('/users/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, first_name, last_name, role, password } = req.body;

    const user = await dbGet('SELECT * FROM users WHERE id = ?', Number(id));
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (email && email !== user.email) {
      const existing = await dbGet('SELECT id FROM users WHERE email = ? AND id != ?', email, Number(id));
      if (existing) return res.status(409).json({ message: 'Email already in use' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (email)                    { updates.push('email = ?');         values.push(email); }
    if (first_name !== undefined) { updates.push('first_name = ?');    values.push(first_name || null); }
    if (last_name !== undefined)  { updates.push('last_name = ?');     values.push(last_name || null); }
    if (role)                     { updates.push('role = ?');          values.push(role); }
    if (password && password.length >= 6) {
      updates.push('password_hash = ?');
      values.push(bcrypt.hashSync(password, 10));
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(Number(id));

      if (isPostgres) {
        let idx = 0;
        const pgUpdates = updates.map(u => u.replace('?', () => `$${++idx}`));
        await getPgPool().query(`UPDATE users SET ${pgUpdates.join(', ')} WHERE id = $${++idx}`, values);
      } else {
        getSqliteDb().prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }
    }

    const updated = await dbGet(
      'SELECT id, email, first_name, last_name, role, is_active, created_at FROM users WHERE id = ?',
      Number(id)
    );
    res.json(updated);
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/users/:id/status', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (Number(id) === req.session.userId) {
    return res.status(400).json({ message: 'Cannot deactivate your own account' });
  }

  const user = await dbGet('SELECT id FROM users WHERE id = ?', Number(id));
  if (!user) return res.status(404).json({ message: 'User not found' });

  await dbRun(
    'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    is_active ? 1 : 0, Number(id)
  );
  res.json({ success: true });
});

router.delete('/users/:id', isAdmin, async (req, res) => {
  const { id } = req.params;

  if (Number(id) === req.session.userId) {
    return res.status(400).json({ message: 'Cannot delete your own account' });
  }

  const user = await dbGet('SELECT id FROM users WHERE id = ?', Number(id));
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (isPostgres) {
    await dbRun(
      "UPDATE users SET is_active = 0, email = email || '_deleted_' || CAST(id AS TEXT), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      Number(id)
    );
  } else {
    await dbRun(
      "UPDATE users SET is_active = 0, email = email || '_deleted_' || id, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      Number(id)
    );
  }
  res.json({ success: true });
});

export default router;
