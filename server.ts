import 'dotenv/config';
import express from "express";
import { GoogleGenAI } from "@google/genai";
import { initDatabase, dbAll, dbGet, dbRun, isPostgres, getSqliteDb, getPgPool } from "./server/db.ts";
import session from "express-session";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import type { RequestHandler } from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getFarmContext(): Promise<string> {
  const zones = await dbAll('SELECT * FROM zones');
  const tasks = await dbAll('SELECT t.*, z.name as zone_name FROM tasks t JOIN zones z ON t.zone_id = z.id ORDER BY t.scheduled_time DESC LIMIT 20');
  const logs = await dbAll('SELECT l.*, z.name as zone_name FROM logs l LEFT JOIN zones z ON l.zone_id = z.id ORDER BY l.timestamp DESC LIMIT 10');

  const today = new Date();

  const zoneDetails = zones.map((z: any) => {
    const plantingDate = new Date(z.planting_date);
    const diffTime = Math.abs(today.getTime() - plantingDate.getTime());
    const growthDay = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const cropDays: Record<string, number> = { 'Tomato': 120, 'Onion': 150, 'Pepper': 130, 'Cabbage': 100, 'Spinach': 50, 'Cucumber': 70, 'Watermelon': 90, 'Eggplant': 130, 'Carrot': 90, 'Lettuce': 65, 'Okra': 60, 'Green Bean': 60, 'Maize': 120 };
    const maxDays = cropDays[z.crop_type] || 120;
    const stage = growthDay <= maxDays * 0.25 ? 'Seedling' : growthDay <= maxDays * 0.5 ? 'Vegetative' : growthDay <= maxDays * 0.75 ? 'Flowering' : 'Harvest';
    return `- ${z.name}: ${z.crop_type}, ${z.area_size} acres, planted ${z.planting_date}, day ${growthDay}/${maxDays} (${stage} stage), irrigation: ${z.irrigation_status}, status: ${z.status}, expected yield: ${z.expected_yield_kg}kg, actual yield: ${z.actual_yield_kg}kg`;
  }).join('\n');

  const taskDetails = tasks.map((t: any) => {
    return `- [${t.status}] ${t.task_type} for ${t.zone_name} at ${t.scheduled_time} (${t.duration_minutes}min) - ${t.reasoning || 'No reason'}`;
  }).join('\n');

  const logDetails = logs.map((l: any) => {
    return `- [${l.severity}] ${l.zone_name || 'System'}: ${l.message} (${l.timestamp})`;
  }).join('\n');

  return `
=== CURRENT FARM DATA ===
Date: ${today.toISOString().split('T')[0]}

ZONES:
${zoneDetails || 'No zones configured'}

RECENT TASKS (last 20):
${taskDetails || 'No tasks'}

RECENT LOGS (last 10):
${logDetails || 'No logs'}
=== END FARM DATA ===`;
}

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (req.session?.userId) {
    const user = await dbGet('SELECT is_active FROM users WHERE id = ?', req.session.userId);
    if (!user || user.is_active === 0) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Account deactivated" });
    }
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

const isAdmin: RequestHandler = async (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const user = await dbGet('SELECT role FROM users WHERE id = ?', req.session.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ message: "Forbidden: admin access required" });
  }
  next();
};

