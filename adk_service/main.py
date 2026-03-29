import os
import sys
import json
import base64
import asyncio
from contextlib import asynccontextmanager

import fastapi
from fastapi import FastAPI, HTTPException, Request as FastAPIRequest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "false")

gemini_key = os.environ.get("GEMINI_API_KEY", "")
if gemini_key and not os.environ.get("GOOGLE_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = gemini_key

from adk_service.agents.farm_agents import root_agent

session_service = InMemorySessionService()
runner = Runner(agent=root_agent, app_name="bwanashamba", session_service=session_service)


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[ADK] BwanaShamba Agent Service starting...")
    print(f"[ADK] Root agent: {root_agent.name}")
    print(f"[ADK] Sub-agents: {[a.name for a in root_agent.sub_agents]}")
    yield
    print("[ADK] BwanaShamba Agent Service shutting down...")


app = FastAPI(title="BwanaShamba ADK Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:8080"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

ADK_INTERNAL_TOKEN = os.environ.get("ADK_INTERNAL_TOKEN", "")
if not ADK_INTERNAL_TOKEN:
    if os.environ.get("NODE_ENV") == "production":
        raise RuntimeError("ADK_INTERNAL_TOKEN must be set in production")
    ADK_INTERNAL_TOKEN = "bwanashamba-internal-dev-token"
    print("[ADK] WARNING: Using default dev token. Set ADK_INTERNAL_TOKEN in production.")


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_id: Optional[str] = "default_user"
    image: Optional[str] = None
    mime_type: Optional[str] = "image/jpeg"
    stream: Optional[bool] = False


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    agent_name: str


@app.get("/health")
async def health():
    return {"status": "ok", "service": "bwanashamba-adk", "agents": [root_agent.name] + [a.name for a in root_agent.sub_agents]}


async def _prepare_session_and_content(request: ChatRequest):
    user_id = request.user_id or "default_user"
    session_id = request.session_id

    if not session_id:
        session = await session_service.create_session(app_name="bwanashamba", user_id=user_id)
        session_id = session.id
    else:
        try:
            existing = await session_service.get_session(app_name="bwanashamba", user_id=user_id, session_id=session_id)
            if not existing:
                session = await session_service.create_session(app_name="bwanashamba", user_id=user_id)
                session_id = session.id
        except Exception:
            session = await session_service.create_session(app_name="bwanashamba", user_id=user_id)
            session_id = session.id

    parts = []
    if request.image:
        try:
            image_bytes = base64.b64decode(request.image)
            parts.append(types.Part.from_bytes(data=image_bytes, mime_type=request.mime_type))
        except Exception as e:
            print(f"[ADK] Image decode error: {e}")

    if request.message:
        parts.append(types.Part.from_text(text=request.message))
    elif not parts:
        raise HTTPException(status_code=400, detail="No message or image provided")

    content = types.Content(role="user", parts=parts)
    return user_id, session_id, content


@app.post("/chat")
async def chat(request: ChatRequest, raw_request: FastAPIRequest):
    auth_header = raw_request.headers.get("authorization", "")
    token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else ""
    if token != ADK_INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")

    print(f"[ADK] Chat request: message='{request.message[:50]}', user={request.user_id}, has_image={bool(request.image)}, stream={request.stream}")

    try:
        user_id, session_id, content = await _prepare_session_and_content(request)

        if request.stream:
            return StreamingResponse(
                _stream_response(user_id, session_id, content),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )

        final_response = ""
        agent_name = root_agent.name

        async for event in runner.run_async(user_id=user_id, session_id=session_id, new_message=content):
            if event.is_final_response():
                if event.content and event.content.parts:
                    final_response = "\n".join(p.text for p in event.content.parts if p.text)
                if hasattr(event, 'author') and event.author:
                    agent_name = event.author

        if not final_response:
            final_response = "I could not generate a response. Please try again."

        return ChatResponse(reply=final_response, session_id=session_id, agent_name=agent_name)

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ADK] Chat error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


async def _stream_response(user_id: str, session_id: str, content):
    agent_name = root_agent.name
    try:
        yield f"data: {json.dumps({'type': 'start', 'session_id': session_id})}\n\n"

        async for event in runner.run_async(user_id=user_id, session_id=session_id, new_message=content):
            if hasattr(event, 'author') and event.author:
                agent_name = event.author

            if event.is_final_response():
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if part.text:
                            yield f"data: {json.dumps({'type': 'text', 'content': part.text, 'agent': agent_name})}\n\n"

        yield f"data: {json.dumps({'type': 'done', 'session_id': session_id, 'agent': agent_name})}\n\n"

    except Exception as e:
        print(f"[ADK] Stream error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("ADK_PORT", "8001"))
    print(f"[ADK] Starting on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
