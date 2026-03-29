#!/bin/bash
export GOOGLE_GENAI_USE_VERTEXAI=false
if [ -n "$GEMINI_API_KEY" ] && [ -z "$GOOGLE_API_KEY" ]; then
    export GOOGLE_API_KEY="$GEMINI_API_KEY"
fi
cd "$(dirname "$0")/.."
exec python3 -m uvicorn adk_service.main:app --host 0.0.0.0 --port 8001 --timeout-keep-alive 120
