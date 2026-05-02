import React, { useState, useEffect, useRef } from 'react';
import Register from './Register';
import { type Language, t } from '../lib/i18n';

interface LoginProps {
  onLogin: (user: any) => void;
}

type Panel = 'landing' | 'signin' | 'register' | 'chat';

interface GuestMessage {
  role: 'user' | 'ai';
  text: string;
}

const ANIMATIONS = `
@keyframes fieldBreath {
  0%   { transform: scale(1.055) translate3d(-0.7%,-0.4%,0) rotate(-0.15deg); }
  28%  { transform: scale(1.065) translate3d(0.35%,-0.2%,0) rotate(0.12deg); }
  58%  { transform: scale(1.06)  translate3d(-0.15%,0.25%,0) rotate(-0.08deg); }
  100% { transform: scale(1.055) translate3d(-0.7%,-0.4%,0) rotate(-0.15deg); }
}
@keyframes windLight {
  0%   { transform: translate3d(-18%,5%,0) skewX(-10deg); opacity:0.06; }
  38%  { transform: translate3d(18%,-2%,0) skewX(-10deg); opacity:0.12; }
  72%  { transform: translate3d(-4%,3%,0)  skewX(-10deg); opacity:0.08; }
  100% { transform: translate3d(-18%,5%,0) skewX(-10deg); opacity:0.06; }
}
@keyframes sheetUp {
  from { transform: translateY(32px); opacity:0; }
  to   { transform: translateY(0);    opacity:1; }
}
@keyframes dotBounce {
  0%,80%,100% { transform: translateY(0); }
  40%         { transform: translateY(-6px); }
}
`;

const sharedSheetStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 18,
  zIndex: 30,
  borderRadius: 22,
  padding: 14,
  background: 'rgba(12,30,18,0.82)',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 18px 38px rgba(0,0,0,0.4)',
  backdropFilter: 'blur(22px)',
  WebkitBackdropFilter: 'blur(22px)',
  animation: 'sheetUp 260ms ease forwards',
  color: 'white',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  margin: '11px 0 6px',
  color: 'rgba(255,255,255,0.65)',
  fontSize: 10,
  textTransform: 'uppercase',
  fontWeight: 800,
  letterSpacing: '0.12em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 42,
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 13,
  color: 'white',
  background: 'rgba(5,10,7,0.55)',
  outline: 0,
  padding: '0 13px',
  fontFamily: 'inherit',
  fontSize: 13,
};

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<Panel>('landing');
  const [lang, setLang] = useState<Language>('en');

  const [guestMessages, setGuestMessages] = useState<GuestMessage[]>([]);
  const [guestInput, setGuestInput] = useState('');
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestLimitReached, setGuestLimitReached] = useState(false);
  const [guestLimitMsg, setGuestLimitMsg] = useState('');
  const [guestRemaining, setGuestRemaining] = useState(10);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [guestMessages]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError(t(lang, 'email') + ' and ' + t(lang, 'password') + ' are required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || (lang === 'sw' ? 'Imeshindwa kuingia' : 'Login failed'));
        return;
      }
      onLogin(data);
    } catch {
      setError(lang === 'sw' ? 'Hitilafu ya muunganisho' : 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestInput.trim() || guestLoading || guestLimitReached) return;
    const userMsg = guestInput.trim();
    setGuestInput('');
    setGuestMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setGuestLoading(true);
    try {
      const res = await fetch('/api/chat/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, language: lang, history: guestMessages }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setGuestLimitReached(true);
        setGuestLimitMsg(data.message || t(lang, 'guestLimitReached'));
        return;
      }
      if (!res.ok) {
        setGuestMessages(prev => [...prev, { role: 'ai', text: lang === 'sw' ? 'Samahani, hitilafu imetokea.' : 'Sorry, something went wrong.' }]);
        return;
      }
      setGuestMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
      setGuestRemaining(data.messages_remaining ?? 0);
    } catch {
      setGuestMessages(prev => [...prev, { role: 'ai', text: lang === 'sw' ? 'Samahani, hitilafu ya muunganisho.' : 'Sorry, connection error.' }]);
    } finally {
      setGuestLoading(false);
    }
  };

  if (panel === 'register') {
    return (
      <Register
        onRegister={onLogin}
        onBack={() => setPanel('landing')}
        initialLanguage={lang}
      />
    );
  }

  return (
    <>
      <style>{ANIMATIONS}</style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          overflow: 'hidden',
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          background: '#07170d',
        }}
      >
        {/* Hero photo */}
        <img
          src="/assets/farm-field-hq.jpg"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: '52% 50%',
            filter: 'saturate(1.16) contrast(1.08)',
            animation: 'fieldBreath 9s ease-in-out infinite',
            transformOrigin: '50% 88%',
            willChange: 'transform',
          }}
        />

        {/* Wind-light shimmer */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: [
              'linear-gradient(105deg, transparent 0 28%, rgba(255,255,255,0.16) 38%, transparent 52% 100%)',
              'linear-gradient(82deg, transparent 0 48%, rgba(255,232,142,0.08) 56%, transparent 66% 100%)',
            ].join(','),
            mixBlendMode: 'soft-light',
            animation: 'windLight 6.8s ease-in-out infinite',
            willChange: 'transform, opacity',
          }}
        />

        {/* Dark gradient for readability */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            background: [
              'linear-gradient(180deg, rgba(3,8,4,0.05) 0%, rgba(5,14,8,0.14) 35%, rgba(3,12,6,0.86) 72%, rgba(4,12,7,0.98) 100%)',
              'linear-gradient(90deg, rgba(4,15,8,0.35), transparent 52%)',
            ].join(','),
          }}
        />

        {/* Main layout */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '22px 20px 20px',
            color: 'white',
            maxWidth: 480,
            margin: '0 auto',
          }}
        >
          {/* Logo */}
          <div style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.03em' }}>
            BwanaShamba
          </div>

          {/* Hero copy — pushed to bottom by auto margin */}
          <div style={{ marginTop: 'auto', paddingBottom: 18 }}>
            <h1
              style={{
                margin: '0 0 12px',
                fontSize: 'clamp(30px, 8.5vw, 40px)',
                lineHeight: 1.03,
                letterSpacing: '-0.065em',
                fontWeight: 700,
              }}
            >
              {lang === 'sw' ? (
                <>Kilimo Bora<br />Zaidi.</>
              ) : (
                <>Growing Smarter<br />Farming Better.</>
              )}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.74)', fontSize: 13, lineHeight: 1.38, margin: 0, maxWidth: '88%' }}>
              {lang === 'sw'
                ? 'Nguvu za AI, ufuatiliaji wa wakati halisi, kwa kilimo endelevu.'
                : 'Empowering farmers with digital agronomy and data driven insight'}
            </p>

            {/* Sign In / Sign Up */}
            <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                onClick={() => setPanel('signin')}
                style={{
                  border: 0, minHeight: 48, padding: '0 20px', borderRadius: 999,
                  fontWeight: 800, fontSize: 14, background: '#ffe86b', color: '#1f2717',
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 16px 28px rgba(0,0,0,0.18)',
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                }}
              >
                {t(lang, 'signIn')}
              </button>
              <button
                onClick={() => setPanel('register')}
                style={{
                  border: '1px solid rgba(255,255,255,0.18)', minHeight: 48, padding: '0 20px', borderRadius: 999,
                  fontWeight: 800, fontSize: 14, background: 'rgba(255,255,255,0.13)', color: 'white',
                  cursor: 'pointer', fontFamily: 'inherit',
                  backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                  boxShadow: '0 16px 28px rgba(0,0,0,0.18)',
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                }}
              >
                {t(lang, 'signUp')}
              </button>
            </div>
          </div>

          {/* 24/7 Agronomist support */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'center' }}>
            <strong style={{ display: 'block', color: 'white', fontSize: 13, marginBottom: 10 }}>
              {lang === 'sw' ? 'Pata msaada wa Mkulima 24/7' : 'Get 24/7 Agronomist support'}
            </strong>
            <button
              onClick={() => setPanel('chat')}
              style={{
                width: '100%', minHeight: 42, border: 0, borderRadius: 11,
                background: '#ffe86b', color: '#202716',
                fontWeight: 900, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {t(lang, 'chatWithUs')}
            </button>
          </div>

          {/* Language switch */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 9, marginTop: 14 }}>
            <button
              onClick={() => setLang('en')}
              style={{
                border: 0, background: 'transparent',
                color: lang === 'en' ? 'white' : 'rgba(255,255,255,0.42)',
                fontSize: 10, fontWeight: 800, padding: '2px 4px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              English
            </button>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 10 }}>|</span>
            <button
              onClick={() => setLang('sw')}
              style={{
                border: 0, background: 'transparent',
                color: lang === 'sw' ? 'white' : 'rgba(255,255,255,0.42)',
                fontSize: 10, fontWeight: 800, padding: '2px 4px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Kiswahili
            </button>
          </div>
        </div>

        {/* ── Sign-in sheet ── */}
        {panel === 'signin' && (
          <>
            <div
              onClick={() => setPanel('landing')}
              style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
            />
            <div
              style={{
                ...sharedSheetStyle,
                left: 'max(18px, calc(50% - 222px))',
                right: 'max(18px, calc(50% - 222px))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <strong style={{ fontSize: 15, letterSpacing: '-0.02em' }}>
                  {t(lang, 'welcomeBack')}
                </strong>
                <button
                  onClick={() => setPanel('landing')}
                  style={{
                    width: 30, height: 30, border: 0, borderRadius: 999,
                    background: 'rgba(255,255,255,0.12)', color: 'white',
                    fontSize: 18, cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSignIn}>
                <label style={labelStyle}>{t(lang, 'emailOrPhone')}</label>
                <input
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={lang === 'sw' ? 'Barua pepe au +255 7XX XXX XXX' : 'Email or +255 7XX XXX XXX'}
                  autoComplete="username"
                  style={inputStyle}
                />

                <label style={labelStyle}>{t(lang, 'password')}</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t(lang, 'enterPassword')}
                  autoComplete="current-password"
                  style={inputStyle}
                />

                {error && (
                  <div style={{
                    marginTop: 8, padding: '8px 12px',
                    background: 'rgba(220,38,38,0.18)', border: '1px solid rgba(220,38,38,0.35)',
                    borderRadius: 9, fontSize: 12, color: '#fca5a5',
                  }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', height: 43, marginTop: 12, border: 0, borderRadius: 13,
                    background: '#ffe86b', color: '#202716',
                    fontWeight: 900, fontSize: 13,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? (lang === 'sw' ? 'Inaingia...' : 'Signing in...') : t(lang, 'signIn')}
                </button>
              </form>

              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 12 }}>
                <button
                  onClick={() => setPanel('register')}
                  style={{ background: 'transparent', border: 0, color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {t(lang, 'signUp')}
                </button>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                <button
                  onClick={() => setPanel('chat')}
                  style={{ background: 'transparent', border: 0, color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {t(lang, 'chatWithUs')}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Guest chat sheet ── */}
        {panel === 'chat' && (
          <>
            <div
              onClick={() => setPanel('landing')}
              style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
            />
            <div
              style={{
                ...sharedSheetStyle,
                left: 'max(18px, calc(50% - 222px))',
                right: 'max(18px, calc(50% - 222px))',
                maxHeight: '75vh',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Chat header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <strong style={{ fontSize: 14, letterSpacing: '-0.02em', display: 'block' }}>
                    {t(lang, 'guestChatTitle')}
                  </strong>
                  {!guestLimitReached && (
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.48)' }}>
                      {lang === 'sw' ? `Ujumbe ${guestRemaining} uliosalia` : `${guestRemaining} messages remaining`}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setPanel('landing')}
                  style={{
                    width: 30, height: 30, border: 0, borderRadius: 999,
                    background: 'rgba(255,255,255,0.12)', color: 'white',
                    fontSize: 18, cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', minHeight: 100, marginBottom: 10 }}>
                {guestMessages.length === 0 && (
                  <p style={{ textAlign: 'center', padding: '18px 0', color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: 0 }}>
                    {lang === 'sw' ? 'Niulize swali lolote kuhusu kilimo!' : 'Ask me anything about farming!'}
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {guestMessages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '85%', padding: '8px 12px', borderRadius: 12, fontSize: 12, lineHeight: 1.4,
                        background: msg.role === 'user' ? '#ffe86b' : 'rgba(255,255,255,0.14)',
                        color: msg.role === 'user' ? '#1f2717' : 'white',
                      }}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {guestLoading && (
                    <div style={{ display: 'flex' }}>
                      <div style={{ background: 'rgba(255,255,255,0.14)', padding: '10px 12px', borderRadius: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
                        {[0, 150, 300].map(d => (
                          <span
                            key={d}
                            style={{
                              width: 6, height: 6, background: 'rgba(255,255,255,0.55)',
                              borderRadius: '50%', display: 'inline-block',
                              animation: `dotBounce 1s ${d}ms infinite`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {guestLimitReached ? (
                <div style={{
                  background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)',
                  borderRadius: 11, padding: 12, textAlign: 'center',
                }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#fde68a', margin: '0 0 4px' }}>
                    {t(lang, 'guestLimitReached')}
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(253,230,138,0.75)', margin: '0 0 10px' }}>
                    {guestLimitMsg || t(lang, 'guestLimitMsg')}
                  </p>
                  <button
                    onClick={() => setPanel('register')}
                    style={{
                      width: '100%', height: 36, border: 0, borderRadius: 9,
                      background: '#ffe86b', color: '#202716',
                      fontWeight: 900, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {t(lang, 'registerPrompt')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleGuestChat} style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={guestInput}
                    onChange={e => setGuestInput(e.target.value)}
                    placeholder={t(lang, 'chatPlaceholder')}
                    disabled={guestLoading}
                    style={{ ...inputStyle, height: 40, flex: 1, borderRadius: 11, fontSize: 12 }}
                  />
                  <button
                    type="submit"
                    disabled={guestLoading || !guestInput.trim()}
                    style={{
                      width: 40, height: 40, border: 0, borderRadius: 11,
                      background: '#ffe86b', color: '#202716',
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: (guestLoading || !guestInput.trim()) ? 0.45 : 1,
                      flexShrink: 0,
                    }}
                  >
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </form>
              )}

              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <button
                  onClick={() => setPanel('signin')}
                  style={{ background: 'transparent', border: 0, color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {t(lang, 'signIn')}
                </button>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                <button
                  onClick={() => setPanel('register')}
                  style={{ background: 'transparent', border: 0, color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {t(lang, 'signUp')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
