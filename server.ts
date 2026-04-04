import 'dotenv/config';
import http from 'http';
import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupLiveVoiceProxy } from './server/liveVoiceProxy.ts';

import { GoogleGenAI } from '@google/genai';
import { initDatabase, isPostgres, getSqliteDb, getPgPool, dbAll, dbGet } from './server/db.ts';
import { isAuthenticated } from './server/middleware/auth.ts';
import { TANZANIA_REGIONS } from './server/constants/regions.ts';
import { TANZANIA_DISTRICT_COORDS } from './server/constants/district_coords.ts';
import { getDaysToHarvest, getGrowthStage } from './server/constants/crops.ts';

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

  let sessionMiddleware: express.RequestHandler;

  if (isPostgres) {
    const connectPgSimple = (await import('connect-pg-simple')).default;
    const PgStore = connectPgSimple(session);
    sessionMiddleware = session({
      secret: sessionSecret,
      store: new PgStore({ pool: getPgPool(), createTableIfMissing: true }),
      resave: false,
      saveUninitialized: false,
      cookie: sessionCookieConfig,
    });
    app.use(sessionMiddleware);
    console.log('[startup] Using PostgreSQL session store');
  } else {
    const BetterSqlite3SessionStore = (await import('better-sqlite3-session-store')).default;
    const SqliteStore = BetterSqlite3SessionStore(session);
    sessionMiddleware = session({
      secret: sessionSecret,
      store: new SqliteStore({ client: getSqliteDb(), expired: { clear: true, intervalMs: 900000 } }),
      resave: false,
      saveUninitialized: false,
      cookie: sessionCookieConfig,
    });
    app.use(sessionMiddleware);
    console.log('[startup] Using SQLite session store');
  }

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: isPostgres ? 'postgresql' : 'sqlite' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/zones', zoneRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/chat', chatRoutes);

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

      const [userProfile, zones] = await Promise.all([
        dbGet('SELECT first_name, region, district, farm_size_acres FROM users WHERE id = ?', userId),
        dbAll(
          'SELECT id, name, crop_type, area_size, planting_date FROM zones WHERE user_id = ? AND status = ?',
          userId, 'Active'
        ),
      ]);

      if (!zones || zones.length === 0) {
        return res.json({ recommendations: [] });
      }

      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', {
        timeZone: 'Africa/Dar_es_Salaam',
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });

      // Compute precise growth age and stage for each zone
      const zoneDetails = zones.map((z: any) => {
        const planted = new Date(z.planting_date);
        const ageDay  = Math.max(1, Math.ceil((now.getTime() - planted.getTime()) / 86400000));
        const totalDays = getDaysToHarvest(z.crop_type);
        const daysLeft  = Math.max(0, totalDays - ageDay);
        const stage     = getGrowthStage(ageDay, totalDays);
        return { name: z.name, crop: z.crop_type, ageDay, totalDays, daysLeft, stage, area: z.area_size };
      });

      const farmer   = userProfile?.first_name || 'Farmer';
      const location = [
        userProfile?.district ? `${userProfile.district} District` : null,
        userProfile?.region   ? `${userProfile.region} Region`     : null,
        'Tanzania',
      ].filter(Boolean).join(', ');
      const farmSize = userProfile?.farm_size_acres || 'unknown';

      const zoneLines = zoneDetails.map(z =>
        `  • ${z.name} — ${z.crop}, Day ${z.ageDay} of ${z.totalDays} (${z.stage} stage, ${z.daysLeft} days to harvest, ${z.area} acres)`
      ).join('\n');

      const isSwahili = language === 'sw';

      const enPrompt = `You are a precision crop advisor for smallholder farms in Tanzania. Today is ${dateStr}.

FARM: ${farmer}, ${farmSize} acres, ${location}

ACTIVE ZONES — current growth day is exact:
${zoneLines}

CROP STAGE KNOWLEDGE (apply this per zone based on their exact stage):
• SEEDLING (0–25% of cycle): Apply starter fertilizer (DAP or NPK 17-17-17 at 30 kg/acre). Scout for cutworms, aphids, damping-off. Maintain moisture, avoid waterlogging. Thin overcrowded seedlings.
• VEGETATIVE (25–50%): Top-dress with CAN (60–80 kg/acre) or Urea for leafy growth. Weekly pest scouting (caterpillars, whitefly, spider mites, early blight). Critical weed control window.
• FLOWERING (50–75%): Switch to P/K fertilizer (MOP 40 kg/acre + TSP). Do NOT over-irrigate. Watch for flower drop, botrytis, powdery mildew. For tomato/pepper: scout for Tuta absoluta and bacterial wilt.
• NEAR HARVEST (75–100%): Stop all fertigation 14 days before harvest. Assess quality (brix, firmness, size). Plan market logistics and labour for harvest. Watch for post-harvest diseases.

TASK: Generate ${Math.min(6, Math.max(3, zoneDetails.length * 2))} specific, immediately-actionable recommendations.

RULES (strictly follow):
1. Every recommendation MUST reference the specific zone by name (e.g. "Kitalu A – Tomato").
2. Be precise: name the exact fertilizer, pest, disease, or technique — never generic advice.
3. Priority must reflect urgency: HIGH = critical timing or active threat; MEDIUM = should act this week; LOW = monitoring or planning.
4. Seedling and Flowering zones take priority — mistakes in these stages cost the whole crop.
5. Cover EVERY active zone — do not skip any.

Reply ONLY with valid JSON, no markdown, no code fences:
{"recommendations":[{"priority":"high|medium|low","icon":"emoji","title":"Zone – Action","description":"Specific detail with product/dose/timing"}]}`;

      const swPrompt = `Wewe ni mshauri wa kilimo cha usahihi kwa wakulima wadogo Tanzania. Leo ni ${dateStr}.

SHAMBA: ${farmer}, ekari ${farmSize}, ${location}

MAENEO YENYE MAZAO — siku ya ukuaji ni sahihi:
${zoneDetails.map(z => `  • ${z.name} — ${z.crop}, Siku ${z.ageDay} kati ya ${z.totalDays} (Hatua ya ${z.stage}, siku ${z.daysLeft} hadi mavuno, ekari ${z.area})`).join('\n')}

MAARIFA YA HATUA ZA UKUAJI:
• MCHE (0–25%): Weka mbolea ya kuanzia (DAP au NPK 17-17-17, kilo 30/ekari). Angalia wadudu wa udongo, vidukari, na ugonjwa wa kuoza. Weka unyevu, epuka maji mengi.
• UKUAJI (25–50%): Weka CAN (kilo 60–80/ekari). Angalia wadudu kila wiki. Palilia magugu.
• MAUA (50–75%): Badilisha hadi mbolea ya P/K (MOP kilo 40 + TSP). Usimwagilie sana. Angalia kuanguka kwa maua, ugonjwa wa ukungu.
• KARIBU NA MAVUNO (75–100%): Acha mbolea siku 14 kabla ya mavuno. Panga soko na wafanyakazi wa kuvuna.

KAZI: Toa mapendekezo ${Math.min(6, Math.max(3, zoneDetails.length * 2))} maalum kwa kila eneo.

KANUNI: Taja jina la eneo, toa ushauri maalum (dawa/mbolea/kipimo), weka kipaumbele sahihi.

Jibu kwa JSON tu, bila markdown:
{"recommendations":[{"priority":"high|medium|low","icon":"emoji","title":"Eneo – Hatua","description":"Maelezo maalum na bidhaa/kipimo/muda"}]}`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: isSwahili ? swPrompt : enPrompt }] }],
      });

      const raw = (result.text || '{}')
        .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(raw);

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

  const httpServer = http.createServer(app);
  setupLiveVoiceProxy(httpServer);

  httpServer.listen(port, () => {
    console.log(`[startup] Server running on port ${port}`);
  });
}

startServer().catch(err => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});
