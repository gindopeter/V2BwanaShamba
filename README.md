# BwanaShamba V2

AI-powered farm operations platform for farmers across Tanzania. Any farmer can register, enter their own farm information, and manage their operations independently.

## Overview

BwanaShamba V2 is a public, multi-tenant platform. Each registered user has fully isolated farm data — zones, tasks, AI recommendations, and chat history are all scoped to the individual farmer's account.

## Features

- **Public Self-Registration** — Phone (SMS OTP) or email sign-up for any farmer in Tanzania
- **Bilingual** — Full English and Kiswahili support throughout
- **Per-User Farm Data** — Each farmer manages their own zones, tasks, and crop tracking independently
- **Farm Dashboard** — Manage crop zones with planting dates, growth tracking, and irrigation status
- **Task Management** — Create, schedule, and track farm tasks (Irrigation, Fertigation, Scouting)
- **AI Farm Assistant** — Chat with BwanaShamba AI (text, image analysis, live voice) for pest ID, irrigation advice, market prices, and more
- **AI Recommendations** — Personalized recommendations based on each user's actual farm data and region
- **Weather Forecast** — Live 7-day weather based on the user's registered region in Tanzania
- **Data Isolation** — Every user's zones, tasks, and AI context are strictly scoped to their account

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Express.js (TypeScript)
- **Database**: PostgreSQL (Cloud SQL) / SQLite (local development)
- **AI**: Google Gemini (chat, recommendations, image analysis) + Live API (voice)
- **ADK Agents**: Python-based specialist farm agents (pest, irrigation, task planner, market)
- **SMS OTP**: Africa's Talking

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set environment variables: `DATABASE_URL`, `GEMINI_API_KEY`, `AT_API_KEY`, `AT_USERNAME`
4. Start the development server: `npm run dev`

## Architecture

- Express server on port 5000 handles all API routes and serves the Vite frontend
- ADK Agent Service on port 8001 (Python, Google ADK) for multi-agent AI conversations
- Per-user data isolation enforced at the database query level on all zone/task endpoints
- Session-based authentication with PostgreSQL session store in production
- Weather data pulled from Open-Meteo using the user's registered region coordinates
