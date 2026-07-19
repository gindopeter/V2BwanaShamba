// Firebase phone verification — the PRIMARY channel for phone-number OTP.
// Google delivers the SMS itself (no TCRA sender-ID registration needed): the
// SDK runs an invisible reCAPTCHA, sends the code, and after the user enters
// it we mint a Firebase ID token that the server validates. When Firebase is
// unconfigured or a send fails, callers fall back to the existing
// WhatsApp → email chain.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth, inMemoryPersistence, RecaptchaVerifier,
  signInWithPhoneNumber, signOut,
  type Auth, type ConfirmationResult,
} from 'firebase/auth';

export type { ConfirmationResult };

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isFirebasePhoneEnabled(): boolean {
  return !!(config.apiKey && config.authDomain && config.projectId);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let verifier: RecaptchaVerifier | null = null;

function getFirebaseAuth(): Auth {
  if (!auth) {
    app = initializeApp(config as Record<string, string>);
    // In-memory persistence: the Firebase session is a throwaway used only to
    // mint the ID token — our own express session is the real login.
    auth = initializeAuth(app, { persistence: inMemoryPersistence });
  }
  return auth;
}

// The reCAPTCHA widget needs a DOM node that survives React re-renders, so it
// lives directly on document.body rather than inside a component.
function getRecaptchaVerifier(a: Auth): RecaptchaVerifier {
  if (verifier) return verifier;
  let el = document.getElementById('firebase-recaptcha');
  if (!el) {
    el = document.createElement('div');
    el.id = 'firebase-recaptcha';
    document.body.appendChild(el);
  }
  verifier = new RecaptchaVerifier(a, el, { size: 'invisible' });
  return verifier;
}

function resetRecaptcha() {
  try { verifier?.clear(); } catch { /* already cleared */ }
  verifier = null;
  // Remove the container too: grecaptcha marks the element as used even after
  // clear(), and re-rendering into it throws "reCAPTCHA has already been
  // rendered in this element". A fresh div is created on the next attempt.
  document.getElementById('firebase-recaptcha')?.remove();
}

// Sends the SMS. Each call issues a fresh code/ConfirmationResult, so resends
// simply call this again. `lang` localizes Google's SMS text.
export async function startFirebasePhoneVerification(phoneE164: string, lang: string): Promise<ConfirmationResult> {
  const a = getFirebaseAuth();
  a.languageCode = lang;
  try {
    return await signInWithPhoneNumber(a, phoneE164, getRecaptchaVerifier(a));
  } catch (err) {
    // A consumed/failed reCAPTCHA token can't be reused — reset for next try.
    resetRecaptcha();
    throw err;
  }
}

// Confirms the SMS code and returns the ID token, discarding the throwaway
// Firebase session. Bad codes throw err.code 'auth/invalid-verification-code'
// or 'auth/code-expired'.
export async function confirmFirebasePhoneCode(confirmation: ConfirmationResult, code: string): Promise<string> {
  const cred = await confirmation.confirm(code);
  const idToken = await cred.user.getIdToken();
  if (auth) await signOut(auth).catch(() => {});
  resetRecaptcha();
  return idToken;
}
