# BwanaShamba — AI-Powered Farm Operations Agent

## What Is BwanaShamba?

BwanaShamba is an intelligent farm operations dashboard built for a 5-acre mixed horticulture and maize farm in Malivundo, Pwani Region, Tanzania. It combines real-time farm monitoring, task management, and a team of AI agents that act as on-demand agricultural specialists — accessible through text chat, image analysis, and live voice conversations in both English and Kiswahili.

The name "BwanaShamba" means "Farm Manager" in Swahili.

---

## The Problem

Smallholder farmers in East Africa face a set of interconnected challenges that compound each other:

- **Pest and disease identification is slow and unreliable.** By the time a farmer identifies Tuta Absoluta on their tomatoes or Fall Armyworm in their maize, significant crop damage has already occurred. Access to agricultural extension officers is limited, and visual identification guides don't cover every scenario.

- **Irrigation and fertigation timing is guesswork.** Without weather-informed scheduling, farmers either over-water (wasting resources and causing root rot) or under-water (losing yield). Fertigation — applying fertilizer through irrigation — requires specific weather windows that are hard to track manually.

- **Farm operations lack coordination.** With multiple crop zones at different growth stages, tracking what needs to happen where and when becomes overwhelming. Tasks slip, scouting gets skipped, and harvest windows are missed.

- **Expert agricultural advice is expensive and inaccessible.** Getting a specialist to visit a coastal Tanzanian farm for pest advice, market timing, or irrigation recommendations involves significant cost, travel time, and availability constraints.

- **Language barriers limit technology adoption.** Most farm management tools are English-only, excluding the majority of Tanzanian farmers who operate primarily in Kiswahili.

---

## What BwanaShamba Does

### Farm Dashboard
A real-time operational view of the entire farm. At a glance, you see every crop zone with its current growth stage, irrigation status, upcoming tasks, recent activity logs, and a live 7-day weather forecast for Malivundo. Zone cards show progress through the crop lifecycle, water usage stats, and yield tracking.

### AI Multi-Agent System (Google ADK)
Instead of a single chatbot, BwanaShamba deploys a team of five specialized AI agents built on Google's Agent Development Kit, each with deep expertise:

- **Farm Supervisor** — The coordinator. Routes your questions to the right specialist, provides farm-wide summaries, and handles general queries about your operation.

- **Pest Scout** — Identifies pests and diseases from descriptions or photos. Covers 13+ common Tanzanian pests including Tuta Absoluta, Fall Armyworm, Whitefly, and Bacterial Wilt. Provides treatment recommendations and prevention strategies.

- **Irrigation Specialist** — Manages water schedules informed by real weather data. Checks the 7-day forecast before recommending fertigation windows, enforcing rules like no rain for 24-48 hours, wind under 15 km/h, and optimal morning application between 5:30-7:00 AM.

- **Task Planner** — Creates, prioritizes, and schedules farm tasks across all zones. Generates irrigation, fertigation, and scouting tasks based on crop growth stages and current weather conditions.

- **Market Specialist** — Advises on Kariakoo/Dar es Salaam market prices, harvest maturity signs for each crop, optimal selling timing, and post-harvest handling to minimize losses.

Each agent has direct access to real farm data — zones, tasks, logs, weather — so recommendations are grounded in what's actually happening on the farm, not generic advice.

### Live Voice Scout
A hands-free AI assistant designed for use in the field. Using the Gemini Live Audio API, farmers can speak directly to BwanaShamba while walking their fields — in English or Kiswahili — and get instant spoken responses. The system automatically matches whichever language you speak.

