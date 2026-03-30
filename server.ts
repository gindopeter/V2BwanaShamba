import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

import { initDatabase, isPostgres, getSqliteDb, getPgPool, dbAll, dbGet } from './server/db.ts';
import { isAuthenticated } from './server/middleware/auth.ts';
import { TANZANIA_REGIONS } from './server/constants/regions.ts';
import { TANZANIA_DISTRICT_COORDS } from './server/constants/district_coords.ts';

import authRoutes from './server/routes/auth.ts';
import zoneRoutes from './server/routes/zones.ts';
import taskRoutes from './server/routes/tasks.ts';
import chatRoutes from './server/routes/chat.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function validateEnvironment() {
  const errors: string[] = [];

  if (!process.env.GEMINI_API_KEY) {
    errors.push('GEMINI_API_KEY is required');
  }

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.SESSION_SECRET) {
      errors.push('SESSION_SECRET is required in production');
    }
    if (!process.env.ADK_INTERNAL_TOKEN) {
      console.warn('[startup] WARNING: ADK_INTERNAL_TOKEN not set — ADK agents disabled, using direct Gemini fallback');
    }
    if (!process.env.DATABASE_URL) {
      errors.push('DATABASE_URL is required in production');
    }
  }

  if (errors.length > 0) {
    console.error('[startup] FATAL: Missing required environment variables:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
}

async function startServer() {
  validateEnvironment();

  console.log(`[startup] NODE_ENV=${process.env.NODE_ENV}, PORT=${process.env.PORT || 5000}, CWD=${process.cwd()}`);

  await initDatabase();

  const app = express();
  const port = process.env.PORT || 5000;

  app.use('/api/chat', express.json({ limit: '100mb' }));
  app.use('/api/chat', express.urlencoded({ extended: true, limit: '100mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.set('trust proxy', 1);

  const sessionSecret =
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV !== 'production'
      ? 'dev-only-secret-not-for-production'
      : (() => { throw new Error('SESSION_SECRET must be set in production'); })());

  const sessionCookieConfig = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  if (isPostgres) {
    const connectPgSimple = (await import('connect-pg-simple')).default;
    const PgStore = connectPgSimple(session);
    app.use(
      session({
        secret: sessionSecret,
        store: new PgStore({ pool: getPgPool(), createTableIfMissing: true }),
        resave: false,
        saveUninitialized: false,
        cookie: sessionCookieConfig,
      })
    );
    console.log('[startup] Using PostgreSQL session store');
  } else {
    const BetterSqlite3SessionStore = (await import('better-sqlite3-session-store')).default;
    const SqliteStore = BetterSqlite3SessionStore(session);
    app.use(
      session({
        secret: sessionSecret,
        store: new SqliteStore({ client: getSqliteDb(), expired: { clear: true, intervalMs: 900000 } }),
        resave: false,
        saveUninitialized: false,
        cookie: sessionCookieConfig,
      })
    );
    console.log('[startup] Using SQLite session store');
  }

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: isPostgres ? 'postgresql' : 'sqlite' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/zones', zoneRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/conversations', chatRoutes);

  app.post('/api/engine/run-checks', isAuthenticated, async (req, res) => {
    const userId = req.session.userId!;
    const zones = await dbAll(
      "SELECT * FROM zones WHERE status = 'Active' AND user_id = ?",
      userId
    );

    const userProfile = await dbGet('SELECT region, district FROM users WHERE id = ?', userId);
    const userRegion = userProfile?.region || '';
    const userDistrict = userProfile?.district || '';

    // Use district-level coords if available, fall back to region, then Dodoma
    const districtCoords = userRegion && userDistrict
      ? TANZANIA_DISTRICT_COORDS[userRegion]?.[userDistrict]
      : undefined;
    const regionCoords = userRegion ? TANZANIA_REGIONS[userRegion] : undefined;
    const coords = districtCoords || regionCoords || TANZANIA_REGIONS['Dodoma'];

    const locationLabel = userDistrict && userRegion
      ? `${userDistrict}, ${userRegion}`
      : userRegion || 'Tanzania';

    let weather: any;

    try {
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code&timezone=Africa%2FDar_es_Salaam&forecast_days=7`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!weatherRes.ok) throw new Error(`Weather API returned ${weatherRes.status}`);

      const weatherData = (await weatherRes.json()) as any;
      if (!weatherData?.current || !weatherData?.daily) throw new Error('Invalid weather response');

      const wmoCondition = (code: number) => {
        const map: Record<number, string> = {
          0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
          45: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
          61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
          80: 'Slight showers', 81: 'Moderate showers', 82: 'Heavy showers',
          95: 'Thunderstorm', 96: 'Thunderstorm with hail',
        };
        return map[code] || 'Unknown';
      };

      const daily = weatherData.daily || {};
      const dates = daily.time || [];
      const forecast = [];
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

      weather = {
        location: locationLabel,
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
      weather = {
        location: locationLabel,
        current: { temp: 29, condition: 'Data unavailable', humidity: 60, wind: 10 },
        nextDay: { tempHigh: 31, tempLow: 23, forecastRain: 0, condition: 'Data unavailable' },
        forecast: [],
        degraded: true,
      };
    }

    res.json({ status: 'checked', weather, zones_checked: zones.length });
  });

  app.post('/api/recommendations', isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const language: string = req.body?.language || 'en';

      const [userProfile, zones, tasks] = await Promise.all([
        dbGet('SELECT first_name, region, district, farm_size_acres FROM users WHERE id = ?', userId),
        dbAll('SELECT name, crop_type, area_size, current_growth_day FROM zones WHERE user_id = ? AND status = ?', userId, 'Active'),
        dbAll("SELECT task_type, scheduled_time, status FROM tasks WHERE zone_id IN (SELECT id FROM zones WHERE user_id = ?) AND status = 'Pending' ORDER BY scheduled_time ASC LIMIT 5", userId),
      ]);

      const farmContext = {
        farmer: userProfile?.first_name || 'Farmer',
        region: userProfile?.region || 'Tanzania',
        farmSize: userProfile?.farm_size_acres || 'Unknown',
        zones: zones.map((z: any) => `${z.name} (${z.crop_type}, day ${z.current_growth_day}, ${z.area_size} acres)`).join('; ') || 'No active zones',
        pendingTasks: tasks.map((t: any) => `${t.task_type} on ${new Date(t.scheduled_time).toLocaleDateString()}`).join('; ') || 'No pending tasks',
      };

      const isSwahili = language === 'sw';
      const prompt = isSwahili
        ? `Wewe ni mshauri wa kilimo bora wa Tanzania. Mkulima ${farmContext.farmer} ana shamba la ${farmContext.farmSize} ekari katika ${farmContext.region}. Maeneo yenye mazao: ${farmContext.zones}. Kazi zinazosubiri: ${farmContext.pendingTasks}.\n\nToa mapendekezo 3-4 ya vitendo vya haraka kwa mkulima huyu. Jibu kwa JSON tu:\n{"recommendations": [{"priority": "high|medium|low", "icon": "emoji", "title": "kichwa kifupi", "description": "maelezo fupi"}]}`
        : `You are a top agricultural advisor for Tanzania. Farmer ${farmContext.farmer} has a ${farmContext.farmSize}-acre farm in ${farmContext.region}. Active zones: ${farmContext.zones}. Pending tasks: ${farmContext.pendingTasks}.\n\nProvide 3-4 specific, actionable recommendations. Reply ONLY with JSON:\n{"recommendations": [{"priority": "high|medium|low", "icon": "emoji", "title": "short title", "description": "brief description"}]}`;

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(text);

      res.json({ recommendations: parsed.recommendations || [] });
    } catch (err: any) {
      console.error('[recommendations] error:', err.message);
      res.status(500).json({ recommendations: [] });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, () => {
    console.log(`[startup] Server running on port ${port}`);
  });
}

startServer().catch(err => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});
