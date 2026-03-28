const ADK_URL = process.env.ADK_SERVICE_URL || 'http://localhost:8001';
const ADK_TOKEN = process.env.ADK_INTERNAL_TOKEN || 'bwanashamba-internal-dev-token';

/**
 * Send a single non-streaming chat request to the ADK service.
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
        Authorization: `Bearer ${ADK_TOKEN}`,
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
      Authorization: `Bearer ${ADK_TOKEN}`,
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