async function startServer() {
  console.log(`[startup] NODE_ENV=${process.env.NODE_ENV}, PORT=${process.env.PORT || 5000}, CWD=${process.cwd()}`);

  await initDatabase();

  const app = express();
  const port = process.env.PORT || 5000;

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  app.set("trust proxy", 1);

  if (isPostgres) {
    const connectPgSimple = (await import('connect-pg-simple')).default;
    const PgStore = connectPgSimple(session);
    app.use(session({
      secret: process.env.SESSION_SECRET || 'bwanashamba-farm-secret-key-change-in-production',
      store: new PgStore({ pool: getPgPool(), createTableIfMissing: true }),
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 },
    }));
    console.log('[startup] Using PostgreSQL session store');
  } else {
    const BetterSqlite3SessionStore = (await import('better-sqlite3-session-store')).default;
    const SqliteStore = BetterSqlite3SessionStore(session);
    app.use(session({
      secret: process.env.SESSION_SECRET || 'bwanashamba-farm-secret-key-change-in-production',
      store: new SqliteStore({ client: getSqliteDb(), expired: { clear: true, intervalMs: 900000 } }),
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 },
    }));
    console.log('[startup] Using SQLite session store');
  }

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", database: isPostgres ? "postgresql" : "sqlite" });
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const user = await dbGet('SELECT * FROM users WHERE email = ?', email);
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      if (user.is_active === 0) {
        return res.status(403).json({ message: "Account has been deactivated. Contact your administrator." });
      }
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ message: "Session error" });
        }
        req.session.userId = user.id;
        req.session.save((err) => {
          if (err) {
            return res.status(500).json({ message: "Session error" });
          }
          res.json({ id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role });
        });
      });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    const user = await dbGet('SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = ?', req.session.userId!);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    res.json(user);
  });

  app.post("/api/auth/users", isAdmin, async (req, res) => {
    try {
      const { email, password, first_name, last_name, role } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const existing = await dbGet('SELECT id FROM users WHERE email = ?', email);
      if (existing) {
        return res.status(409).json({ message: "A user with this email already exists" });
      }
      const hash = bcrypt.hashSync(password, 10);
      const info = await dbRun(
        'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)',
        email, hash, first_name || null, last_name || null, role || 'user'
      );
      res.json({ id: info.lastInsertRowid, email, first_name, last_name, role: role || 'user' });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/users", isAdmin, async (req, res) => {
    const users = await dbAll('SELECT id, email, first_name, last_name, role, is_active, created_at FROM users');
    res.json(users);
  });

  app.put("/api/auth/users/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { email, first_name, last_name, role, password } = req.body;
      const user = await dbGet('SELECT * FROM users WHERE id = ?', Number(id));
      if (!user) return res.status(404).json({ message: "User not found" });
      if (email && email !== user.email) {
        const existing = await dbGet('SELECT id FROM users WHERE email = ? AND id != ?', email, Number(id));
        if (existing) return res.status(409).json({ message: "Email already in use" });
      }
      const updates: string[] = [];
      const values: any[] = [];
      if (email) { updates.push('email = ?'); values.push(email); }
      if (first_name !== undefined) { updates.push('first_name = ?'); values.push(first_name || null); }
      if (last_name !== undefined) { updates.push('last_name = ?'); values.push(last_name || null); }
      if (role) { updates.push('role = ?'); values.push(role); }
      if (password && password.length >= 6) { updates.push('password_hash = ?'); values.push(bcrypt.hashSync(password, 10)); }
      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(Number(id));
        if (isPostgres) {
          let idx = 0;
          const pgUpdates = updates.map(u => u.replace('?', () => `$${++idx}`));
          const pgSql = `UPDATE users SET ${pgUpdates.join(', ')} WHERE id = $${++idx}`;
          await getPgPool().query(pgSql, values);
        } else {
          getSqliteDb().prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        }
      }
      const updated = await dbGet('SELECT id, email, first_name, last_name, role, is_active, created_at FROM users WHERE id = ?', Number(id));
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/auth/users/:id/status", isAdmin, async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;
    if (Number(id) === req.session.userId) {
      return res.status(400).json({ message: "Cannot deactivate your own account" });
    }
    const user = await dbGet('SELECT id FROM users WHERE id = ?', Number(id));
    if (!user) return res.status(404).json({ message: "User not found" });
    await dbRun('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', is_active ? 1 : 0, Number(id));
    res.json({ success: true });
  });

  app.delete("/api/auth/users/:id", isAdmin, async (req, res) => {
    const { id } = req.params;
    if (Number(id) === req.session.userId) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }
    const user = await dbGet('SELECT id FROM users WHERE id = ?', Number(id));
    if (!user) return res.status(404).json({ message: "User not found" });
    if (isPostgres) {
      await dbRun("UPDATE users SET is_active = 0, email = email || '_deleted_' || CAST(id AS TEXT), updated_at = CURRENT_TIMESTAMP WHERE id = ?", Number(id));
    } else {
      await dbRun("UPDATE users SET is_active = 0, email = email || '_deleted_' || id, updated_at = CURRENT_TIMESTAMP WHERE id = ?", Number(id));
    }
    res.json({ success: true });
  });

  app.put("/api/auth/password", isAuthenticated, async (req, res) => {
    try {
      const { current_password, new_password } = req.body;
      if (!current_password || !new_password) {
        return res.status(400).json({ message: "Current and new passwords are required" });
      }
      if (new_password.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }
      const user = await dbGet('SELECT * FROM users WHERE id = ?', req.session.userId!);
      if (!user || !bcrypt.compareSync(current_password, user.password_hash)) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
      const hash = bcrypt.hashSync(new_password, 10);
      await dbRun('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', hash, req.session.userId!);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/auth/profile", isAuthenticated, async (req, res) => {
    try {
      const { first_name, last_name } = req.body;
      await dbRun('UPDATE users SET first_name = ?, last_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        first_name || null, last_name || null, req.session.userId!
      );
      const user = await dbGet('SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = ?', req.session.userId!);
      res.json(user);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/zones", isAuthenticated, async (req, res) => {
    const zones = await dbAll('SELECT * FROM zones');

    const zonesWithDetails = [];
    for (const zone of zones as any[]) {
      const plantingDate = new Date(zone.planting_date);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - plantingDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const cropDaysMap: Record<string, number> = { 'Tomato': 120, 'Onion': 150, 'Pepper': 130, 'Cabbage': 100, 'Spinach': 50, 'Cucumber': 70, 'Watermelon': 90, 'Eggplant': 130, 'Carrot': 90, 'Lettuce': 65, 'Okra': 60, 'Green Bean': 60, 'Maize': 120 };
      const harvestDays = cropDaysMap[zone.crop_type] || 120;
      const harvestDate = new Date(plantingDate);
      harvestDate.setDate(harvestDate.getDate() + harvestDays);

      const nextFertigation = await dbGet(
        "SELECT scheduled_time FROM tasks WHERE zone_id = ? AND task_type = 'Fertigation' AND status = 'Pending' ORDER BY scheduled_time ASC LIMIT 1",
        zone.id
      );

      const yieldMap: Record<string, number> = { 'Tomato': 30000, 'Onion': 15000, 'Pepper': 20000, 'Cabbage': 25000, 'Spinach': 10000, 'Cucumber': 20000, 'Watermelon': 35000, 'Eggplant': 25000, 'Carrot': 18000, 'Lettuce': 12000, 'Okra': 10000, 'Green Bean': 8000, 'Maize': 6000 };
      let baseYield = yieldMap[zone.crop_type] || 15000;
      let predicted = zone.area_size * baseYield;
      if (!zone.expected_yield_kg) {
        predicted = predicted * (0.9 + Math.random() * 0.2);
      } else {
        predicted = zone.expected_yield_kg;
      }

      zonesWithDetails.push({
        ...zone,
        current_growth_day: diffDays,
        expected_yield_kg: Math.round(predicted),
        expected_harvest_date: harvestDate.toISOString(),
        next_fertigation_date: nextFertigation?.scheduled_time || null
      });
    }
    res.json(zonesWithDetails);
  });

  app.post("/api/zones", isAuthenticated, async (req, res) => {
    const { name, crop_type, planting_date, area_size } = req.body;
    const info = await dbRun('INSERT INTO zones (name, crop_type, planting_date, area_size) VALUES (?, ?, ?, ?)', name, crop_type, planting_date, area_size);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/zones/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, crop_type, planting_date, area_size, status } = req.body;
      const zone = await dbGet('SELECT * FROM zones WHERE id = ?', Number(id)) as any;
      if (!zone) return res.status(404).json({ message: "Zone not found" });
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
      console.error("Update zone error:", err.message);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/zones/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const zone = await dbGet('SELECT id FROM zones WHERE id = ?', Number(id));
      if (!zone) return res.status(404).json({ message: "Zone not found" });
      await dbRun('DELETE FROM tasks WHERE zone_id = ?', Number(id));
      await dbRun('DELETE FROM logs WHERE zone_id = ?', Number(id));
      await dbRun('DELETE FROM zones WHERE id = ?', Number(id));
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete zone error:", err.message);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/zones/:id/yield", isAuthenticated, async (req, res) => {
    const { actual_yield_kg } = req.body;
    const { id } = req.params;
    await dbRun('UPDATE zones SET actual_yield_kg = ?, status = ? WHERE id = ?', actual_yield_kg, 'Harvested', id);
    res.json({ success: true });
  });

  app.post("/api/zones/:id/irrigation", isAuthenticated, async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;

    if (!['Running', 'Off'].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await dbRun('UPDATE zones SET irrigation_status = ? WHERE id = ?', status, id);
    await dbRun('INSERT INTO logs (zone_id, message, severity) VALUES (?, ?, ?)', id, `Irrigation turned ${status}`, 'Info');

    res.json({ success: true, status });
  });

  app.get("/api/tasks", isAuthenticated, async (req, res) => {
    const tasks = await dbAll(`
      SELECT tasks.*, zones.name as zone_name, zones.crop_type 
      FROM tasks 
      JOIN zones ON tasks.zone_id = zones.id 
      ORDER BY scheduled_time ASC
    `);
    res.json(tasks);
  });

  app.post("/api/tasks", isAuthenticated, async (req, res) => {
    const { zone_id, task_type, scheduled_time, duration_minutes, reasoning } = req.body;
    const info = await dbRun('INSERT INTO tasks (zone_id, task_type, scheduled_time, duration_minutes, reasoning) VALUES (?, ?, ?, ?, ?)', zone_id, task_type, scheduled_time, duration_minutes, reasoning);
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/tasks/:id/status", isAuthenticated, async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    await dbRun('UPDATE tasks SET status = ? WHERE id = ?', status, id);
    res.json({ success: true });
  });

  app.get("/api/conversations", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const conversations = await dbAll('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC', userId);
    res.json(conversations);
  });

  app.post("/api/conversations", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const { title } = req.body;
    const result = await dbRun('INSERT INTO conversations (user_id, title) VALUES (?, ?)', userId, title || 'New Conversation');
    res.json({ id: result.lastInsertRowid, title: title || 'New Conversation' });
  });

  app.delete("/api/conversations/:id", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    await dbRun('DELETE FROM chat_messages WHERE conversation_id = ? AND conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)', req.params.id, userId);
    await dbRun('DELETE FROM conversations WHERE id = ? AND user_id = ?', req.params.id, userId);
    res.json({ success: true });
  });

  app.get("/api/conversations/:id/messages", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const conv = await dbGet('SELECT id FROM conversations WHERE id = ? AND user_id = ?', req.params.id, userId);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const messages = await dbAll('SELECT id, role, text, image_url, created_at FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC', req.params.id);
    res.json(messages);
  });

  const ADK_URL = process.env.ADK_SERVICE_URL || 'http://localhost:8001';
  const ADK_TOKEN = process.env.ADK_INTERNAL_TOKEN || 'bwanashamba-internal-dev-token';

  async function chatViaADK(message: string, userId: string, sessionId: string | null, image?: string, mimeType?: string): Promise<{ reply: string; adkSessionId: string; agentName: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    try {
      const body: any = { message, user_id: `user_${userId}`, session_id: sessionId };
      if (image) { body.image = image; body.mime_type = mimeType || 'image/jpeg'; }
      const resp = await fetch(`${ADK_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADK_TOKEN}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error(`ADK returned ${resp.status}`);
      const data = await resp.json() as any;
      return { reply: data.reply, adkSessionId: data.session_id, agentName: data.agent_name };
    } finally {
      clearTimeout(timeout);
    }
  }

  function createADKStreamFetch(message: string, userId: string, sessionId: string | null, image?: string, mimeType?: string): { promise: Promise<Response>; abort: () => void } {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    const body: any = { message, user_id: `user_${userId}`, session_id: sessionId, stream: true };
    if (image) { body.image = image; body.mime_type = mimeType || 'image/jpeg'; }
    const promise = fetch(`${ADK_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADK_TOKEN}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).then(resp => {
      if (!resp.ok) {
        clearTimeout(timeout);
        throw new Error(`ADK returned ${resp.status}`);
      }
      return resp;
    });
    return {
      promise,
      abort: () => { clearTimeout(timeout); controller.abort(); },
    };
  }

  async function chatViaGeminiDirect(message: string, contents: any[], image?: string, mimeType?: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API key not configured");
    const ai = new GoogleGenAI({ apiKey });
    const farmContext = await getFarmContext();
    const systemInstruction = `You are 'BwanaShamba' (AI Farm Assistant) for a 5-acre farm in Malivundo, Pwani, Tanzania growing horticulture crops (tomatoes, onions, peppers, cabbage, spinach, cucumbers, watermelon, eggplant, carrots, lettuce, okra, green beans) and maize.
You help farmers with questions about all these crops — soil, pest control, irrigation, fertigation, harvest timing, and market prices.
You are fluent in both English and Kiswahili. IMPORTANT: Always respond in the same language the user is currently using. If the user writes in Kiswahili, respond entirely in Kiswahili. If the user writes in English, respond in English. If the user switches languages mid-conversation, switch with them immediately.
Be concise, practical, and helpful. Use the live farm data below to give specific, accurate answers about zones, tasks, and conditions.

${farmContext}

Current Date: ${new Date().toISOString()}`;

    if (image) {
      const lastContent = contents[contents.length - 1];
      if (lastContent) {
        lastContent.parts.unshift({ inlineData: { mimeType: mimeType || "image/jpeg", data: image } });
      }
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: { systemInstruction }
    });
    return response.text || "I could not generate a response.";
  }

  app.post("/api/chat", isAuthenticated, async (req, res) => {
    try {
      const { message, image, mimeType: clientMimeType, conversationId, stream: wantStream } = req.body;
      const userId = (req.session as any).userId;

      let convId = conversationId;
      if (convId) {
        const owned = await dbGet('SELECT id FROM conversations WHERE id = ? AND user_id = ?', convId, userId);
        if (!owned) {
          return res.status(403).json({ reply: "Conversation not found or access denied." });
        }
      } else {
        const result = await dbRun('INSERT INTO conversations (user_id, title) VALUES (?, ?)', userId, (message || 'Image analysis').substring(0, 80));
        convId = result.lastInsertRowid;
      }

      const hasImage = !!image;
      await dbRun('INSERT INTO chat_messages (conversation_id, role, text, image_url) VALUES (?, ?, ?, ?)', convId, 'user', message || 'Analyze this image.', hasImage ? 'attached' : null);

      let adkSessionId: string | null = null;
      const existing = await dbGet("SELECT text FROM chat_messages WHERE conversation_id = ? AND role = 'system' AND text LIKE 'adk_session:%' ORDER BY created_at DESC LIMIT 1", convId);
      if (existing) {
        adkSessionId = existing.text.replace('adk_session:', '');
      }

      if (wantStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        res.write(`data: ${JSON.stringify({ type: 'start', conversationId: convId })}\n\n`);

        let fullReply = '';
        let agentName = 'gemini-direct';
        let sessionSaved = false;
        let clientDisconnected = false;
        let adkStreamCtrl: { abort: () => void } | null = null;

        res.on('close', () => {
          clientDisconnected = true;
          adkStreamCtrl?.abort();
        });

        try {
          const { promise, abort } = createADKStreamFetch(message || 'Analyze this image.', String(userId), adkSessionId, image, clientMimeType);
          adkStreamCtrl = { abort };
          const adkResp = await promise;
          const reader = adkResp.body;
          if (reader) {
            let buffer = '';
            for await (const chunk of reader as any) {
              if (clientDisconnected) break;
              buffer += (typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const parsed = JSON.parse(line.slice(6));
                    if (parsed.type === 'text') {
                      fullReply += parsed.content;
                      agentName = parsed.agent || agentName;
                      if (!clientDisconnected) {
                        res.write(`data: ${JSON.stringify({ type: 'text', content: parsed.content })}\n\n`);
                      }
                    } else if (parsed.type === 'error') {
                      if (!clientDisconnected) {
                        res.write(`data: ${JSON.stringify({ type: 'error', message: parsed.message || 'Agent error' })}\n\n`);
                      }
                    } else if ((parsed.type === 'start' || parsed.type === 'done') && parsed.session_id && !adkSessionId && !sessionSaved) {
                      sessionSaved = true;
                      await dbRun('INSERT INTO chat_messages (conversation_id, role, text) VALUES (?, ?, ?)', convId, 'system', `adk_session:${parsed.session_id}`);
                    }
                    if (parsed.type === 'done') {
                      agentName = parsed.agent || agentName;
                    }
                  } catch { }
                }
              }
            }
          }
          abort();
          console.log(`[chat] ADK stream agent '${agentName}' handled conversation ${convId}`);
        } catch (adkErr: any) {
          if (clientDisconnected) return;
          console.log(`[chat] ADK stream unavailable (${adkErr.message}), falling back to direct Gemini`);
          const history = await dbAll(
            "SELECT role, text FROM chat_messages WHERE conversation_id = ? AND role IN ('user', 'ai') ORDER BY created_at ASC",
            convId
          );
          const contents = history.map((msg: any) => ({
            role: msg.role === 'ai' ? 'model' : 'user',
            parts: [{ text: msg.text }]
          }));
          fullReply = await chatViaGeminiDirect(message, contents, image, clientMimeType);
          res.write(`data: ${JSON.stringify({ type: 'text', content: fullReply })}\n\n`);
        }

        if (fullReply) {
          await dbRun('INSERT INTO chat_messages (conversation_id, role, text) VALUES (?, ?, ?)', convId, 'ai', fullReply);
          await dbRun('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', convId);
          const historyCount = await dbAll("SELECT id FROM chat_messages WHERE conversation_id = ? AND role IN ('user', 'ai')", convId);
          if (historyCount.length <= 2) {
            await dbRun('UPDATE conversations SET title = ? WHERE id = ?', (message || 'Image analysis').substring(0, 80), convId);
          }
        }

        if (!clientDisconnected) {
          res.write(`data: ${JSON.stringify({ type: 'done', conversationId: convId, agent: agentName })}\n\n`);
          res.end();
        }
        return;
      }

      let reply: string;
      let agentName = 'gemini-direct';

      try {
        const adkResult = await chatViaADK(message || 'Analyze this image.', String(userId), adkSessionId, image, clientMimeType);
        reply = adkResult.reply;
        agentName = adkResult.agentName;

        if (!adkSessionId && adkResult.adkSessionId) {
          await dbRun('INSERT INTO chat_messages (conversation_id, role, text) VALUES (?, ?, ?)', convId, 'system', `adk_session:${adkResult.adkSessionId}`);
        }
        console.log(`[chat] ADK agent '${agentName}' handled request for conversation ${convId}`);
      } catch (adkErr: any) {
        console.log(`[chat] ADK unavailable (${adkErr.message}), falling back to direct Gemini`);
        const history = await dbAll(
          "SELECT role, text FROM chat_messages WHERE conversation_id = ? AND role IN ('user', 'ai') ORDER BY created_at ASC",
          convId
        );
        const contents = history.map((msg: any) => ({
          role: msg.role === 'ai' ? 'model' : 'user',
          parts: [{ text: msg.text }]
        }));
        reply = await chatViaGeminiDirect(message, contents, image, clientMimeType);
      }

      await dbRun('INSERT INTO chat_messages (conversation_id, role, text) VALUES (?, ?, ?)', convId, 'ai', reply);
      await dbRun('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', convId);

      const history = await dbAll("SELECT id FROM chat_messages WHERE conversation_id = ? AND role IN ('user', 'ai')", convId);
      if (history.length <= 2) {
        const title = (message || 'Image analysis').substring(0, 80);
        await dbRun('UPDATE conversations SET title = ? WHERE id = ?', title, convId);
      }

      res.json({ reply, conversationId: convId, agent: agentName });
    } catch (err: any) {
      console.error("Chat API Error:", err.message);
      res.status(500).json({ reply: "Sorry, I encountered an error processing your request." });
    }
  });

  app.post("/api/analyze-crop", isAuthenticated, async (req, res) => {
    try {
      const { zone_id, image } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is not configured." });
      }

      const zone = await dbGet('SELECT * FROM zones WHERE id = ?', zone_id);
      if (!zone) {
        return res.status(404).json({ error: "Zone not found." });
      }

      const ai = new GoogleGenAI({ apiKey });

      const plantingDate = new Date(zone.planting_date);
      const today = new Date();
      const growthDay = Math.ceil(Math.abs(today.getTime() - plantingDate.getTime()) / (1000 * 60 * 60 * 24));

      const prompt = `You are an expert agricultural AI analyzing a crop image for a farm in Malivundo, Pwani, Tanzania.

Zone: ${zone.name}
Crop: ${zone.crop_type}
Growth Day: ${growthDay}
Area: ${zone.area_size} acres

Analyze this image and provide:
1. **Health Assessment** - Overall plant health (Healthy/Warning/Critical)
2. **Pest Detection** - Check for common pests relevant to this crop (e.g., Tuta Absoluta for tomatoes, Thrips for onions, Fall Armyworm for maize, aphids, whitefly, etc.)
3. **Disease Signs** - Any visible diseases (blight, fungal infection, etc.)
4. **Growth Stage Confirmation** - Does the visual match the expected growth day?
5. **Recommendations** - Immediate actions needed

Be concise and actionable.`;

      const parts: any[] = [
        { inlineData: { mimeType: "image/jpeg", data: image } },
        { text: prompt }
      ];

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ parts }],
      });

      const analysisText = response.text || "Could not analyze the image.";

      await dbRun('INSERT INTO logs (zone_id, message, severity) VALUES (?, ?, ?)', zone_id, `Crop analysis performed: ${analysisText.substring(0, 200)}...`, 'Info');

      res.json({ analysis: analysisText, zone_name: zone.name });
    } catch (err: any) {
      console.error("Analyze Crop Error:", err.message);
      res.status(500).json({ error: "Failed to analyze crop image." });
    }
  });

  app.get("/api/gemini-session", isAuthenticated, (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured." });
    }
    res.json({ apiKey });
  });

  app.post("/api/engine/run-checks", isAuthenticated, async (req, res) => {
    const zones = await dbAll("SELECT * FROM zones WHERE status = 'Active'");
    const newTasks = [];

    let mockWeather: any;
    try {
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=-7.1&longitude=38.7&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code&timezone=Africa%2FDar_es_Salaam&forecast_days=7`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!weatherRes.ok) throw new Error(`Weather API returned ${weatherRes.status}`);
      const weatherData = await weatherRes.json() as any;
      if (!weatherData?.current || !weatherData?.daily) throw new Error('Invalid weather API response');

      const wmoCondition = (code: number) => {
        const map: Record<number, string> = {
          0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
          45: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
          61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
          80: 'Slight showers', 81: 'Moderate showers', 82: 'Heavy showers',
          95: 'Thunderstorm', 96: 'Thunderstorm with hail'
        };
        return map[code] || 'Unknown';
      };

      const daily = weatherData.daily || {};
      const forecast = [];
      const dates = daily.time || [];
      for (let i = 1; i < dates.length; i++) {
        const d = new Date(dates[i]);
        forecast.push({
          day: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
          high: Math.round(daily.temperature_2m_max?.[i] || 30),
          low: Math.round(daily.temperature_2m_min?.[i] || 22),
          condition: wmoCondition(daily.weather_code?.[i] || 0),
          rain: daily.precipitation_probability_max?.[i] || 0,
          precipitation_mm: daily.precipitation_sum?.[i] || 0,
        });
      }

      mockWeather = {
        current: {
          temp: weatherData.current?.temperature_2m || 28,
          condition: wmoCondition(weatherData.current?.weather_code || 0),
          humidity: weatherData.current?.relative_humidity_2m || 60,
          wind: weatherData.current?.wind_speed_10m || 12,
        },
        nextDay: {
          tempHigh: daily.temperature_2m_max?.[1] || 30,
          tempLow: daily.temperature_2m_min?.[1] || 22,
          forecastRain: daily.precipitation_sum?.[1] || 0,
          condition: wmoCondition(daily.weather_code?.[1] || 0),
        },
        forecast,
      };
    } catch (e) {
      console.warn('[weather] Open-Meteo fetch failed, using safe defaults:', (e as Error).message);
      mockWeather = {
        current: { temp: 29, condition: 'Data unavailable', humidity: 60, wind: 10 },
        nextDay: { tempHigh: 31, tempLow: 23, forecastRain: 0, condition: 'Data unavailable' },
        forecast: [],
        degraded: true,
      };
    }

    for (const zone of zones as any[]) {
      const plantingDate = new Date(zone.planting_date);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - plantingDate.getTime());
      const growthDay = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let irrigationNeeded = false;
      let duration = 60;
      let reasoning = "";

      const cropMaxDays: Record<string, number> = { 'Tomato': 120, 'Onion': 150, 'Pepper': 130, 'Cabbage': 100, 'Spinach': 50, 'Cucumber': 70, 'Watermelon': 90, 'Eggplant': 130, 'Carrot': 90, 'Lettuce': 65, 'Okra': 60, 'Green Bean': 60, 'Maize': 120 };
      const maxDays = cropMaxDays[zone.crop_type] || 120;
      const floweringStart = Math.round(maxDays * 0.33);
      const floweringEnd = Math.round(maxDays * 0.75);

      if (growthDay > floweringStart && growthDay < floweringEnd) {
        duration = 90;
        reasoning = "Flowering/Fruiting Stage Boost";
      }

      if (zone.crop_type === 'Onion' && growthDay > 100) {
        reasoning = "Dry-out period active. No irrigation.";
        irrigationNeeded = false;
      } else if (growthDay > maxDays) {
        reasoning = "Past harvest date. Review zone status.";
        irrigationNeeded = false;
      } else {
        irrigationNeeded = true;
      }

      if (mockWeather.nextDay.forecastRain > 3) {
        irrigationNeeded = false;
        reasoning = `RAIN DELAY: Forecast ${mockWeather.nextDay.forecastRain.toFixed(1)}mm rain.`;
      } else if (mockWeather.nextDay.tempHigh > 33) {
        duration = Math.round(duration * 1.2);
        reasoning = reasoning ? `${reasoning} - HEAT COMPENSATION: High ${mockWeather.nextDay.tempHigh.toFixed(1)}°C` : `HEAT COMPENSATION: High ${mockWeather.nextDay.tempHigh.toFixed(1)}°C`;
      }

      if (irrigationNeeded) {
        const now = new Date();
        const nextIrrigation = new Date(now);

        if (now.getHours() >= 6) {
          nextIrrigation.setDate(nextIrrigation.getDate() + 1);
        }
        nextIrrigation.setHours(6, 0, 0, 0);
        const scheduledTimeISO = nextIrrigation.toISOString();

        const finalReasoning = "I will send a whatsapp notification 10 minutes before i start irrigation.";

        const existingTask = await dbGet("SELECT * FROM tasks WHERE zone_id = ? AND task_type = 'Irrigation' AND status = 'Pending'", zone.id);

        if (existingTask && existingTask.scheduled_time === scheduledTimeISO) {
          await dbRun("UPDATE tasks SET reasoning = ?, duration_minutes = ? WHERE id = ?", finalReasoning, duration, existingTask.id);
        } else {
          await dbRun("DELETE FROM tasks WHERE zone_id = ? AND task_type = 'Irrigation' AND status = 'Pending'", zone.id);
          await dbRun('INSERT INTO tasks (zone_id, task_type, scheduled_time, duration_minutes, reasoning, status) VALUES (?, ?, ?, ?, ?, ?)', zone.id, 'Irrigation', scheduledTimeISO, duration, finalReasoning, 'Pending');
          newTasks.push({ zone: zone.name, type: 'Irrigation', duration, reasoning: finalReasoning });
        }
      }
    }

    res.json({
      status: "checked",
      weather: mockWeather,
      generatedTasks: newTasks
    });
  });

  const isProd = process.env.NODE_ENV === "production" || !!process.env.K_SERVICE;

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const fs = await import("fs");
    app.use(express.static(path.join(__dirname, "dist"), { index: false }));
    app.get("*", (req, res) => {
      let html = fs.readFileSync(path.join(__dirname, "dist", "index.html"), "utf-8");
      res.send(html);
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`App listening on port ${port}`);
  });
}

startServer().catch(err => {
  console.error('[startup] FATAL ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
