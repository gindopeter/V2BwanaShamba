import React, { useState, useRef } from 'react';
import { type Language, t, TANZANIA_REGIONS, TANZANIA_DISTRICTS } from '../lib/i18n';
import {
  isFirebasePhoneEnabled, startFirebasePhoneVerification, confirmFirebasePhoneCode,
  type ConfirmationResult,
} from '../lib/firebasePhone';

interface RegisterProps {
  onRegister: (user: any) => void;
  onBack: () => void;
  onClose: () => void;
  initialLanguage?: Language;
}

type Step = 'language' | 'method' | 'form' | 'verify' | 'email-fallback';
type Method = 'email' | 'phone';

// ─── shared dark-glass styles (matches sign-in sheet) ─────────────────────────

const lbl: React.CSSProperties = {
  display: 'block',
  margin: '7px 0 4px',
  color: 'rgba(255,255,255,0.60)',
  fontSize: 10,
  textTransform: 'uppercase',
  fontWeight: 800,
  letterSpacing: '0.12em',
};

const inp: React.CSSProperties = {
  width: '100%',
  height: 42,
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 13,
  color: 'white',
  background: 'rgba(5,10,7,0.55)',
  outline: 0,
  padding: '0 13px',
  fontFamily: 'inherit',
  fontSize: 16,
  boxSizing: 'border-box',
};

const cardBtn: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 14,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'white',
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  textAlign: 'left',
  transition: 'background 0.15s',
};

const primaryBtn = (disabled = false): React.CSSProperties => ({
  width: '100%',
  height: 43,
  marginTop: 14,
  border: 0,
  borderRadius: 13,
  background: '#FFCC00',
  color: '#202716',
  fontWeight: 900,
  fontSize: 13,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'inherit',
  opacity: disabled ? 0.65 : 1,
});

const backBtn: React.CSSProperties = {
  background: 'transparent',
  border: 0,
  color: 'rgba(255,255,255,0.50)',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '10px 0 0',
};

const iconBox: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: 'rgba(255,204,0,0.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const errBox: React.CSSProperties = {
  marginTop: 8,
  padding: '8px 12px',
  background: 'rgba(220,38,38,0.18)',
  border: '1px solid rgba(220,38,38,0.35)',
  borderRadius: 9,
  fontSize: 12,
  color: '#fca5a5',
};

function SelectWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      {children}
      <span style={{
        position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
        color: 'rgba(255,255,255,0.45)', pointerEvents: 'none', fontSize: 11,
      }}>▾</span>
    </div>
  );
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Register({ onRegister, onBack, onClose, initialLanguage = 'en' }: RegisterProps) {
  const [step, setStep] = useState<Step>('language');
  const [lang, setLang] = useState<Language>(initialLanguage);
  const [method, setMethod] = useState<Method>('email');
  const [form, setForm] = useState({
    first_name: '', last_name: '',
    email: '', phone_number: '',
    password: '', region: '', district: '', farm_size_acres: '',
  });
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [loading,  setLoading]  = useState(false);
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  // Which channel the phone code went out on: firebase (Google-delivered SMS,
  // the primary), whatsapp, or sms (Africa's Talking, once OTP_SMS_ENABLED).
  // Drives the verify-screen copy.
  const [otpChannel, setOtpChannel] = useState<'firebase' | 'whatsapp' | 'sms'>('whatsapp');
  // Active Firebase SMS session; the code is confirmed client-side and the
  // resulting ID token proves phone ownership to the server. The token is
  // kept so a failed server call can be retried without re-confirming (a
  // ConfirmationResult is single-use).
  const firebaseConfirmation = useRef<ConfirmationResult | null>(null);
  const firebaseIdToken = useRef<string | null>(null);
  // Set when a phone signup falls back to email verification (no WhatsApp):
  // the code is sent here instead, and the phone is stored unverified.
  const [fallbackEmail, setFallbackEmail] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startResendTimer = () => {
    setResendTimer(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleChange = (field: string, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'region') next.district = '';
      return next;
    });
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits]; next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) { setOtpDigits(pasted.split('')); otpRefs.current[5]?.focus(); }
    e.preventDefault();
  };

  const sendOtp = async (formData: typeof form, opts: { resend?: boolean; forceWhatsApp?: boolean } = {}) => {
    setSending(true); setError('');
    firebaseConfirmation.current = null;
    firebaseIdToken.current = null;

    // Firebase first for phone numbers: Google delivers the SMS itself. On any
    // failure (unconfigured, quota, region policy, reCAPTCHA) fall through to
    // the server's WhatsApp → email chain.
    if (method === 'phone' && !opts.forceWhatsApp && isFirebasePhoneEnabled()) {
      try {
        firebaseConfirmation.current = await startFirebasePhoneVerification(formData.phone_number, lang);
        setOtpChannel('firebase');
        startResendTimer();
        setSending(false);
        return true;
      } catch (err) {
        console.warn('[Firebase] SMS send failed, falling back to WhatsApp:', err);
        firebaseConfirmation.current = null;
      }
    }

    try {
      const body: any = { lang };
      if (method === 'phone') body.phone_number = formData.phone_number;
      else body.email = formData.email;
      if (opts.resend) body.resend = true;
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || (lang === 'sw' ? 'Imeshindwa kutuma nambari' : 'Failed to send code')); return false; }
      if (data.dev_code) setDevCode(data.dev_code);
      if (data.channel) setOtpChannel(data.channel);
      startResendTimer(); return true;
    } catch {
      setError(lang === 'sw' ? 'Hitilafu ya muunganisho' : 'Connection error. Please try again.');
      return false;
    } finally { setSending(false); }
  };

  // Email fallback for phone signups whose WhatsApp code didn't arrive: send
  // the code to an email address instead. The phone stays on the account
  // unverified.
  const sendFallbackEmailOtp = async (email: string) => {
    setSending(true); setError('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ email, lang }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || (lang === 'sw' ? 'Imeshindwa kutuma nambari' : 'Failed to send code')); return false; }
      if (data.dev_code) setDevCode(data.dev_code);
      startResendTimer(); return true;
    } catch {
      setError(lang === 'sw' ? 'Hitilafu ya muunganisho' : 'Connection error. Please try again.');
      return false;
    } finally { setSending(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!form.first_name.trim()) { setError(lang === 'sw' ? 'Jina la kwanza linahitajika' : 'First name is required'); return; }
    if (method === 'email' && !form.email.trim()) { setError(lang === 'sw' ? 'Barua pepe inahitajika' : 'Email is required'); return; }
    if (method === 'phone') {
      const digits = form.phone_number.replace(/^\+255/, '').trim();
      if (!digits || !/^\d{9}$/.test(digits)) {
        setError(lang === 'sw' ? 'Ingiza nambari sahihi ya simu (mfano: +255 712 345 678)' : 'Enter a valid phone number (e.g. +255 712 345 678)');
        return;
      }
    }
    if (!form.farm_size_acres || parseFloat(form.farm_size_acres) <= 0) { setError(lang === 'sw' ? 'Ukubwa wa shamba unahitajika' : 'Farm size is required'); return; }
    if (form.password.length < 6) { setError(lang === 'sw' ? 'Nywila lazima iwe na herufi 6 au zaidi' : 'Password must be at least 6 characters'); return; }
    setPendingUser(form);
    const ok = await sendOtp(form);
    if (ok) { setOtpDigits(['', '', '', '', '', '']); setStep('verify'); setTimeout(() => otpRefs.current[0]?.focus(), 100); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length < 6) { setError(lang === 'sw' ? 'Weka nambari zote 6' : 'Enter all 6 digits'); return; }
    setError(''); setLoading(true);
    try {
      // Email-fallback: the code went to fallbackEmail, so verify as email and
      // pass the phone along to be stored unverified.
      const usingFallback = !!fallbackEmail;
      const usingFirebase = !usingFallback && otpChannel === 'firebase' && (firebaseConfirmation.current || firebaseIdToken.current);

      const body: any = {
        password: pendingUser.password,
        first_name: pendingUser.first_name, last_name: pendingUser.last_name || null,
        language: lang, region: pendingUser.region || null, district: pendingUser.district || null,
        farm_size_acres: pendingUser.farm_size_acres ? parseFloat(pendingUser.farm_size_acres) : null,
      };

      if (usingFirebase) {
        // Confirm the code with Firebase; the ID token replaces target+code.
        if (!firebaseIdToken.current) {
          try {
            firebaseIdToken.current = await confirmFirebasePhoneCode(firebaseConfirmation.current!, code);
            firebaseConfirmation.current = null;
          } catch (fbErr: any) {
            const bad = fbErr?.code === 'auth/invalid-verification-code' || fbErr?.code === 'auth/code-expired';
            setError(bad
              ? (lang === 'sw' ? 'Nambari si sahihi' : 'Invalid or expired code')
              : (lang === 'sw' ? 'Hitilafu ya muunganisho' : 'Connection error. Please try again.'));
            return;
          }
        }
        body.firebase_id_token = firebaseIdToken.current;
      } else {
        body.target = usingFallback ? fallbackEmail : (method === 'phone' ? pendingUser.phone_number : pendingUser.email);
        body.code = code;
        body.type = usingFallback ? 'email' : method;
        body.phone_number = usingFallback ? pendingUser.phone_number : undefined;
      }

      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || (lang === 'sw' ? 'Nambari si sahihi' : 'Invalid or expired code')); return; }
      onRegister(data);
    } catch {
      setError(lang === 'sw' ? 'Hitilafu ya muunganisho' : 'Connection error. Please try again.');
    } finally { setLoading(false); }
  };

  const availableDistricts = form.region ? (TANZANIA_DISTRICTS[form.region] || []) : [];

  // ── header row with close button ──────────────────────────────────────────
  const Header = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
      <div>
        <strong style={{ fontSize: 15, letterSpacing: '-0.02em', color: 'white', display: 'block' }}>{title}</strong>
        {subtitle && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)', display: 'block', marginTop: 2 }}>{subtitle}</span>}
      </div>
      <button onClick={onClose} style={{
        width: 30, height: 30, border: 0, borderRadius: 999, flexShrink: 0,
        background: 'rgba(255,255,255,0.12)', color: 'white',
        fontSize: 18, cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>×</button>
    </div>
  );

  // ── Step: language ─────────────────────────────────────────────────────────
  if (step === 'language') return (
    <div>
      <Header
        title={lang === 'sw' ? 'Chagua Lugha' : 'Choose Language'}
        subtitle={lang === 'sw' ? 'Chagua lugha unayopendelea' : 'Select your preferred language'}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {([['en', '🇬🇧', 'English', 'Use the app in English'], ['sw', '🇹🇿', 'Kiswahili', 'Tumia programu kwa Kiswahili']] as const).map(([l, flag, name, hint]) => (
          <button key={l} onClick={() => { setLang(l); setStep('method'); }} style={cardBtn}>
            <span style={{ fontSize: 26 }}>{flag}</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{name}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.50)', marginTop: 1 }}>{hint}</p>
            </div>
          </button>
        ))}
      </div>
      <button onClick={onBack} style={backBtn}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
        {lang === 'sw' ? 'Rudi' : 'Back'}
      </button>
    </div>
  );

  // ── Step: method ───────────────────────────────────────────────────────────
  if (step === 'method') return (
    <div>
      <Header
        title={t(lang, 'registerTitle')}
        subtitle={t(lang, 'phoneOrEmail')}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={() => { setMethod('email'); setStep('form'); }} style={cardBtn}>
          <div style={iconBox}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#FFCC00" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{t(lang, 'email')}</p>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.50)', marginTop: 1 }}>
              {lang === 'sw' ? 'Jiandikishe kwa barua pepe' : 'Register with email address'}
            </p>
          </div>
        </button>
        <button onClick={() => { setMethod('phone'); setStep('form'); }} style={cardBtn}>
          <div style={iconBox}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#FFCC00" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{t(lang, 'phoneNumber')}</p>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.50)', marginTop: 1 }}>
              {lang === 'sw' ? 'Jiandikishe kwa nambari ya simu' : 'Register with mobile number'}
            </p>
          </div>
        </button>
      </div>
      <button onClick={() => setStep('language')} style={backBtn}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
        {t(lang, 'back')}
      </button>
    </div>
  );

  // ── Step: verify OTP ───────────────────────────────────────────────────────
  if (step === 'verify') {
    const usingFallback = !!fallbackEmail;
    const target = usingFallback ? fallbackEmail : (method === 'phone' ? pendingUser?.phone_number : pendingUser?.email);
    const masked = (!usingFallback && method === 'phone')
      ? target?.replace(/(\+?\d{3})\d+(\d{3})/, '$1•••••$2')
      : target?.replace(/(.{2}).+(@.+)/, '$1•••••$2');
    const subtitle = usingFallback || method === 'email'
      ? (lang === 'sw' ? `Nambari imetumwa kwa ${masked}` : `Code sent to ${masked}`)
      : (otpChannel === 'sms' || otpChannel === 'firebase')
        ? (lang === 'sw' ? `Nambari imetumwa kwa SMS kwa ${masked}` : `Code sent by SMS to ${masked}`)
        : (lang === 'sw' ? `Nambari imetumwa kwa WhatsApp kwa ${masked}` : `Code sent via WhatsApp to ${masked}`);
    return (
      <div>
        <Header
          title={lang === 'sw' ? 'Thibitisha Akaunti' : 'Verify your account'}
          subtitle={subtitle}
        />

        {devCode && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: 9 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#fde68a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dev mode</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#fde68a' }}>Code: <span style={{ fontWeight: 900, letterSpacing: '0.15em' }}>{devCode}</span></p>
          </div>
        )}

        <form onSubmit={handleVerify}>
          <label style={lbl}>{lang === 'sw' ? 'Weka Nambari ya Uthibitisho' : 'Verification code'}</label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }} onPaste={handleOtpPaste}>
            {otpDigits.map((digit, i) => (
              <input
                key={i}
                ref={el => { otpRefs.current[i] = el; }}
                type="text" inputMode="numeric" maxLength={1}
                value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleOtpKeyDown(i, e)}
                style={{
                  width: 44, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 900,
                  borderRadius: 12, border: digit ? '1px solid rgba(255,204,0,0.6)' : '1px solid rgba(255,255,255,0.15)',
                  background: digit ? 'rgba(255,204,0,0.10)' : 'rgba(5,10,7,0.55)',
                  color: 'white', outline: 0, fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            ))}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>
            {lang === 'sw' ? 'Nambari inaisha baada ya dakika 10' : 'Code expires in 10 minutes'}
          </p>

          {error && <div style={errBox}>{error}</div>}

          <button type="submit" disabled={loading || otpDigits.join('').length < 6} style={primaryBtn(loading || otpDigits.join('').length < 6)}>
            {loading ? (lang === 'sw' ? 'Inathibitisha...' : 'Verifying...') : (lang === 'sw' ? 'Thibitisha na Fungua Akaunti' : 'Verify & Create Account')}
          </button>

          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
              {lang === 'sw' ? 'Hukupokea nambari?' : "Didn't receive the code?"}
            </p>
            {resendTimer > 0 ? (
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>
                {lang === 'sw' ? `Tuma tena baada ya ${resendTimer}s` : `Resend in ${resendTimer}s`}
              </p>
            ) : (
              <button type="button" disabled={sending}
                onClick={() => usingFallback ? sendFallbackEmailOtp(fallbackEmail) : sendOtp(pendingUser, { resend: true })}
                style={{ background: 'transparent', border: 0, color: '#FFCC00', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4, opacity: sending ? 0.6 : 1 }}>
                {sending ? (lang === 'sw' ? 'Inatuma...' : 'Sending...') : (lang === 'sw' ? 'Tuma tena' : 'Resend code')}
              </button>
            )}

            {/* Alternate channels: Firebase SMS didn't arrive → WhatsApp; and
                always offer the email path as the last resort. */}
            {method === 'phone' && !usingFallback && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {otpChannel === 'firebase' && (
                  <button type="button" disabled={sending}
                    onClick={async () => {
                      setError(''); setOtpDigits(['', '', '', '', '', '']);
                      const ok = await sendOtp(pendingUser, { forceWhatsApp: true });
                      if (ok) otpRefs.current[0]?.focus();
                    }}
                    style={{ background: 'transparent', border: 0, color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
                    {lang === 'sw' ? 'Hukupokea SMS? Jaribu WhatsApp' : "Didn't get the SMS? Try WhatsApp"}
                  </button>
                )}
                <button type="button" disabled={sending}
                  onClick={() => { setError(''); setOtpDigits(['', '', '', '', '', '']); setStep('email-fallback'); }}
                  style={{ background: 'transparent', border: 0, color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
                  {otpChannel === 'firebase'
                    ? (lang === 'sw' ? 'Thibitisha kwa barua pepe' : 'Verify with email instead')
                    : (lang === 'sw' ? 'Huna WhatsApp? Thibitisha kwa barua pepe' : 'No WhatsApp? Verify with email instead')}
                </button>
              </div>
            )}
          </div>
        </form>

        <button onClick={() => { setStep('form'); setError(''); setFallbackEmail(''); }} style={backBtn}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          {t(lang, 'back')}
        </button>
      </div>
    );
  }

  // ── Step: email fallback (phone signup, no WhatsApp) ──────────────────────
  if (step === 'email-fallback') {
    const handleFallbackSubmit = async (e: React.FormEvent) => {
      e.preventDefault(); setError('');
      const email = fallbackEmail.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError(lang === 'sw' ? 'Ingiza barua pepe sahihi' : 'Enter a valid email address');
        return;
      }
      const ok = await sendFallbackEmailOtp(email);
      if (ok) { setOtpDigits(['', '', '', '', '', '']); setStep('verify'); setTimeout(() => otpRefs.current[0]?.focus(), 100); }
    };
    return (
      <div>
        <Header
          title={lang === 'sw' ? 'Thibitisha kwa Barua Pepe' : 'Verify with email'}
          subtitle={lang === 'sw'
            ? 'Tutatuma nambari ya uthibitisho kwa barua pepe yako. Nambari yako ya simu itahifadhiwa kwenye akaunti.'
            : "We'll send the code to your email instead. Your phone number stays on your account."}
        />
        <form onSubmit={handleFallbackSubmit}>
          <label style={lbl}>{t(lang, 'email')} *</label>
          <input type="email" value={fallbackEmail} onChange={e => setFallbackEmail(e.target.value)}
            placeholder="you@example.com" style={inp} autoFocus required />

          {error && <div style={errBox}>{error}</div>}

          <button type="submit" disabled={sending} style={primaryBtn(sending)}>
            {sending ? (lang === 'sw' ? 'Inatuma...' : 'Sending...') : (lang === 'sw' ? 'Tuma Nambari' : 'Send code')}
          </button>
        </form>
        <button onClick={() => { setStep('form'); setError(''); setFallbackEmail(''); }} style={backBtn}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          {t(lang, 'back')}
        </button>
      </div>
    );
  }

  // ── Step: form ─────────────────────────────────────────────────────────────
  return (
    <div>
      <Header
        title={t(lang, 'registerTitle')}
        subtitle={t(lang, 'registerSubtitle')}
      />

      <form onSubmit={handleSubmit}>

        {/* Name row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={lbl}>{t(lang, 'firstName')} *</label>
            <input type="text" value={form.first_name} onChange={e => handleChange('first_name', e.target.value)}
              placeholder={lang === 'sw' ? 'Jina lako' : 'First name'} style={inp} required />
          </div>
          <div>
            <label style={lbl}>{t(lang, 'lastName')}</label>
            <input type="text" value={form.last_name} onChange={e => handleChange('last_name', e.target.value)}
              placeholder={lang === 'sw' ? 'Jina la ukoo' : 'Last name'} style={inp} />
          </div>
        </div>

        {/* Email / Phone */}
        {method === 'email' ? (
          <div>
            <label style={lbl}>{t(lang, 'email')} *</label>
            <input type="email" value={form.email} onChange={e => handleChange('email', e.target.value)}
              placeholder="you@example.com" style={inp} required />
          </div>
        ) : (
          <div>
            <label style={lbl}>{t(lang, 'phoneNumber')} *</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: 600, pointerEvents: 'none' }}>+255</span>
              <input type="tel"
                value={form.phone_number.startsWith('+255') ? form.phone_number.slice(4) : form.phone_number}
                onChange={e => { const raw = e.target.value.replace(/\D/g, ''); handleChange('phone_number', '+255' + raw); }}
                placeholder="7XX XXX XXX" maxLength={9}
                style={{ ...inp, paddingLeft: 54 }} required />
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>
              {lang === 'sw' ? 'Mfano: +255 712 345 678' : 'e.g. +255 712 345 678'}
            </p>
          </div>
        )}

        {/* Password */}
        <div>
          <label style={lbl}>
            {t(lang, 'password')} * &nbsp;
            <span style={{ color: 'rgba(255,255,255,0.38)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
              ({t(lang, 'passwordMin')})
            </span>
          </label>
          <input type="password" value={form.password} onChange={e => handleChange('password', e.target.value)}
            placeholder={lang === 'sw' ? 'Neno au Namba ya Siri' : 'Choose a password'} style={inp} required />
        </div>

        {/* Farm info divider */}
        <div style={{ margin: '10px 0 2px', paddingTop: 9, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            {t(lang, 'farmInfo')}
          </p>
        </div>

        {/* Region */}
        <div>
          <label style={lbl}>{t(lang, 'region')}</label>
          <SelectWrap>
            <select value={form.region} onChange={e => handleChange('region', e.target.value)}
              style={{ ...inp, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', paddingRight: 32 }}>
              <option value="" style={{ background: '#0c1e12' }}>{t(lang, 'selectRegion')}</option>
              {TANZANIA_REGIONS.map(r => <option key={r} value={r} style={{ background: '#0c1e12' }}>{r}</option>)}
            </select>
          </SelectWrap>
        </div>

        {/* District + Farm size */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={lbl}>{t(lang, 'district')}</label>
            {availableDistricts.length > 0 ? (
              <SelectWrap>
                <select value={form.district} onChange={e => handleChange('district', e.target.value)}
                  style={{ ...inp, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', paddingRight: 32 }}>
                  <option value="" style={{ background: '#0c1e12' }}>{t(lang, 'selectDistrict')}</option>
                  {availableDistricts.map(d => <option key={d} value={d} style={{ background: '#0c1e12' }}>{d}</option>)}
                </select>
              </SelectWrap>
            ) : (
              <input type="text" value={form.district} onChange={e => handleChange('district', e.target.value)}
                placeholder={t(lang, 'enterDistrict')} style={inp} />
            )}
          </div>
          <div>
            <label style={lbl}>{t(lang, 'farmSize')} *</label>
            <input type="number" value={form.farm_size_acres} onChange={e => handleChange('farm_size_acres', e.target.value)}
              placeholder="e.g. 5" min="0.1" step="0.1" style={inp} required />
          </div>
        </div>

        {error && (
          <div style={errBox}>
            {error}
            {/* WhatsApp send failed outright → offer the email path right here. */}
            {method === 'phone' && (
              <button type="button"
                onClick={() => { setPendingUser(form); setError(''); setStep('email-fallback'); }}
                style={{ display: 'block', marginTop: 6, background: 'transparent', border: 0, padding: 0, color: '#FFCC00', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
                {lang === 'sw' ? 'Thibitisha kwa barua pepe badala yake' : 'Verify with email instead'}
              </button>
            )}
          </div>
        )}

        <button type="submit" disabled={loading || sending} style={primaryBtn(loading || sending)}>
          {sending
            ? (lang === 'sw' ? 'Inatuma nambari...' : 'Sending code...')
            : (lang === 'sw' ? 'Endelea na Uthibitisho' : 'Continue & Verify')}
        </button>

        <p style={{ margin: '8px 0 0', fontSize: 11, textAlign: 'center', color: 'rgba(255,255,255,0.35)' }}>
          {method === 'phone'
            ? (isFirebasePhoneEnabled()
                ? (lang === 'sw' ? 'Utatumiwa nambari ya uthibitisho kwa SMS' : 'You will receive a verification code by SMS')
                : (lang === 'sw' ? 'Utatumiwa nambari ya uthibitisho kwa WhatsApp' : 'You will receive a verification code on WhatsApp'))
            : (lang === 'sw' ? 'Utatumiwa barua pepe ya uthibitisho' : 'You will receive an email verification code')}
        </p>
      </form>

      <button onClick={() => setStep('method')} style={backBtn}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
        {t(lang, 'back')}
      </button>
    </div>
  );
}
