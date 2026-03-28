#!/bin/bash

if [ -n "$GEMINI_API_KEY" ] && [ -z "$GOOGLE_API_KEY" ]; then
    export GOOGLE_API_KEY="$GEMINI_API_KEY"
fi

echo "[docker] Starting ADK Agent Service on port ${ADK_PORT:-8001}..."
python3 -m uvicorn adk_service.main:app --host 0.0.0.0 --port ${ADK_PORT:-8001} --timeout-keep-alive 120 &
ADK_PID=$!

sleep 3

if kill -0 $ADK_PID 2>/dev/null; then
    echo "[docker] ADK Agent Service started successfully (PID: $ADK_PID)"
else
    echo "[docker] WARNING: ADK Agent Service failed to start, continuing without it..."
fi

echo "[docker] Starting Node.js server on port ${PORT:-8080}..."
exec node --import tsx server.ts
