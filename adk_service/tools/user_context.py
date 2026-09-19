"""Who the agent is acting for, and how its tools reach the app's database.

The tools used to open their own SQLite file. In production the app runs on
Postgres and that file does not exist, so every agent read returned nothing and
every agent write silently went nowhere — tasks the AI said it had created were
never visible to the farmer. The tools now call the Node app's internal API
instead, which owns the one real database and enforces per-user access.

The acting user's id reaches a tool two ways, checked in order:
  1. ADK session state (set in main.py when the session is created) via the
     tool_context ADK injects.
  2. A contextvar set per request, as a fallback for any tool invoked outside
     the normal tool_context path.
"""
import contextvars
import json
import os
import urllib.error
import urllib.request

USER_ID_STATE_KEY = "app_user_id"

CURRENT_USER_ID: contextvars.ContextVar = contextvars.ContextVar(
    "bwanashamba_current_user_id", default=None
)

_DEV_DEFAULT_TOKEN = "bwanashamba-internal-dev-token"


class NoUserContext(Exception):
    """Raised when a tool cannot tell which farmer it is acting for."""


def internal_token() -> str:
    token = os.environ.get("ADK_INTERNAL_TOKEN", "")
    if not token:
        if os.environ.get("NODE_ENV") == "production":
            raise RuntimeError("ADK_INTERNAL_TOKEN must be set in production")
        return _DEV_DEFAULT_TOKEN
    return token


def api_base() -> str:
    """Base URL of the Node app. Same container in production, so loopback."""
    explicit = os.environ.get("APP_INTERNAL_URL")
    if explicit:
        return explicit.rstrip("/")
    return f"http://127.0.0.1:{os.environ.get('PORT', '8080')}"


def parse_user_id(raw) -> int:
    """Accepts 'user_42', '42' or 42 and returns 42. Raises on anything else."""
    if raw is None:
        raise NoUserContext("no user id provided")
    text = str(raw).strip()
    if text.startswith("user_"):
        text = text[len("user_"):]
    if not text.isdigit():
        raise NoUserContext(f"unrecognised user id '{raw}'")
    return int(text)


def resolve_user_id(tool_context=None) -> int:
    """Best-effort lookup of the acting farmer's numeric id."""
    if tool_context is not None:
        try:
            state = getattr(tool_context, "state", None) or {}
            candidate = state.get(USER_ID_STATE_KEY)
            if candidate:
                return parse_user_id(candidate)
        except NoUserContext:
            pass
        except Exception:
            pass

    candidate = CURRENT_USER_ID.get()
    if candidate:
        return parse_user_id(candidate)

    raise NoUserContext(
        "This tool could not tell which farmer it is acting for, so it did not "
        "read or change any data."
    )


def api_request(method: str, path: str, user_id: int, payload: dict = None, timeout: int = 15) -> dict:
    """Calls the Node internal API on behalf of `user_id`. Returns parsed JSON."""
    url = f"{api_base()}/api/internal/{path.lstrip('/')}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None

    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {internal_token()}")
    req.add_header("X-User-Id", str(user_id))
    if data is not None:
        req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            message = json.loads(body).get("error") or body
        except Exception:
            message = body
        raise RuntimeError(f"{message} (HTTP {e.code})")
    except urllib.error.URLError as e:
        raise RuntimeError(f"could not reach the farm database service: {e.reason}")
