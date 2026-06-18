import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import Register from './Register';
import { type Language, t } from '../lib/i18n';

interface LoginProps {
  onLogin: (user: any) => void;
  notice?: string | null;
}

type Panel = 'landing' | 'signin' | 'register' | 'chat';

interface GuestMessage {
  role: 'user' | 'ai';
  text: string;
  streaming?: boolean;
}

const TYPING_PHRASES: Record<'en' | 'sw', string[]> = {
  en: [
    'Get crop health tips...',
    'Check market prices...',
    'Speak with an agronomist...',
  ],
  sw: [
    'Pata ushauri wa afya ya mazao...',
    'Angalia bei za soko...',
    'Ongea na mtaalamu wa kilimo...',
  ],
};

const ANIMATIONS = `
@keyframes sheetUp {
  from { transform: translateY(32px); opacity:0; }
  to   { transform: translateY(0);    opacity:1; }
}
@keyframes dotBounce {
  0%,80%,100% { transform: translateY(0); }
  40%         { transform: translateY(-6px); }
}
@keyframes cursorBlink {
  0%,100% { opacity:1; }
  50%     { opacity:0; }
}
.guest-md > :first-child { margin-top: 0; }
.guest-md > :last-child { margin-bottom: 0; }
.guest-md p { margin: 0 0 6px; }
.guest-md ul, .guest-md ol { margin: 4px 0 6px; padding-left: 18px; }
.guest-md li { margin: 2px 0; }
.guest-md li::marker { color: rgba(255,255,255,0.6); }
.guest-md strong { font-weight: 700; }
.guest-md em { font-style: italic; }
.guest-md a { color: #ffe08a; text-decoration: underline; }
.guest-md h1, .guest-md h2, .guest-md h3, .guest-md h4 { font-size: 13px; font-weight: 700; margin: 8px 0 4px; }
.guest-md code { background: rgba(255,255,255,0.18); padding: 1px 4px; border-radius: 4px; font-size: 11px; }
.guest-md pre { background: rgba(0,0,0,0.28); padding: 8px; border-radius: 8px; overflow-x: auto; margin: 4px 0 6px; }
.guest-md pre code { background: none; padding: 0; }
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
  fontSize: 16,
};

export default function Login({ onLogin, notice }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<Panel>(notice ? 'signin' : 'landing');
  const [lang, setLang] = useState<Language>('en');

  const [guestMessages, setGuestMessages] = useState<GuestMessage[]>([]);
  const [guestInput, setGuestInput] = useState('');
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestLimitReached, setGuestLimitReached] = useState(false);
  const [guestLimitMsg, setGuestLimitMsg] = useState('');
  const [guestRemaining, setGuestRemaining] = useState(10);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [typingText, setTypingText] = useState('');

  useEffect(() => {
    let active = true;
    let phraseIndex = 0;
    const phrases = TYPING_PHRASES[lang === 'sw' ? 'sw' : 'en'];
    const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

    const run = async () => {
      while (active) {
        const word = phrases[phraseIndex % phrases.length];
        for (let i = 0; i <= word.length; i++) {
          if (!active) return;
          setTypingText(word.substring(0, i));
          await sleep(80);
        }
        await sleep(2000);
        for (let i = word.length; i >= 0; i--) {
          if (!active) return;
          setTypingText(word.substring(0, i));
          await sleep(40);
        }
        await sleep(400);
        phraseIndex++;
      }
    };
    run();
    return () => { active = false; };
  }, [lang]);

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
    const history = guestMessages;
    setGuestInput('');
    setGuestMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setGuestLoading(true);
    try {
      const res = await fetch('/api/chat/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, language: lang, history, stream: true }),
      });

      const contentType = res.headers.get('content-type') || '';

      // Non-stream responses (rate limit, errors, or a server that didn't stream)
      // still arrive as plain JSON — handle them the old way.
      if (!contentType.includes('text/event-stream') || !res.body) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setGuestLimitReached(true);
          setGuestLimitMsg(data.message || t(lang, 'guestLimitReached'));
          return;
        }
        if (!res.ok) {
          setGuestMessages(prev => [...prev, { role: 'ai', text: lang === 'sw' ? 'Samahani, hitilafu imetokea.' : 'Sorry, something went wrong.' }]);
          return;
        }
        setGuestMessages(prev => [...prev, { role: 'ai', text: data.reply || '' }]);
        if (typeof data.messages_remaining === 'number') setGuestRemaining(data.messages_remaining);
        return;
      }

      // Streaming path — type the reply out token-by-token as it arrives.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let started = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'text' && parsed.content) {
              accumulated += parsed.content;
              if (!started) {
                started = true;
                // Keep guestLoading true (input stays locked until the stream
                // ends); the dots hide on their own once this streaming message
                // appears, and the caret signals ongoing activity.
                setGuestMessages(prev => [...prev, { role: 'ai', text: accumulated, streaming: true }]);
              } else {
                setGuestMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'ai', text: accumulated, streaming: true };
                  return updated;
                });
              }
            } else if (parsed.type === 'error' && !started) {
              started = true;
              setGuestMessages(prev => [...prev, { role: 'ai', text: lang === 'sw' ? 'Samahani, hitilafu imetokea.' : 'Sorry, something went wrong.' }]);
            } else if (parsed.type === 'done' && typeof parsed.messages_remaining === 'number') {
              setGuestRemaining(parsed.messages_remaining);
            }
          } catch { /* ignore malformed SSE lines */ }
        }
      }

      if (started) {
        // Drop the streaming flag so the typing caret disappears.
        setGuestMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'ai') updated[updated.length - 1] = { role: 'ai', text: last.text };
          return updated;
        });
      } else {
        setGuestMessages(prev => [...prev, { role: 'ai', text: lang === 'sw' ? 'Samahani, sikuweza kujibu.' : 'Sorry, I could not respond.' }]);
      }
    } catch {
      setGuestMessages(prev => [...prev, { role: 'ai', text: lang === 'sw' ? 'Samahani, hitilafu ya muunganisho.' : 'Sorry, connection error.' }]);
    } finally {
      setGuestLoading(false);
    }
  };

  const handleLandingChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestInput.trim() || guestLoading || guestLimitReached) return;
    setPanel('chat');
    handleGuestChat(e);
  };

  // Register is now rendered as a glass sheet overlay (see bottom of JSX)

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
          src="/assets/login-vegetables-sample.jpg"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: '50% 50%',
            filter: 'saturate(1.12) contrast(1.06)',
            imageRendering: 'high-quality',
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

          {/* Centre — typing prompt */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 4px' }}>
            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(26px, 7.5vw, 36px)',
                fontWeight: 600,
                lineHeight: 1.2,
                textAlign: 'center',
                letterSpacing: '-0.02em',
              }}
            >
              {lang === 'sw' ? 'Ninawezaje kukusaidia leo?' : 'How can I help you today?'}
            </h2>

            {/* Glass chat input */}
            <form onSubmit={handleLandingChat} style={{ width: '100%' }}>
              <div
                style={{
                  width: '100%',
                  padding: '0 16px',
                  borderRadius: 16,
                  background: 'rgba(232,239,222,0.10)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                  boxShadow: '0 18px 38px rgba(0,0,0,0.28)',
                  minHeight: 72,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  boxSizing: 'border-box',
                }}
              >
                <input
                  type="text"
                  value={guestInput}
                  onChange={e => setGuestInput(e.target.value)}
                  placeholder={typingText || (lang === 'sw' ? 'Niulize swali...' : 'Ask me anything...')}
                  disabled={guestLoading || guestLimitReached}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'white',
                    fontSize: 16,
                    fontFamily: 'inherit',
                    caretColor: 'white',
                    textAlign: guestInput ? 'left' : 'center',
                    padding: '20px 0',
                  }}
                />
                {guestInput.trim() && (
                  <button
                    type="submit"
                    disabled={guestLoading}
                    style={{
                      width: 38, height: 38, borderRadius: '50%',
                      background: '#FFCC00', color: '#1f2717',
                      border: 'none', cursor: guestLoading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, opacity: guestLoading ? 0.5 : 1,
                      fontFamily: 'inherit',
                    }}
                  >
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Footer — tagline + CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.4, textAlign: 'center' }}>
              {lang === 'sw'
                ? 'Kuwawezesha wakulima kupata ushauri wa kitaalamu kidigitali na unaozingatia taarifa za shamba.'
                : 'Empowering farmers with digital agronomy and data driven insights.'}
            </p>

            {/* Sign In / Sign Up */}
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                onClick={() => setPanel('signin')}
                style={{
                  border: 0, minHeight: 48, padding: '0 20px', borderRadius: 999,
                  fontWeight: 800, fontSize: 14, background: '#FFCC00', color: '#1f2717',
                  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
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
                  fontWeight: 800, fontSize: 14, background: 'transparent', color: 'white',
                  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  boxShadow: '0 16px 28px rgba(0,0,0,0.18)',
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                }}
              >
                {t(lang, 'signUp')}
              </button>
            </div>
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
                {notice && (
                  <div style={{
                    marginBottom: 14, padding: '9px 12px',
                    background: 'rgba(255,204,0,0.14)', border: '1px solid rgba(255,204,0,0.4)',
                    borderRadius: 9, fontSize: 12, color: '#ffe89a',
                  }}>
                    {notice}
                  </div>
                )}

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
                    background: '#FFCC00', color: '#202716',
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

        {/* ── Register sheet ── */}
        {panel === 'register' && (
          <>
            <div
              onClick={() => setPanel('landing')}
              style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
            />
            <div
              style={{
                ...sharedSheetStyle,
                left: 'max(18px, calc(50% - 222px))',
                right: 'max(18px, calc(50% - 222px))',
                maxHeight: '92vh',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Register
                onRegister={onLogin}
                onBack={() => setPanel('landing')}
                onClose={() => setPanel('landing')}
                initialLanguage={lang}
              />
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 14 }}>
                <button
                  onClick={() => setPanel('signin')}
                  style={{ background: 'transparent', border: 0, color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {t(lang, 'signIn')}
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
                      {lang === 'sw' ? `Zimebaki meseji ${guestRemaining}.` : `${guestRemaining} messages remaining`}
                      {lang === 'sw' ? ' ' : ' · '}
                      <button
                        onClick={() => setPanel('signin')}
                        style={{
                          background: 'none', border: 0, padding: 0, cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: 10, fontWeight: 600,
                          color: 'rgba(255,255,255,0.85)', textDecoration: 'underline',
                        }}
                      >
                        {lang === 'sw' ? 'Ingia kwa Mazungumzo yasiyo na kikomo' : 'Sign In for Unlimited Chat'}
                      </button>
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
                        background: msg.role === 'user' ? '#FFCC00' : 'rgba(255,255,255,0.14)',
                        color: msg.role === 'user' ? '#1f2717' : 'white',
                        whiteSpace: msg.role === 'ai' && !msg.streaming ? 'normal' : 'pre-wrap',
                      }}>
                        {msg.role === 'ai' && !msg.streaming ? (
                          <div className="guest-md">
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                          </div>
                        ) : (
                          <>
                            {msg.text}
                            {msg.streaming && (
                              <span
                                aria-hidden="true"
                                style={{
                                  display: 'inline-block',
                                  width: 7, height: 13, marginLeft: 2,
                                  verticalAlign: 'text-bottom',
                                  background: 'currentColor',
                                  animation: 'cursorBlink 1s steps(2) infinite',
                                }}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {guestLoading && !(guestMessages[guestMessages.length - 1]?.role === 'ai' && guestMessages[guestMessages.length - 1]?.streaming) && (
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
                      background: '#FFCC00', color: '#202716',
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
                    style={{ ...inputStyle, height: 40, flex: 1, borderRadius: 11, fontSize: 16 }}
                  />
                  <button
                    type="submit"
                    disabled={guestLoading || !guestInput.trim()}
                    style={{
                      width: 40, height: 40, border: 0, borderRadius: 11,
                      background: '#FFCC00', color: '#202716',
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
