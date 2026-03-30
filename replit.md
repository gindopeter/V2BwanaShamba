# BwanaShamba V2 - Farm Operations Platform

A public multi-tenant React + Express app for farmers across Tanzania. Any farmer can register, manage their own zones, tasks, and irrigation, and get AI-powered advice.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: Express.js served via `server.ts` using `tsx` (port 5000)
- **AI Backend**: Google ADK (Agent Development Kit) multi-agent service via FastAPI/Uvicorn (port 8001)
- **Database**: Dual-mode — PostgreSQL (Cloud SQL) in production when `DATABASE_URL` is set, SQLite (`farm.db`) for local development
- **AI**: Google Gemini (`gemini-2.5-flash`) via Google ADK multi-agent framework + `@google/genai` for live voice. Covers all horticulture crops (tomato, onion, pepper, cabbage, spinach, cucumber, watermelon, eggplant, carrot, lettuce, okra, green bean) and maize.
- **Weather**: Open-Meteo API (free, no key) — real 7-day forecast based on user's registered region (lat/lon from `TANZANIA_REGIONS` constant, defaults to Dodoma), used by both dashboard and AI agents for fertigation timing
- **Auth**: Self-registration (email OR phone number) with bcryptjs + express-session. Login accepts email or phone via `WHERE email = ? OR phone_number = ?`
- **i18n**: Full EN/SW bilingual support via `src/lib/i18n.ts` — includes `TANZANIA_DISTRICTS` map (all 29 regions with districts), `CROP_NAMES_SW` Kiswahili crop names, `getCropName()` helper
- **Recommendations**: `/api/recommendations` endpoint calls Gemini with farm context (zones/tasks/region) and returns 3-4 AI-generated actionable recommendations. Displayed in `RecommendationsBlock.tsx` on the dashboard

## ADK Multi-Agent System

The AI chat is powered by Google's Agent Development Kit with a team of specialized agents:

- **farm_supervisor** (Root Agent) — Coordinates all other agents, handles general queries
- **pest_scout** — Pest identification, crop disease diagnosis, treatment recommendations
- **irrigation_agent** — Water management, irrigation schedules, fertigation advice
- **task_planner** — Task scheduling, prioritization, creates new farm tasks
- **market_agent** — Market prices, harvest timing, selling strategies

Each agent has access to specific tools that query the SQLite database directly. The root agent delegates to specialists based on the question type.

### ADK Files

- `adk_service/main.py` — FastAPI server exposing `/chat` and `/health` endpoints
- `adk_service/agents/farm_agents.py` — Agent definitions with instructions and tools
- `adk_service/tools/farm_tools.py` — Database query tools (zones, tasks, logs, pest info, market prices) + real 7-day weather forecast via Open-Meteo API with fertigation timing advice
- `adk_service/start.sh` — Startup script that sets environment variables

### ADK Fallback

If the ADK service is unavailable, the Node.js server falls back to direct Gemini API calls with the same farm context.

## Key Files

- `server.ts` — Thin Express entry point (port 5000): validates env, initialises DB, sets up sessions, mounts route modules, handles `/api/engine/run-checks` and weather, serves Vite as middleware in dev, static `dist/` in production
- `server/db.ts` — Database abstraction layer: auto-detects PostgreSQL (via `DATABASE_URL`) or SQLite, handles schema creation, migrations, and seed data. Exports async `dbAll`, `dbGet`, `dbRun`, `dbExec` methods.
- `server/middleware/auth.ts` — `isAuthenticated` and `isAdmin` Express middleware
- `server/constants/regions.ts` — `TANZANIA_REGIONS` lat/lon map for all 29 Tanzania regions
- `server/services/gemini.ts` — `getFarmContext`, `chatViaGeminiDirect`, `createEphemeralToken` (short-lived Live API token, never exposes raw key to browser)
- `server/services/adk.ts` — `chatViaADK`, `createADKStreamFetch` (ADK multi-agent service calls)
- `server/routes/auth.ts` — All `/api/auth/*` routes (login, logout, register, profile, password, user CRUD)
- `server/routes/zones.ts` — All `/api/zones/*` routes (CRUD, yield, irrigation)
- `server/routes/tasks.ts` — All `/api/tasks/*` routes (list, create, status update)
- `server/routes/chat.ts` — All `/api/chat/*` and `/api/conversations/*` routes (guest chat, authenticated chat+streaming, crop analysis, voice transcript, `/gemini-live-token` ephemeral token endpoint)
- `src/App.tsx` — Root component with auth state, navigation, data loading, and detail views (tasks, zones, weather forecast, water usage with per-zone/whole-farm reports)
- `src/components/ActionQueue.tsx` — "Upcoming Task" widget: shows 15min before scheduled time, countdown at 10min, cancel/override button
- `src/components/ZoneModal.tsx` — Add/Edit/Delete zone modal with loading states and error handling
- `src/lib/api.ts` — Frontend API client with TypeScript interfaces
- `src/components/Login.tsx` — Email/password login form
- `src/components/Layout.tsx` — Sidebar layout with user profile (role badge) and logout button
- `src/components/SettingsPage.tsx` — Settings page: profile edit, password change, admin user management (edit/deactivate/reactivate/soft-delete)
- `src/components/LiveScout.tsx` — AI Assistant: minimalist Claude-like chat + image/video upload + camera + live voice (client-side Gemini). Features: auto language switching (EN/SW), voice interruption (VAD-based), persistent conversation history with sidebar
- `src/components/Chatbot.tsx` — Floating AI assistant (server-side Gemini via `/api/chat`)

## API Routes

