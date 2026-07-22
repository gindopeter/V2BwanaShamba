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

export type FirebasePhoneFailure = {
  code?: string;
  message: string;
};

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isFirebasePhoneEnabled(): boolean {
  return !!(config.apiKey && config.authDomain && config.projectId);
}

// Firebase accepts E.164 only.  Keeping this check next to the send call
// prevents a local-format number (for example 0712...) from looking like an
// SMS delivery failure in production logs.
export function isTanzanianMobileE164(phoneNumber: string): boolean {
  return /^\+255[67]\d{8}$/.test(phoneNumber);
}

export function firebasePhoneFailure(err: unknown, lang: string): FirebasePhoneFailure {
  const code = typeof err === 'object' && err && 'code' in err
    ? String((err as { code?: unknown }).code)
    : undefined;

  const english: Record<string, string> = {
    'auth/operation-not-allowed': 'SMS sign-in is not enabled for this Firebase project.',
    'auth/unauthorized-domain': 'This app domain is not authorised for Firebase phone sign-in.',
    'auth/invalid-app-credential': 'Google could not validate this app. Check the Firebase authorised domain and reCAPTCHA settings.',
    'auth/captcha-check-failed': 'Google could not complete the security check. Please try again.',
    'auth/quota-exceeded': 'Google SMS quota has been reached. Please try again later.',
    'auth/too-many-requests': 'Too many SMS attempts. Please wait before trying again.',
    'auth/invalid-phone-number': 'Enter a valid Tanzanian mobile number.',
  };
  const swahili: Record<string, string> = {
    'auth/operation-not-allowed': 'Kutuma SMS hakujawashwa kwenye mradi wa Firebase.',
    'auth/unauthorized-domain': 'Tovuti hii haijaidhinishwa kwa uthibitishaji wa Firebase kwa simu.',
    'auth/invalid-app-credential': 'Google haikuweza kuthibitisha programu hii. Kagua domain iliyoidhinishwa na mipangilio ya reCAPTCHA kwenye Firebase.',
    'auth/captcha-check-failed': 'Google haikuweza kukamilisha ukaguzi wa usalama. Tafadhali jaribu tena.',
    'auth/quota-exceeded': 'Kikomo cha Google SMS kimefikiwa. Jaribu tena baadaye.',
    'auth/too-many-requests': 'Kuna majaribio mengi ya SMS. Subiri kabla ya kujaribu tena.',
    'auth/invalid-phone-number': 'Ingiza nambari sahihi ya simu ya Tanzania.',
  };

  return { code, message: (lang === 'sw' ? swahili : english)[code || ''] || (lang === 'sw' ? 'Google SMS imeshindwa kutumwa. Tafadhali jaribu tena.' : 'Google SMS could not be sent. Please try again.') };
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
  if (!isTanzanianMobileE164(phoneE164)) {
    const error = Object.assign(new Error('Invalid Tanzanian mobile number'), { code: 'auth/invalid-phone-number' });
    throw error;
  }
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
