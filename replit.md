# Mkulima AI - Farm Operations Dashboard

A React + Express app for managing farm operations in Tanzania. It tracks crop zones, irrigation, tasks, and provides an AI-powered chatbot and live scouting tool.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: Express.js served via `server.ts` using `tsx`
- **Database**: SQLite via `better-sqlite3` (file: `farm.db`)
- **AI**: Google Gemini (`gemini-2.5-flash`) via `@google/genai`

## Key Files

- `server.ts` — Express server (port 5000), serves Vite as middleware in dev, handles all API routes including `/api/chat` and `/api/analyze-crop`
- `server/db.ts` — SQLite database setup, schema, migrations, and seed data
- `src/App.tsx` — Root component with auth, navigation, and data loading
- `src/lib/api.ts` — Frontend API client with TypeScript interfaces
- `src/components/LiveScout.tsx` — Camera/image/video upload + AI analysis + live voice (client-side Gemini)
- `src/components/Chatbot.tsx` — Floating AI assistant (server-side Gemini via `/api/chat`)
- `src/components/` — All UI components

## API Routes

- `GET /api/health` — Health check
- `GET /api/zones` — List zones with computed growth data
- `POST /api/zones` — Create a zone
- `PATCH /api/zones/:id/yield` — Record harvest yield
- `POST /api/zones/:id/irrigation` — Toggle irrigation status
- `GET /api/tasks` — List all tasks
- `POST /api/tasks` — Create a task
- `PATCH /api/tasks/:id/status` — Update task status
- `POST /api/chat` — Chat with Gemini AI (server-side, supports text + image)
- `POST /api/analyze-crop` — Analyze crop image with Gemini Vision (server-side)
- `POST /api/engine/run-checks` — Run irrigation scheduling engine

## Running

```bash
npm run dev   # starts tsx server.ts on port 5000
```

## Features

- **Login** — Simple client-side auth gate
- **Dashboard** — Zone cards, task list, weather widget, yield/water stats
- **Live Scout** — Camera/image/video upload + AI crop analysis + live voice mode (uses Gemini Live API)
- **Farm Map** — Visual map of farm zones
- **Chatbot** — Floating AI assistant (Gemini-powered via server)
- **Task Engine** — Auto-generates irrigation tasks based on crop stage and mock weather

## Environment Variables

- `GEMINI_API_KEY` — Required for AI chat, crop analysis, and live voice features
