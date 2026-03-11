# Mkulima AI - Farm Operations Dashboard

A React + Express app for managing farm operations in Tanzania. It tracks crop zones, irrigation, tasks, and provides an AI-powered chatbot and live scouting tool.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: Express.js served via `server.ts` using `tsx`
- **Database**: SQLite via `better-sqlite3` (file: `farm.db`)
- **AI**: Google Gemini via `@google/genai`

## Key Files

- `server.ts` — Express server (port 5000), serves Vite as middleware in dev, handles all API routes
- `server/db.ts` — SQLite database setup, schema, migrations, and seed data
- `src/App.tsx` — Root component with auth, navigation, and data loading
- `src/lib/api.ts` — Frontend API client with TypeScript interfaces
- `src/components/` — All UI components

## Running

```bash
npm run dev   # starts tsx server.ts on port 5000
```

## Features

- **Login** — Simple client-side auth gate
- **Dashboard** — Zone cards, task list, weather widget, yield/water stats
- **Live Scout** — Camera/image upload + AI crop analysis + live voice mode
- **Farm Map** — Visual map of farm zones
- **Chatbot** — Floating AI assistant (Gemini-powered)
- **Task Engine** — Auto-generates irrigation tasks based on crop stage and mock weather

## Environment Variables

- `GEMINI_API_KEY` — Required for AI chat and crop analysis features
