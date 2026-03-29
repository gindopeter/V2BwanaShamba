/**
 * ADK (Agent Development Kit) service helpers.
 * All ADK communication is server-to-server — the ADK token never reaches the browser.
 */

const ADK_URL = process.env.ADK_SERVICE_URL || 'http://localhost:8001';

// Removed hardcoded fallback token. The server will fail loudly if
// ADK_INTERNAL_TOKEN is missing rather than silently using a public default.
// (Token is validated at server startup in server.ts)
function getAdkToken(): string {
  const token = process.env.ADK_INTERNAL_TOKEN;
  if (!token) throw new Error('ADK_INTERNAL_TOKEN is not set');
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
