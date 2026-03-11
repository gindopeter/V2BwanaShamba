import 'dotenv/config';
import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import db from "./server/db.ts";
import session from "express-session";
import BetterSqlite3SessionStore from "better-sqlite3-session-store";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import type { RequestHandler } from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getFarmContext(): string {
  const zones = db.prepare('SELECT * FROM zones').all() as any[];
  const tasks = db.prepare('SELECT t.*, z.name as zone_name FROM tasks t JOIN zones z ON t.zone_id = z.id ORDER BY t.scheduled_time DESC LIMIT 20').all() as any[];
  const logs = db.prepare('SELECT l.*, z.name as zone_name FROM logs l LEFT JOIN zones z ON l.zone_id = z.id ORDER BY l.timestamp DESC LIMIT 10').all() as any[];

  const today = new Date();

  const zoneDetails = zones.map((z: any) => {
    const plantingDate = new Date(z.planting_date);
    const diffTime = Math.abs(today.getTime() - plantingDate.getTime());
    const growthDay = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const maxDays = z.crop_type === 'Tomato' ? 120 : 150;
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

const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.session?.userId) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

const isAdmin: RequestHandler = (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId) as any;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ message: "Forbidden: admin access required" });
  }
  next();
};

async function startServer() {
  const app = express();
  const port = process.env.PORT || 5000;

  app.use(express.json({ limit: '10mb' }));

  const SqliteStore = BetterSqlite3SessionStore(session);
  app.set("trust proxy", 1);
  app.use(session({
    secret: process.env.SESSION_SECRET || 'mkulima-farm-secret-key-change-in-production',
    store: new SqliteStore({ client: db, expired: { clear: true, intervalMs: 900000 } }),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 },
  }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/auth/login", (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ message: "Invalid email or password" });
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

  app.get("/api/auth/user", isAuthenticated, (req, res) => {
    const user = db.prepare('SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = ?').get(req.session.userId!) as any;
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    res.json(user);
  });

  app.post("/api/auth/users", isAdmin, (req, res) => {
    try {
      const { email, password, first_name, last_name, role } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) {
        return res.status(409).json({ message: "A user with this email already exists" });
      }
      const hash = bcrypt.hashSync(password, 10);
      const info = db.prepare('INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)').run(
        email, hash, first_name || null, last_name || null, role || 'user'
      );
      res.json({ id: info.lastInsertRowid, email, first_name, last_name, role: role || 'user' });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/users", isAdmin, (req, res) => {
    const users = db.prepare('SELECT id, email, first_name, last_name, role, created_at FROM users').all();
    res.json(users);
  });

  app.delete("/api/auth/users/:id", isAdmin, (req, res) => {
    const { id } = req.params;
    if (Number(id) === req.session.userId) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ success: true });
  });

  app.put("/api/auth/password", isAuthenticated, (req, res) => {
    try {
      const { current_password, new_password } = req.body;
      if (!current_password || !new_password) {
        return res.status(400).json({ message: "Current and new passwords are required" });
      }
      if (new_password.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId!) as any;
      if (!user || !bcrypt.compareSync(current_password, user.password_hash)) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
      const hash = bcrypt.hashSync(new_password, 10);
      db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, req.session.userId!);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/auth/profile", isAuthenticated, (req, res) => {
    try {
      const { first_name, last_name } = req.body;
      db.prepare('UPDATE users SET first_name = ?, last_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
        first_name || null, last_name || null, req.session.userId!
      );
      const user = db.prepare('SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = ?').get(req.session.userId!) as any;
      res.json(user);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // --- Zones API ---
  app.get("/api/zones", isAuthenticated, (req, res) => {
    const zones = db.prepare('SELECT * FROM zones').all();
    
    const zonesWithDetails = zones.map((zone: any) => {
      const plantingDate = new Date(zone.planting_date);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - plantingDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      // Calculate Harvest Date
      const harvestDays = zone.crop_type === 'Tomato' ? 120 : 150;
      const harvestDate = new Date(plantingDate);
      harvestDate.setDate(harvestDate.getDate() + harvestDays);

      // Get Next Fertigation Task
      const nextFertigation = db.prepare(`
        SELECT scheduled_time FROM tasks 
        WHERE zone_id = ? AND task_type = 'Fertigation' AND status = 'Pending' 
        ORDER BY scheduled_time ASC LIMIT 1
      `).get(zone.id) as any;

      // Yield Prediction Logic
      let baseYield = zone.crop_type === 'Tomato' ? 30000 : 15000;
      let predicted = zone.area_size * baseYield;
      if (!zone.expected_yield_kg) {
         predicted = predicted * (0.9 + Math.random() * 0.2);
      } else {
         predicted = zone.expected_yield_kg;
      }

      return { 
        ...zone, 
        current_growth_day: diffDays, 
        expected_yield_kg: Math.round(predicted),
        expected_harvest_date: harvestDate.toISOString(),
        next_fertigation_date: nextFertigation?.scheduled_time || null
      };
    });
    res.json(zonesWithDetails);
  });

  app.post("/api/zones", isAuthenticated, (req, res) => {
    const { name, crop_type, planting_date, area_size } = req.body;
    const stmt = db.prepare('INSERT INTO zones (name, crop_type, planting_date, area_size) VALUES (?, ?, ?, ?)');
    const info = stmt.run(name, crop_type, planting_date, area_size);
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/zones/:id/yield", isAuthenticated, (req, res) => {
    const { actual_yield_kg } = req.body;
    const { id } = req.params;
    const stmt = db.prepare('UPDATE zones SET actual_yield_kg = ?, status = ? WHERE id = ?');
    stmt.run(actual_yield_kg, 'Harvested', id);
    res.json({ success: true });
  });

  app.post("/api/zones/:id/irrigation", isAuthenticated, (req, res) => {
    const { status } = req.body; // 'Running' or 'Off'
    const { id } = req.params;
    
    if (!['Running', 'Off'].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const stmt = db.prepare('UPDATE zones SET irrigation_status = ? WHERE id = ?');
    stmt.run(status, id);
    
    // Log the action
    const logStmt = db.prepare('INSERT INTO logs (zone_id, message, severity) VALUES (?, ?, ?)');
    logStmt.run(id, `Irrigation turned ${status}`, 'Info');

    res.json({ success: true, status });
  });

  // --- Tasks API ---
  app.get("/api/tasks", isAuthenticated, (req, res) => {
    const tasks = db.prepare(`
      SELECT tasks.*, zones.name as zone_name, zones.crop_type 
      FROM tasks 
      JOIN zones ON tasks.zone_id = zones.id 
      ORDER BY scheduled_time ASC
    `).all();
    res.json(tasks);
  });

  app.post("/api/tasks", isAuthenticated, (req, res) => {
    const { zone_id, task_type, scheduled_time, duration_minutes, reasoning } = req.body;
    const stmt = db.prepare('INSERT INTO tasks (zone_id, task_type, scheduled_time, duration_minutes, reasoning) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(zone_id, task_type, scheduled_time, duration_minutes, reasoning);
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/tasks/:id/status", isAuthenticated, (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    const stmt = db.prepare('UPDATE tasks SET status = ? WHERE id = ?');
    stmt.run(status, id);
    res.json({ success: true });
  });

  // --- Chat API (Gemini) ---
  app.post("/api/chat", isAuthenticated, async (req, res) => {
    try {
      const { message, image, mimeType: clientMimeType } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ reply: "Gemini API key is not configured. Please add GEMINI_API_KEY to your secrets." });
      }

      const ai = new GoogleGenAI({ apiKey });

      const farmContext = getFarmContext();
      const systemInstruction = `You are 'Mkulima AI' (AI Farm Assistant) for a 5-acre tomato and onion farm in Malivundo, Pwani, Tanzania.
You help farmers with questions about crops, soil, pest control, irrigation, and fertigation.
You speak English and Kiswahili. If the user speaks Kiswahili, respond in Kiswahili.
Be concise, practical, and helpful. Use the live farm data below to give specific, accurate answers about zones, tasks, and conditions.

${farmContext}

Current Date: ${new Date().toISOString()}`;

      let parts: any[] = [];
      if (image) {
        parts.push({ inlineData: { mimeType: clientMimeType || "image/jpeg", data: image } });
      }
      parts.push({ text: message || "What do you see in this image?" });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ parts }],
        config: { systemInstruction }
      });

      res.json({ reply: response.text || "I could not generate a response." });
    } catch (err: any) {
      console.error("Chat API Error:", err.message);
      res.status(500).json({ reply: "Sorry, I encountered an error processing your request." });
    }
  });

  // --- Crop Analysis API (Gemini Vision) ---
  app.post("/api/analyze-crop", isAuthenticated, async (req, res) => {
    try {
      const { zone_id, image } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is not configured." });
      }

      const zone = db.prepare('SELECT * FROM zones WHERE id = ?').get(zone_id) as any;
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
2. **Pest Detection** - Check for Tuta Absoluta (tomato) or Thrips (onion) and other common pests
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

      const logStmt = db.prepare('INSERT INTO logs (zone_id, message, severity) VALUES (?, ?, ?)');
      logStmt.run(zone_id, `Crop analysis performed: ${analysisText.substring(0, 200)}...`, 'Info');

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

  // --- Simulation / Logic Trigger ---
  // In a real app, this would be a cron job. Here we trigger it manually or periodically from the frontend.
  app.post("/api/engine/run-checks", isAuthenticated, (req, res) => {
    // 1. Fetch active zones
    const zones = db.prepare("SELECT * FROM zones WHERE status = 'Active'").all() as any[];
    const newTasks = [];

    // Mock Weather Data (since we might not have a key yet)
    // In a real implementation, we'd fetch from OpenWeatherMap here
    const mockWeather = {
      current: {
        temp: 28 + Math.random() * 5, // 28-33C
        condition: Math.random() > 0.5 ? 'Sunny' : 'Partly Cloudy',
        humidity: 45 + Math.random() * 20,
        wind: 10 + Math.random() * 10,
      },
      nextDay: {
        tempHigh: 30 + Math.random() * 8, // 30-38C
        tempLow: 20 + Math.random() * 5,
        forecastRain: Math.random() * 5, // 0-5mm
        condition: Math.random() > 0.7 ? 'Rain' : 'Sunny',
      }
    };

    for (const zone of zones) {
      const plantingDate = new Date(zone.planting_date);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - plantingDate.getTime());
      const growthDay = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

      // Simple Logic Implementation based on spec
      let irrigationNeeded = false;
      let duration = 60;
      let reasoning = "";

      // Tomato Logic
      if (zone.crop_type === 'Tomato') {
        if (growthDay > 40 && growthDay < 90) { // Flowering/Fruiting
          duration = 90;
          reasoning = "Flowering Stage Boost";
        }
      }

      // Onion Logic
      if (zone.crop_type === 'Onion') {
        if (growthDay > 100) { // Harvest approach
           reasoning = "Dry-out period active. No irrigation.";
           irrigationNeeded = false;
        } else {
           irrigationNeeded = true;
        }
      } else {
        irrigationNeeded = true;
      }

      // Weather Adjustments
      if (mockWeather.nextDay.forecastRain > 3) {
        irrigationNeeded = false;
        reasoning = `RAIN DELAY: Forecast ${mockWeather.nextDay.forecastRain.toFixed(1)}mm rain.`;
        // Log the delay?
      } else if (mockWeather.nextDay.tempHigh > 33) {
        duration = Math.round(duration * 1.2);
        reasoning = reasoning ? `${reasoning} - HEAT COMPENSATION: High ${mockWeather.nextDay.tempHigh.toFixed(1)}°C` : `HEAT COMPENSATION: High ${mockWeather.nextDay.tempHigh.toFixed(1)}°C`;
      }

      if (irrigationNeeded) {
        // Calculate next 6:00 AM
        const now = new Date();
        const nextIrrigation = new Date(now);
        
        // If it's already past 6:00 AM today, schedule for tomorrow 6:00 AM
        if (now.getHours() >= 6) {
          nextIrrigation.setDate(nextIrrigation.getDate() + 1);
        }
        nextIrrigation.setHours(6, 0, 0, 0);
        const scheduledTimeISO = nextIrrigation.toISOString();
        
        const finalReasoning = "I will send a whatsapp notification 10 minutes before i start irrigation.";

        // Check if this exact task already exists
        const existing = db.prepare("SELECT * FROM tasks WHERE zone_id = ? AND task_type = 'Irrigation' AND status = 'Pending'").get(zone.id) as any;
        
        if (existing && existing.scheduled_time === scheduledTimeISO) {
          // Update reasoning and duration just in case
          db.prepare("UPDATE tasks SET reasoning = ?, duration_minutes = ? WHERE id = ?").run(finalReasoning, duration, existing.id);
        } else {
          // Clear old pending irrigation tasks for this zone
          db.prepare("DELETE FROM tasks WHERE zone_id = ? AND task_type = 'Irrigation' AND status = 'Pending'").run(zone.id);
          
          const stmt = db.prepare('INSERT INTO tasks (zone_id, task_type, scheduled_time, duration_minutes, reasoning, status) VALUES (?, ?, ?, ?, ?, ?)');
          stmt.run(zone.id, 'Irrigation', scheduledTimeISO, duration, finalReasoning, 'Pending');
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

  // Vite middleware for development
  const isProd = process.env.NODE_ENV === "production" || !!process.env.K_SERVICE;
  
  if (!isProd) {
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

startServer();
