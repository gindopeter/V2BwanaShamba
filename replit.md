# Mkulima AI - Farm Operations Dashboard

A React + Express app for managing farm operations in Tanzania. It tracks crop zones, irrigation, tasks, and provides an AI-powered chatbot and live scouting tool.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: Express.js served via `server.ts` using `tsx`
- **Database**: SQLite via `better-sqlite3` (file: `farm.db`)
- **AI**: Google Gemini (`gemini-2.5-flash`) via `@google/genai`
- **Auth**: Replit Auth (OpenID Connect) via passport + express-session (SQLite session store)

## Key Files

- `server.ts` — Express server (port 5000), serves Vite as middleware in dev, handles all API routes
- `server/db.ts` — SQLite database setup, schema (zones, tasks, logs, users, sessions), migrations, and seed data
- `server/replit_integrations/auth/` — Replit Auth module (OIDC + passport + SQLite sessions)
- `src/App.tsx` — Root component with Replit Auth, navigation, and data loading
- `src/lib/api.ts` — Frontend API client with TypeScript interfaces
- `src/components/Login.tsx` — Landing page with "Log In with Replit" button
- `src/components/Layout.tsx` — Sidebar layout with user profile and logout
- `src/components/LiveScout.tsx` — Camera/image/video upload + AI analysis + live voice (client-side Gemini)
- `src/components/Chatbot.tsx` — Floating AI assistant (server-side Gemini via `/api/chat`)

## API Routes

- `GET /api/health` — Health check
- `GET /api/login` — Replit Auth login flow
- `GET /api/callback` — OIDC callback
- `GET /api/logout` — Logout and end session
- `GET /api/auth/user` — Get authenticated user (protected)
- `GET /api/zones` — List zones with computed growth data
- `POST /api/zones` — Create a zone
- `PATCH /api/zones/:id/yield` — Record harvest yield
- `POST /api/zones/:id/irrigation` — Toggle irrigation status
- `GET /api/tasks` — List all tasks
- `POST /api/tasks` — Create a task
- `PATCH /api/tasks/:id/status` — Update task status
- `POST /api/chat` — Chat with Gemini AI (includes live farm data context)
- `POST /api/analyze-crop` — Analyze crop image with Gemini Vision
- `GET /api/gemini-session` — Get API key for live voice sessions
- `POST /api/engine/run-checks` — Run irrigation scheduling engine

## Running

```bash
npm run dev   # starts tsx server.ts on port 5000
```

## Features

- **Auth** — Replit Auth (Google, GitHub, email via Replit OIDC)
- **Dashboard** — Zone cards, task list, weather widget, yield/water stats
- **Live Scout** — Camera/image/video upload + AI crop analysis + live voice mode
- **Farm Map** — Visual map of farm zones
- **Chatbot** — AI assistant with access to all live farm data (zones, tasks, logs)
- **Task Engine** — Auto-generates irrigation tasks based on crop stage and mock weather

## Environment Variables

- `GEMINI_API_KEY` — Required for AI chat, crop analysis, and live voice features
- `SESSION_SECRET` — Automatically provided by Replit for session encryption
- `REPL_ID` — Automatically provided by Replit for OIDC client ID