- `GET /api/health` — Health check
- `POST /api/auth/login` — Login with email + password
- `POST /api/auth/logout` — Logout and destroy session
- `GET /api/auth/user` — Get authenticated user (protected)
- `POST /api/auth/users` — Create a new user (admin only)
- `GET /api/auth/users` — List all users with is_active status (admin only)
- `PUT /api/auth/users/:id` — Edit user details (admin only)
- `PUT /api/auth/users/:id/status` — Activate/deactivate user (admin only)
- `DELETE /api/auth/users/:id` — Soft-delete user (sets is_active=0, appends _deleted_ to email; admin only)
- `PUT /api/auth/password` — Change own password (protected)
- `PUT /api/auth/profile` — Update own profile name (protected)
- `GET /api/zones` — List zones with computed growth data
- `POST /api/zones` — Create a zone
- `PUT /api/zones/:id` — Update a zone (name, crop type, planting date, area size, status)
- `DELETE /api/zones/:id` — Delete a zone and its associated tasks/logs
- `PATCH /api/zones/:id/yield` — Record harvest yield
- `POST /api/zones/:id/irrigation` — Toggle irrigation status
- `GET /api/tasks` — List all tasks
- `POST /api/tasks` — Create a task
- `PATCH /api/tasks/:id/status` — Update task status
- `GET /api/conversations` — List user's conversations
- `POST /api/conversations` — Create a new conversation
- `DELETE /api/conversations/:id` — Delete a conversation
- `GET /api/conversations/:id/messages` — Get messages for a conversation
- `POST /api/chat` — Chat via ADK multi-agent service (supports SSE streaming with `stream: true` in body; falls back to direct Gemini)
- `POST /api/analyze-crop` — Analyze crop image with Gemini Vision
- `GET /api/gemini-session` — Get API key for live voice sessions
- `POST /api/voice-transcript` — Save voice session transcript to database (with ownership validation)
- `POST /api/engine/run-checks` — Run irrigation scheduling engine

## Auth System

- **Public self-registration** — farmers register via phone (SMS OTP via Africa's Talking) or email
- Default admin: `admin@bwanashamba.com` / `admin123` (seeded on first run, role: admin, platform-level only)
- Passwords hashed with bcryptjs (10 rounds)
- Sessions stored in PostgreSQL (connect-pg-simple) in production, SQLite in development
- Admin users can create/list/edit/deactivate/delete other users via `/api/auth/users`
- User roles: `admin` or `user`
- All zone/task/log queries are scoped with `WHERE user_id = ?` for full per-user isolation

## Running

```bash
npm run dev   # starts Node.js server on port 5000
bash adk_service/start.sh  # starts ADK agent service on port 8001
```

Both services run as Replit workflows.

## Design

- **Theme**: Freshfield-inspired warm agricultural design
- **Fonts**: Instrument Sans (headings), Lato (body) — loaded from Google Fonts
- **Colors**: Deep forest green `#002c11` (sidebar/accents), primary green `#035925`, orange accent `#fc8e44`, warm cream `#f9f6f1` (backgrounds), muted text `#5d6c7b`
- **Login**: Split-screen — left 58% with drone video + overlay + hero text + stats, right 42% warm cream with form
- **Dashboard**: Dark green sidebar, cream main area, stat cards with colored left border, green zone cards with gradient progress bars, compact weather widget
- **Assets**: `public/assets/drone_farm_aerial.mp4` — AI-generated drone aerial video used on login

## Features

- **Auth** — Public self-registration (phone OTP or email) + admin-managed accounts
- **Dashboard** — Zone cards (with edit button), task list, weather widget, yield/water stats
- **Zone Management** — Add, edit, and delete zones from the Active Zones detail view
- **AI Assistant** — Multi-agent ADK-powered chat with SSE streaming responses, pest scout, irrigation, task planner, and market specialists
- **Live Scout** — Camera/image/video upload + AI crop analysis + live voice mode with transcript saving (both user speech and AI responses saved to conversation history via Gemini inputTranscription/outputTranscription)
- **The Farm** — Farm overview with allocation bar, active/inactive acreage stats, and full zone management (add/edit/delete)
- **Chatbot** — AI assistant with access to all live farm data (zones, tasks, logs)
- **Task Engine** — Auto-generates irrigation tasks based on crop stage and mock weather

## Deployment (Google Cloud Run)

- **Dockerfile** — Multi-stage build: Node.js builder for Vite frontend, slim runtime with Node.js + Python
- **docker-start.sh** — Starts ADK (port 8001) + Node.js (port 8080) with signal handling
- **cloudbuild.yaml** — Cloud Build config with Cloud SQL connection
- Domain: `bwanashamba.com`

### Cloud Run Environment Variables

- `GEMINI_API_KEY` — Required for AI chat, crop analysis, and live voice features
- `SESSION_SECRET` — Required in production (random string for session encryption)
- `DATABASE_URL` — PostgreSQL connection string (e.g., `postgresql://user:pass@/bwanashamba?host=/cloudsql/PROJECT:REGION:INSTANCE`)
- `DB_SSL` — Set to `false` when using Cloud SQL Unix socket (default: SSL enabled)
- `ADK_SERVICE_URL` — Optional (defaults to `http://localhost:8001`)
- `ADK_INTERNAL_TOKEN` — Token for ADK service auth (set matching value on both services)

### Local Development Environment Variables

- `GEMINI_API_KEY` — Required
- `DATABASE_URL` — If set, uses PostgreSQL; if unset, uses SQLite (`farm.db`)
- `SESSION_SECRET` — Optional (has dev fallback)

## Planned Features (Not Yet Implemented)

- **WhatsApp Notifications (Twilio)** — Irrigation & task alerts via WhatsApp. Requires Twilio account setup:
  - Needs secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (sandbox number)
  - User's phone number to be stored in settings
  - Alert types: irrigation start/stop, pending task reminders, weather warnings