Key capabilities:
- **Real-time voice conversation** with natural speech interruption (VAD-based)
- **Camera integration** — point your phone at a crop and the AI sees what you see, analyzing for pests, diseases, or nutrient deficiencies in real time
- **Image and video upload** — snap a photo or record a clip for AI analysis
- **Transcript saving** — every voice session is transcribed (both your speech and the AI's responses) and saved to your conversation history for later review

### Crop Image Analysis
Upload a photo of any crop issue and get an AI-powered analysis identifying problems, suggesting treatments, and assessing severity. Works with all 13 horticulture crops grown on the farm plus maize.

### Task Management
An automated task engine that generates irrigation and scouting tasks based on crop growth stages and weather conditions. Tasks include scheduling, countdown timers, and status tracking across all zones.

### Multilingual Support
The entire AI system operates in both English and Kiswahili. It detects which language you're using — whether typing or speaking — and responds in the same language. Switch mid-conversation and it switches with you.

---

## How It's Built

### Architecture Overview

BwanaShamba runs as two coordinated services behind a single deployment:

```
Browser (React)  ──►  Express.js Server (Node.js)  ──►  ADK Agent Service (Python/FastAPI)
                              │                                    │
                              ▼                                    ▼
                     Cloud SQL (PostgreSQL)              Google Gemini 2.5 Flash
                              │
                              ▼
                     Open-Meteo Weather API
```

### Frontend
- **React 19** with TypeScript and Vite for fast builds
- **Tailwind CSS 4** for styling with a warm agricultural design palette (deep forest green, orange accents, cream backgrounds)
- **Google Fonts** — Instrument Sans (headings) and Lato (body text)
- Real-time SSE (Server-Sent Events) streaming for chat responses
- WebSocket-based live voice via the `@google/genai` client library

### Backend
- **Express.js** server handling REST API endpoints, authentication, and proxying chat requests to the ADK service
- **Session-based authentication** with bcrypt password hashing and admin-managed user accounts
- **Dual database mode** — PostgreSQL (Cloud SQL) in production, SQLite for local development, with an abstraction layer that auto-detects the environment

### AI Layer
- **Google Agent Development Kit (ADK)** — Python-based multi-agent framework running on FastAPI/Uvicorn
- **Gemini 2.5 Flash** as the underlying model for all agents
- Each agent has custom tools that query the farm database directly, so AI responses reflect actual farm state
- **Graceful fallback** — if the ADK service is unavailable, the Express server falls back to direct Gemini API calls with the same farm context

### Live Voice
- **Gemini Live Audio API** (`gemini-2.5-flash-native-audio-preview`) for real-time speech
- Client-side audio processing with Web Audio API (16kHz input, 24kHz output)
- Voice Activity Detection (VAD) for natural interruption handling
- Input/output transcription enabled for full transcript capture

### Weather Integration
- **Open-Meteo API** (free, no API key required) for real-time 7-day weather forecasts
- Location-specific data for Malivundo coordinates (-7.1, 38.7)
- Weather data feeds directly into AI agent recommendations for irrigation and fertigation timing

### Deployment
- **Google Cloud Run** with a multi-stage Docker build (Node.js builder + slim runtime with Node.js and Python)
- **Cloud SQL PostgreSQL 18** for persistent storage
- **Cloud Build** for CI/CD with environment variable substitution
- Single container runs both the Express server (port 8080) and ADK service (port 8001)

### Data Model
The PostgreSQL database stores:
- **Users and authentication** — admin-managed accounts with roles
- **Zones and crops** — farm parcels with crop type, planting dates, growth tracking, and irrigation status
- **Tasks and scheduling** — automated and manual farm tasks with status tracking
- **Activity logs** — historical record of all farm operations
- **Conversations and chat messages** — persistent AI chat and voice transcript history

---

## Crops Covered

BwanaShamba is configured for the specific crops grown on the Malivundo farm:

| Category | Crops |
|----------|-------|
| **Horticulture** | Tomatoes, Onions, Peppers, Cabbage, Spinach, Cucumbers, Watermelon, Eggplant, Carrots, Lettuce, Okra, Green Beans |
| **Staple** | Maize |

Each crop has specialized knowledge for pest identification, growth stage tracking, irrigation needs, harvest timing, and market pricing in Dar es Salaam markets.

---

## Live Instance

The application is deployed and running at: **https://bwanashamba-915832003385.europe-west1.run.app/**

---

## Repository

Source code: **https://github.com/gindopeter/BwanaShamba**
