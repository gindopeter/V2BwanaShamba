#!/bin/bash

# Export GOOGLE_API_KEY from GEMINI_API_KEY if not already set (required by ADK)
if [ -n "$GEMINI_API_KEY" ] && [ -z "$GOOGLE_API_KEY" ]; then
  export GOOGLE_API_KEY="$GEMINI_API_KEY"
fi
export GOOGLE_GENAI_USE_VERTEXAI=false

echo "[boot] Starting ADK agent service in background on port 8001..."
python3 -m uvicorn adk_service.main:app \
  --host 0.0.0.0 \
  --port 8001 \
  --timeout-keep-alive 120 &

# Start Express immediately so it binds to $PORT (8080) before Cloud Run's
# startup probe times out. ADK is not required for the server to boot —
# it connects lazily per request with a fallback to direct Gemini.
echo "[boot] Starting Express server on port ${PORT:-5000}..."
exec node --import tsx server.ts
