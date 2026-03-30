# BwanaShamba V2 — AI-Powered Farm Operations Platform

## What Is BwanaShamba?

BwanaShamba is an intelligent farm operations platform for farmers across Tanzania. Any farmer can register with their phone number or email, enter their farm details, and start managing their operations — with AI-powered support for pest identification, irrigation scheduling, task planning, and market advice.

The name "BwanaShamba" means "Farm Manager" in Kiswahili.

---

## V2 Design Philosophy

BwanaShamba V2 is a public, multi-tenant platform. Unlike V1 (which was a single-farm dashboard for one specific farm), V2 is designed for any farmer in Tanzania:

- **Any farmer can register** — self-service via phone OTP or email
- **Each user manages their own farm** — zones, tasks, and AI context are fully isolated per account
- **No shared data** — one user cannot see or affect another user's farm
- **Location-aware** — weather and AI advice adapt to the user's registered region across all 26 Tanzania regions

---

## Core Features

### Farm Dashboard
A real-time operational view of the farmer's own zones. Each zone card shows the crop type, growth stage, irrigation status, and upcoming tasks. The dashboard header reflects the farmer's own location and farm size.

### Zone Management
Farmers create and manage their own crop zones with planting dates, area sizes, and crop types. The app supports 13 crops: Tomato, Onion, Pepper, Cabbage, Spinach, Cucumber, Watermelon, Eggplant, Carrot, Lettuce, Okra, Green Bean, and Maize.

### Task Management
Pending, confirmed, completed, and missed tasks — all tied to the farmer's own zones. Task types: Irrigation, Fertigation, Scouting.

### AI Farm Assistant
Farmers chat with BwanaShamba AI via text, photo upload, or live voice. The AI uses the farmer's actual zone data (crops, growth stage, region) to give contextual advice. Multi-agent system with specialists for:
- Pest identification and treatment
- Irrigation and fertigation scheduling
- Task planning with weather integration
- Market prices and harvest timing

### Weather Forecast
Live 7-day forecast from Open-Meteo, geo-located to the farmer's registered region.

### AI Recommendations
Personalized farm recommendations generated from the user's actual zones, tasks, and location.

---

## Registration & Authentication

- Phone registration with SMS OTP verification (Africa's Talking)
- Email registration with OTP (logged to console in development)
- Users provide: name, farm size, region, district, preferred language (English/Kiswahili)
- Sessions managed server-side with PostgreSQL session store

---

## Data Isolation

All database queries for zones, tasks, and AI context are filtered by `user_id`. No shared or seed data is visible to end users. Each farmer starts with an empty dashboard and builds their own farm profile.
