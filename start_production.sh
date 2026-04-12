#!/bin/bash
set -e

# Export GOOGLE_API_KEY from GEMINI_API_KEY if not already set (required by ADK)
if [ -n "$GEMINI_API_KEY" ] && [ -z "$GOOGLE_API_KEY" ]; then
  export GOOGLE_API_KEY="$GEMINI_API_KEY"
fi
export GOOGLE_GENAI_USE_VERTEXAI=false

echo "[boot] Starting ADK agent service on port 8001..."
python3 -m uvicorn adk_service.main:app \
  --host 0.0.0.0 \
  --port 8001 \
  --timeout-keep-alive 120 &
ADK_PID=$!

echo "[boot] Waiting for ADK service to be ready..."
for i in $(seq 1 20); do
  if curl -sf http://localhost:8001/health > /dev/null 2>&1; then
    echo "[boot] ADK service ready."
    break
  fi
  sleep 1
done

echo "[boot] Starting Express server..."
exec node --import tsx server.ts
