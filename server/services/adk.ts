/**
 * ADK (Agent Development Kit) service helpers.
 * All ADK communication is server-to-server — the ADK token never reaches the browser.
 */

const ADK_URL = process.env.ADK_SERVICE_URL || 'http://localhost:8001';

// Same dev default as adk_service/main.py so the two services stay in sync
// without requiring ADK_INTERNAL_TOKEN to be set in development.
const ADK_DEV_DEFAULT_TOKEN = 'bwanashamba-internal-dev-token';

function getAdkToken(): string {
  const token = process.env.ADK_INTERNAL_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADK_INTERNAL_TOKEN must be set in production');
    }
    return ADK_DEV_DEFAULT_TOKEN;
  }
  return token;
}

/**
 * Sends a single (non-streaming) chat message to the ADK agent service.
 */
export async function chatViaADK(
  message: string,
  userId: string,
  sessionId: string | null,
  image?: string,
  mimeType?: string
): Promise<{ reply: string; adkSessionId: string; agentName: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  try {
    const body: any = { message, user_id: `user_${userId}`, session_id: sessionId };
    if (image) { body.image = image; body.mime_type = mimeType || 'image/jpeg'; }

    const resp = await fetch(`${ADK_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAdkToken()}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) throw new Error(`ADK returned ${resp.status}`);
    const data = (await resp.json()) as any;
    return { reply: data.reply, adkSessionId: data.session_id, agentName: data.agent_name };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Open a streaming SSE connection to the ADK service.
 * Returns a promise for the Response and an abort handle.
 */
export function createADKStreamFetch(
  message: string,
  userId: string,
  sessionId: string | null,
  image?: string,
  mimeType?: string
): { promise: Promise<Response>; abort: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  const body: any = { message, user_id: `user_${userId}`, session_id: sessionId, stream: true };
  if (image) { body.image = image; body.mime_type = mimeType || 'image/jpeg'; }

  const promise = fetch(`${ADK_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAdkToken()}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).then(resp => {
    if (!resp.ok) {
      clearTimeout(timeout);
      throw new Error(`ADK returned ${resp.status}`);
    }
    return resp;
  });

  return {
    promise,
    abort: () => { clearTimeout(timeout); controller.abort(); },
  };
}
