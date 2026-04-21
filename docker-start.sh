#!/bin/bash

if [ -n "$GEMINI_API_KEY" ] && [ -z "$GOOGLE_API_KEY" ]; then
    export GOOGLE_API_KEY="$GEMINI_API_KEY"
fi

echo "[docker] Starting ADK Agent Service in background on port ${ADK_PORT:-8001}..."
python3 -m uvicorn adk_service.main:app --host 0.0.0.0 --port ${ADK_PORT:-8001} --timeout-keep-alive 120 &
ADK_PID=$!

# Start Express immediately — do NOT wait for ADK.
# Cloud Run's startup probe expects PORT to be bound within seconds.
# ADK connects lazily per-request; it will be ready by the time the first
# AI chat request arrives.
echo "[docker] Starting Node.js server on port ${PORT:-8080}..."
exec node --import tsx/esm server.ts
