# BwanaShamba - Farm Operations Dashboard

A React + Express app for managing farm operations in Tanzania. It tracks crop zones, irrigation, tasks, and provides an AI-powered multi-agent chatbot and live scouting tool.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: Express.js served via `server.ts` using `tsx` (port 5000)
- **AI Backend**: Google ADK (Agent Development Kit) multi-agent service via FastAPI/Uvicorn (port 8001)
- **Database**: SQLite via `better-sqlite3` (file: `farm.db`)
- **AI**: Google Gemini (`gemini-2.5-flash`) via Google ADK multi-agent framework + `@google/genai` for live voice
- **Weather**: Open-Meteo API (free, no key) — real 7-day forecast for Malivundo (-7.1, 38.7), used by both dashboard and AI agents for fertigation timing
- **Auth**: Admin-managed email/password login with bcryptjs + express-session (SQLite session store)

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

- `server.ts` — Express server (port 5000), serves Vite as middleware in dev, handles all API routes including auth, proxies chat to ADK service
- `server/db.ts` — SQLite database setup, schema (zones, tasks, logs, users, sessions), migrations, and seed data
- `src/App.tsx` — Root component with auth state, navigation, data loading, and detail views (tasks, zones, weather forecast, water usage with per-zone/whole-farm reports)
- `src/components/ActionQueue.tsx` — "Upcoming Task" widget: shows 15min before scheduled time, countdown at 10min, cancel/override button
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
- `PATCH /api/zones/:id/yield` — Record harvest yield
- `POST /api/zones/:id/irrigation` — Toggle irrigation status
- `GET /api/tasks` — List all tasks
- `POST /api/tasks` — Create a task
- `PATCH /api/tasks/:id/status` — Update task status
- `GET /api/conversations` — List user's conversations
- `POST /api/conversations` — Create a new conversation
- `DELETE /api/conversations/:id` — Delete a conversation
- `GET /api/conversations/:id/messages` — Get messages for a conversation
- `POST /api/chat` — Chat via ADK multi-agent service (falls back to direct Gemini)
- `POST /api/analyze-crop` — Analyze crop image with Gemini Vision
- `GET /api/gemini-session` — Get API key for live voice sessions
- `POST /api/engine/run-checks` — Run irrigation scheduling engine

## Auth System

- Admin-managed accounts (no self-registration)
- Default admin: `admin@farm.co.tz` / `admin123` (seeded on first run)
- Passwords hashed with bcryptjs (10 rounds)
- Sessions stored in SQLite via better-sqlite3-session-store
- Admin users can create/list/delete other users via `/api/auth/users`
- User roles: `admin` or `user`

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

- **Auth** — Admin-managed email/password login (no self-registration)
- **Dashboard** — Zone cards, task list, weather widget, yield/water stats
- **AI Assistant** — Multi-agent ADK-powered chat with pest scout, irrigation, task planner, and market specialists
- **Live Scout** — Camera/image/video upload + AI crop analysis + live voice mode
- **Farm Map** — Visual map of farm zones
- **Chatbot** — AI assistant with access to all live farm data (zones, tasks, logs)
- **Task Engine** — Auto-generates irrigation tasks based on crop stage and mock weather

## Environment Variables

- `GEMINI_API_KEY` — Required for AI chat, crop analysis, and live voice features
- `SESSION_SECRET` — Optional (falls back to built-in default for dev)
- `ADK_SERVICE_URL` — Optional (defaults to `http://localhost:8001`)

## Planned Features (Not Yet Implemented)

- **WhatsApp Notifications (Twilio)** — Irrigation & task alerts via WhatsApp. Requires Twilio account setup:
  - Needs secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (sandbox number)
  - User's phone number to be stored in settings
  - Alert types: irrigation start/stop, pending task reminders, weather warnings
