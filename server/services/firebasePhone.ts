// Server-side check of a Firebase phone sign-in. The client completes SMS
// verification with the Firebase JS SDK and posts the resulting ID token; we
// ask Google to validate it (accounts:lookup) and take the phone number from
// Google's response as the verified target — the client's claim is never
// trusted. Lookup rejects tokens minted for any other Firebase project, so
// the API key doubles as the audience check.

function apiKey(): string | undefined {
  return process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
}

export function isFirebasePhoneConfigured(): boolean {
  return !!apiKey();
}

// Returns the verified E.164 phone number (+2557...) for a valid token.
export async function verifyFirebasePhoneToken(idToken: string): Promise<string> {
  const key = apiKey();
  if (!key) throw new Error('Firebase phone verification not configured');

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.warn(`[Firebase] accounts:lookup failed (${res.status}): ${text.substring(0, 200)}`);
    throw new Error('Phone verification failed. Please try again.');
  }

  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error('Phone verification failed. Please try again.'); }

  const phone = data?.users?.[0]?.phoneNumber;
  if (!phone) throw new Error('Phone verification failed. Please try again.');
  return phone;
}
