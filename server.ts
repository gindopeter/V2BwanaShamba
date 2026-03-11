import 'dotenv/config';
import express from "express";
import { createServer as createViteServer } from "vite";
import db from "./server/db.ts";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 5000;

  // Increase payload limit for images
  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- Zones API ---
  app.get("/api/zones", (req, res) => {
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

  app.post("/api/zones", (req, res) => {
    const { name, crop_type, planting_date, area_size } = req.body;
    const stmt = db.prepare('INSERT INTO zones (name, crop_type, planting_date, area_size) VALUES (?, ?, ?, ?)');
    const info = stmt.run(name, crop_type, planting_date, area_size);
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/zones/:id/yield", (req, res) => {
    const { actual_yield_kg } = req.body;
    const { id } = req.params;
    const stmt = db.prepare('UPDATE zones SET actual_yield_kg = ?, status = ? WHERE id = ?');
    stmt.run(actual_yield_kg, 'Harvested', id);
    res.json({ success: true });
  });

  app.post("/api/zones/:id/irrigation", (req, res) => {
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
  app.get("/api/tasks", (req, res) => {
    const tasks = db.prepare(`
      SELECT tasks.*, zones.name as zone_name, zones.crop_type 
      FROM tasks 
      JOIN zones ON tasks.zone_id = zones.id 
      ORDER BY scheduled_time ASC
    `).all();
    res.json(tasks);
  });

  app.post("/api/tasks", (req, res) => {
    const { zone_id, task_type, scheduled_time, duration_minutes, reasoning } = req.body;
    const stmt = db.prepare('INSERT INTO tasks (zone_id, task_type, scheduled_time, duration_minutes, reasoning) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(zone_id, task_type, scheduled_time, duration_minutes, reasoning);
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/tasks/:id/status", (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    const stmt = db.prepare('UPDATE tasks SET status = ? WHERE id = ?');
    stmt.run(status, id);
    res.json({ success: true });
  });

  // --- Simulation / Logic Trigger ---
  // In a real app, this would be a cron job. Here we trigger it manually or periodically from the frontend.
  app.post("/api/engine/run-checks", (req, res) => {
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
      html = html.replace(
        '</head>',
        `<script>window.process = window.process || {}; window.process.env = window.process.env || {}; window.process.env.GEMINI_API_KEY = "${process.env.GEMINI_API_KEY || ''}";</script></head>`
      );
      res.send(html);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
