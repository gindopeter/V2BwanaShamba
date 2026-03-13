# Mkulima AI - Farm Operations Dashboard

A React + Express app for managing farm operations in Tanzania. It tracks crop zones, irrigation, tasks, and provides an AI-powered chatbot and live scouting tool.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: Express.js served via `server.ts` using `tsx`
- **Database**: SQLite via `better-sqlite3` (file: `farm.db`)
- **AI**: Google Gemini (`gemini-2.5-flash`) via `@google/genai`
- **Auth**: Admin-managed email/password login with bcryptjs + express-session (SQLite session store)

## Key Files

- `server.ts` — Express server (port 5000), serves Vite as middleware in dev, handles all API routes including auth
- `server/db.ts` — SQLite database setup, schema (zones, tasks, logs, users, sessions), migrations, and seed data
- `src/App.tsx` — Root component with auth state, navigation, and data loading
- `src/lib/api.ts` — Frontend API client with TypeScript interfaces
- `src/components/Login.tsx` — Email/password login form
- `src/components/Layout.tsx` — Sidebar layout with user profile (role badge) and logout button
- `src/components/SettingsPage.tsx` — Settings page: profile edit, password change, admin user management
- `src/components/LiveScout.tsx` — Camera/image/video upload + AI analysis + live voice (client-side Gemini)
- `src/components/Chatbot.tsx` — Floating AI assistant (server-side Gemini via `/api/chat`)

## API Routes

- `GET /api/health` — Health check
- `POST /api/auth/login` — Login with email + password
- `POST /api/auth/logout` — Logout and destroy session
- `GET /api/auth/user` — Get authenticated user (protected)
- `POST /api/auth/users` — Create a new user (admin only)
- `GET /api/auth/users` — List all users (admin only)
- `DELETE /api/auth/users/:id` — Delete a user (admin only)
- `PUT /api/auth/password` — Change own password (protected)
- `PUT /api/auth/profile` — Update own profile name (protected)
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

## Auth System

- Admin-managed accounts (no self-registration)
- Default admin: `admin@farm.co.tz` / `admin123` (seeded on first run)
- Passwords hashed with bcryptjs (10 rounds)
- Sessions stored in SQLite via better-sqlite3-session-store
- Admin users can create/list/delete other users via `/api/auth/users`
- User roles: `admin` or `user`

## Running

```bash
npm run dev   # starts tsx server.ts on port 5000
```

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
- **Live Scout** — Camera/image/video upload + AI crop analysis + live voice mode
- **Farm Map** — Visual map of farm zones
- **Chatbot** — AI assistant with access to all live farm data (zones, tasks, logs)
- **Task Engine** — Auto-generates irrigation tasks based on crop stage and mock weather

## Environment Variables

- `GEMINI_API_KEY` — Required for AI chat, crop analysis, and live voice features
- `SESSION_SECRET` — Optional (falls back to built-in default for dev)
