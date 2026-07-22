import { useRef, useState } from 'react';
import { X, Mail, Phone, ShieldCheck } from 'lucide-react';
import type { AuthUser } from '../App';
import { type Language } from '../lib/i18n';
import {
  isFirebasePhoneEnabled, startFirebasePhoneVerification, confirmFirebasePhoneCode, firebasePhoneFailure,
  type ConfirmationResult,
} from '../lib/firebasePhone';

interface CompleteAccountModalProps {
  user: AuthUser;
  lang: Language;
  onClose: () => void;
  onComplete: (user: AuthUser) => void;
}

// Lets a signed-in user add or verify the identifier their account is missing
// (email signup → add phone, phone signup → add email, or confirm an
// identifier stored unverified during an email-fallback registration).
// Reuses the authenticated /api/auth/complete/* endpoints. Phone codes go out
// via Firebase SMS first, falling back to WhatsApp (then Africa's Talking SMS
// once OTP_SMS_ENABLED); email codes by Gmail.
export default function CompleteAccountModal({ user, lang, onClose, onComplete }: CompleteAccountModalProps) {
  // Ask for whichever identifier is missing or still unverified.
  const type: 'phone' | 'email' =
    (!user.phone_number || user.phone_verified === 0) ? 'phone' : 'email';

  const [step, setStep] = useState<'input' | 'verify'>('input');
  // Prefill identifiers stored unverified (e.g. from an email-fallback signup).
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState((user.phone_number || '').replace(/^\+255/, '')); // local part after +255
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpChannel, setOtpChannel] = useState<'firebase' | 'whatsapp' | 'sms'>('whatsapp');
  // Active Firebase SMS session (see Register.tsx for the flow).
  const firebaseConfirmation = useRef<ConfirmationResult | null>(null);
  const firebaseIdToken = useRef<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const target = type === 'phone' ? '+255' + phone : email.trim();

  const sw = lang === 'sw';

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

  const sendOtp = async (opts: { resend?: boolean; forceWhatsApp?: boolean } = {}) => {
    setError('');
    if (type === 'phone' && !/^[67]\d{8}$/.test(phone)) {
      setError(sw ? 'Ingiza nambari sahihi ya simu (mfano: +255 712 345 678)' : 'Enter a valid phone number (e.g. +255 712 345 678)');
      return false;
    }
    if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(sw ? 'Ingiza barua pepe sahihi' : 'Enter a valid email address');
      return false;
    }
    setSending(true);
    firebaseConfirmation.current = null;
    firebaseIdToken.current = null;

    // Firebase first for phone numbers (Google-delivered SMS); fall through to
    // the server's WhatsApp chain on any failure.
    let googleSmsFailure = '';
    if (type === 'phone' && !opts.forceWhatsApp && isFirebasePhoneEnabled()) {
      try {
        firebaseConfirmation.current = await startFirebasePhoneVerification(target, lang);
        setOtpChannel('firebase');
        setSending(false);
        return true;
      } catch (err) {
        console.warn('[Firebase] SMS send failed, falling back to WhatsApp:', err);
        googleSmsFailure = firebasePhoneFailure(err, lang).message;
        firebaseConfirmation.current = null;
      }
    }

    try {
      const body: any = { lang };
      if (type === 'phone') body.phone_number = target;
      else body.email = target;
      if (opts.resend) body.resend = true;
      const res = await fetch('/api/auth/complete/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(googleSmsFailure || data.message || (sw ? 'Imeshindwa kutuma nambari' : 'Failed to send code')); return false; }
      if (data.dev_code) setDevCode(data.dev_code);
      if (data.channel) setOtpChannel(data.channel);
      if (googleSmsFailure) {
        const fallbackChannel = data.channel === 'sms' ? 'SMS' : 'WhatsApp';
        setError(sw
          ? `${googleSmsFailure} Nambari imetumwa kwa ${fallbackChannel} badala yake.`
          : `${googleSmsFailure} A code was sent through ${fallbackChannel} instead.`);
      }
      return true;
    } catch {
      setError(sw ? 'Hitilafu ya muunganisho' : 'Connection error. Please try again.');
      return false;
    } finally { setSending(false); }
  };

  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await sendOtp();
    if (ok) { setOtpDigits(['', '', '', '', '', '']); setStep('verify'); setTimeout(() => otpRefs.current[0]?.focus(), 100); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length < 6) { setError(sw ? 'Weka nambari zote 6' : 'Enter all 6 digits'); return; }
    setError(''); setLoading(true);
    try {
      let body: any = { target, code, type };
      if (type === 'phone' && otpChannel === 'firebase' && (firebaseConfirmation.current || firebaseIdToken.current)) {
        // Confirm the code with Firebase; the ID token replaces target+code.
        if (!firebaseIdToken.current) {
          try {
            firebaseIdToken.current = await confirmFirebasePhoneCode(firebaseConfirmation.current!, code);
            firebaseConfirmation.current = null;
          } catch (fbErr: any) {
            const bad = fbErr?.code === 'auth/invalid-verification-code' || fbErr?.code === 'auth/code-expired';
            setError(bad
              ? (sw ? 'Nambari si sahihi' : 'Invalid or expired code')
              : (sw ? 'Hitilafu ya muunganisho' : 'Connection error. Please try again.'));
            return;
          }
        }
        body = { firebase_id_token: firebaseIdToken.current };
      }
      const res = await fetch('/api/auth/complete/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || (sw ? 'Nambari si sahihi' : 'Invalid or expired code')); return; }
      onComplete(data);
    } catch {
      setError(sw ? 'Hitilafu ya muunganisho' : 'Connection error. Please try again.');
    } finally { setLoading(false); }
  };

  const inputClass = "w-full px-4 py-3 border border-[#002c11]/10 rounded-xl text-[#002c11] focus:ring-2 focus:ring-[#035925]/30 focus:border-[#035925] transition-all bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,20,8,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute right-4 top-4 p-1.5 text-[#5d6c7b]/60 hover:text-[#002c11] hover:bg-[#002c11]/5 rounded-lg transition-all">
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-[#035925]/10 flex items-center justify-center text-[#035925]">
            {type === 'phone' ? <Phone size={20} /> : <Mail size={20} />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#002c11] leading-tight">
              {type === 'phone'
                ? (user.phone_number
                    ? (sw ? 'Thibitisha nambari ya simu' : 'Verify your mobile number')
                    : (sw ? 'Ongeza nambari ya simu' : 'Add your mobile number'))
                : (sw ? 'Ongeza barua pepe' : 'Add your email')}
            </h3>
            <p className="text-xs text-[#5d6c7b]">
              {type === 'phone'
                ? (sw ? 'Linda akaunti yako na uingie kwa njia yoyote' : 'Secure your account and log in either way')
                : (sw ? 'Kwa ajili ya kurejesha akaunti na kuingia' : 'For account recovery and signing in')}
            </p>
          </div>
        </div>

        {step === 'input' ? (
          <form onSubmit={handleSendSubmit} className="mt-5 space-y-4">
            {type === 'phone' ? (
              <div>
                <label className="block text-sm font-semibold text-[#002c11]/80 mb-1.5">{sw ? 'Nambari ya simu' : 'Phone number'}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5d6c7b] font-medium pointer-events-none">+255</span>
                  <input
                    type="tel" value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').replace(/^0/, '').slice(0, 9))}
                    placeholder="7XX XXX XXX" maxLength={9}
                    className={inputClass} style={{ paddingLeft: 58 }} autoFocus
                  />
                </div>
                <p className="text-xs text-[#5d6c7b]/70 mt-1">
                  {isFirebasePhoneEnabled()
                    ? (sw ? 'Utatumiwa nambari ya uthibitisho kwa SMS' : 'You will receive a verification code by SMS')
                    : (sw ? 'Utatumiwa nambari ya uthibitisho kwa WhatsApp' : 'You will receive a verification code on WhatsApp')}
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-[#002c11]/80 mb-1.5">{sw ? 'Barua pepe' : 'Email address'}</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" className={inputClass} autoFocus
                />
                <p className="text-xs text-[#5d6c7b]/70 mt-1">{sw ? 'Utatumiwa barua pepe ya uthibitisho' : 'You will receive an email verification code'}</p>
              </div>
            )}

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={sending}
              className="w-full flex items-center justify-center gap-2 bg-[#035925] hover:bg-[#002c11] text-white px-6 py-3 rounded-xl font-medium shadow-sm transition-all active:scale-[0.98] disabled:opacity-70">
              {sending ? (sw ? 'Inatuma...' : 'Sending...') : (sw ? 'Tuma nambari ya uthibitisho' : 'Send verification code')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-5 space-y-4">
            <p className="text-sm text-[#5d6c7b]">
              {type === 'phone'
                ? ((otpChannel === 'sms' || otpChannel === 'firebase')
                    ? (sw ? `Nambari imetumwa kwa SMS kwa ${target}` : `Code sent by SMS to ${target}`)
                    : (sw ? `Nambari imetumwa kwa WhatsApp kwa ${target}` : `Code sent via WhatsApp to ${target}`))
                : (sw ? `Nambari imetumwa kwa ${target}` : `Code sent to ${target}`)}
            </p>

            {devCode && (
              <div className="rounded-lg px-3 py-2 bg-amber-50 border border-amber-200">
                <p className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wide">Dev mode</p>
                <p className="text-sm text-amber-700">Code: <span className="font-black tracking-widest">{devCode}</span></p>
              </div>
            )}

            <div className="flex gap-2 justify-between" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, i) => (
                <input
                  key={i} ref={el => { otpRefs.current[i] = el; }}
                  type="text" inputMode="numeric" maxLength={1} value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-black rounded-xl border border-[#002c11]/15 focus:border-[#035925] focus:ring-2 focus:ring-[#035925]/30 outline-none text-[#002c11]"
                />
              ))}
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading || otpDigits.join('').length < 6}
              className="w-full flex items-center justify-center gap-2 bg-[#035925] hover:bg-[#002c11] text-white px-6 py-3 rounded-xl font-medium shadow-sm transition-all active:scale-[0.98] disabled:opacity-60">
              <ShieldCheck size={18} />
              {loading ? (sw ? 'Inathibitisha...' : 'Verifying...') : (sw ? 'Thibitisha na hifadhi' : 'Verify & save')}
            </button>

            <div className="flex items-center justify-center gap-4 text-xs">
              <button type="button" disabled={sending} onClick={() => sendOtp({ resend: true })}
                className="text-[#035925] font-semibold hover:underline disabled:opacity-60">
                {sw ? 'Tuma tena' : 'Resend code'}
              </button>
              {otpChannel === 'firebase' && (
                <button type="button" disabled={sending}
                  onClick={async () => { setOtpDigits(['', '', '', '', '', '']); await sendOtp({ forceWhatsApp: true }); }}
                  className="text-[#5d6c7b] font-semibold hover:underline disabled:opacity-60">
                  {sw ? 'Jaribu WhatsApp' : 'Try WhatsApp instead'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
