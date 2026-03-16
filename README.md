# BwanaShamba

AI-powered farm operations dashboard for a 5-acre mixed horticulture/maize farm in Malivundo, Pwani, Tanzania.

## Features

- **AI Multi-Agent System** — Google ADK with specialized agents for pest scouting, irrigation planning, task management, and market intelligence
- **Live Voice Scout** — Real-time camera + AI crop analysis with voice interaction
- **13 Crop Support** — Tomato, Onion, Pepper, Cabbage, Spinach, Cucumber, Watermelon, Eggplant, Carrot, Lettuce, Okra, Green Bean, Maize
- **Farm Overview** — Visual allocation bar, active/inactive acreage tracking, zone management (CRUD)
- **Task Scheduling** — Auto-generated irrigation tasks based on crop stage and weather
- **Weather Integration** — Live 7-day forecast from Open-Meteo for Malivundo
- **Multilingual** — English and Swahili support
- **Mobile Responsive** — Optimized for field use on mobile devices

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: Express.js + TypeScript (tsx)
- **AI**: Google ADK (Agent Development Kit) + Gemini 2.5 Flash
- **Database**: PostgreSQL (Cloud SQL) in production, SQLite for local development
- **Deployment**: Google Cloud Run with Cloud Build

## Local Development

**Prerequisites:** Node.js 22+, Python 3.11+

1. Clone and install dependencies:
   ```bash
   npm install
   pip install -r requirements.txt
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

3. Set your `GEMINI_API_KEY` in `.env.local`

4. Start the development server:
   ```bash
   npm run dev
   ```

5. (Optional) Start the ADK agent service:
   ```bash
   bash adk_service/start.sh
   ```

The app runs on `http://localhost:5000`. Default login: `admin@bwanashamba.com` / `admin123`

## Deploy to Google Cloud Run

1. Set up a Cloud SQL PostgreSQL instance
2. Update `cloudbuild.yaml` with your Cloud SQL instance connection name
3. Set required environment variables in Cloud Run:
   - `GEMINI_API_KEY`
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `DB_SSL=false`
4. Deploy:
   ```bash
   gcloud builds submit --config cloudbuild.yaml
   ```

## Reproducible Testing Instructions

### Prerequisites
- Node.js 22+ and Python 3.11+ installed
- A valid `GEMINI_API_KEY` (Google AI Studio)
- Chrome or Edge browser (required for voice features)
- Microphone and speaker/headphones

### 1. Authentication
1. Open the app at `http://localhost:5000` (local) or your Cloud Run URL
2. Login with: `admin@bwanashamba.com` / `admin123`
3. **Expected**: Dashboard loads with farm overview, weather widget, and zone cards

### 2. Dashboard & Farm Overview
1. Verify the allocation bar shows crop distribution across zones
2. Check the weather widget displays 7-day forecast for Malivundo
3. Click any zone card to view zone details
4. **Expected**: All data renders correctly, weather shows real Open-Meteo data

### 3. Zone Management (CRUD)
1. Click **"Add Zone"** → fill in zone name, size, crop type → Save
2. Verify the new zone appears in the dashboard
3. Click the zone → **Edit** → change crop or size → Save
4. Click the zone → **Delete** → confirm deletion
5. **Expected**: Create, Read, Update, Delete all work; changes persist after page refresh

### 4. AI Chat (Multi-Agent)
1. Navigate to **AI Chat** from the sidebar
2. Type: "What pests should I watch for on my tomato crops?"
3. Wait for the AI response (streamed via SSE)
4. Type: "When should I irrigate zone A?"
5. **Expected**: AI responds with contextual farm advice; conversation appears in sidebar history

### 5. Live Voice Scout
1. Navigate to **AI Chat** → click the **microphone icon** to start a live voice session
2. Grant microphone permission when prompted
3. Speak in English or Swahili (e.g., "Habari, nataka kujua kuhusu umwagiliaji")
4. Listen for the AI's spoken audio response
5. Observe the chat area:
   - **Your speech** appears on the **right side** (user bubble)
   - **AI thinking topics** appear on the **left side** (e.g., "Assessing Irrigation Needs")
   - **AI spoken words** appear on the **left side** after the AI finishes speaking
6. End the voice session by clicking the stop button
7. **Expected**: Transcript is saved automatically; a "Voice Scout" conversation appears in sidebar history

### 6. Camera + Crop Analysis
1. Start a live voice session (step 5 above)
2. Click the **camera icon** to enable the camera
3. Point the camera at a plant or crop image on screen
4. Speak: "What do you see? Are there any issues?"
5. **Expected**: AI analyzes the camera frame and responds with observations about the crop

### 7. Conversation History
1. After completing voice or chat sessions, check the **sidebar**
2. Click any previous conversation to reload its messages
3. **Expected**: Full conversation history including voice transcripts is preserved

### 8. Irrigation Engine
1. Navigate to the **Tasks** section
2. Check for auto-generated irrigation tasks
3. **Expected**: Tasks are generated based on crop stages and current weather conditions

### 9. Multilingual Support
1. Switch language to **Swahili** using the language toggle
2. Verify UI labels change to Swahili
3. AI Chat and Voice Scout both accept Swahili input
4. **Expected**: Interface and AI responses work in both English and Swahili

### 10. Production Deployment Verification
1. Access the Cloud Run URL: `https://bwanashamba-915832003385.europe-west1.run.app/`
2. Repeat tests 1-9 above on the production URL
3. **Expected**: All features work identically to local development

### Troubleshooting
- **Voice not working**: Ensure you're using Chrome/Edge; Safari has limited SpeechRecognition support
- **No AI response**: Check that `GEMINI_API_KEY` is set correctly in environment variables
- **Database errors**: Verify `DATABASE_URL` points to a valid PostgreSQL instance (production) or that SQLite file is writable (local)
- **ADK agents not responding**: Ensure the ADK service is running on port 8001 (`bash adk_service/start.sh`)

## Contact

gindopeter@gmail.com
