/**
 * Shared secret for server-to-server calls between the Node app and the Python
 * ADK agent service. Both directions use it: Node -> ADK /chat, and the ADK
 * tools -> Node /api/internal/*. It never reaches the browser.
 */
import crypto from 'crypto';

// Same dev default as adk_service/main.py so the two services stay in sync
// without requiring ADK_INTERNAL_TOKEN to be set in development.
const DEV_DEFAULT_TOKEN = 'bwanashamba-internal-dev-token';

export function getInternalToken(): string {
  const token = process.env.ADK_INTERNAL_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADK_INTERNAL_TOKEN must be set in production');
    }
    return DEV_DEFAULT_TOKEN;
  }
  return token;
}

/** Length-safe constant-time comparison of a presented token against ours. */
export function isValidInternalToken(presented: string): boolean {
  if (!presented) return false;
  const expected = getInternalToken();
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
