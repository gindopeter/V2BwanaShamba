import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import Register from './Register';
import { type Language, t } from '../lib/i18n';

type Panel = 'signin' | 'register' | 'chat';

interface LoginProps {
  onLogin: (user: any) => void;
  notice?: string | null;
  /** Which panel to open on mount (e.g. when arriving from the marketing landing). */
  initialPanel?: Panel;
  /** Return to the marketing landing page. */
  onExit?: () => void;
}

interface GuestMessage {
  role: 'user' | 'ai';
  text: string;
  streaming?: boolean;
}

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
.auth-sheet {
  --auth-sheet-bottom: max(14px, env(safe-area-inset-bottom, 0px));
  --auth-sheet-padding: 14px;
  --auth-sheet-radius: 22px;
  left: 0;
  right: 0;
  bottom: var(--auth-sheet-bottom);
  width: min(calc(100vw - 28px), 430px);
  max-height: min(88vh, 720px);
  margin: 0 auto;
  overflow: hidden;
}
.auth-sheet--register {
  /* Fill nearly the whole phone screen so the form fits without scrolling.
     dvh tracks the *visible* viewport (excludes mobile browser chrome). */
  max-height: calc(100dvh - var(--auth-sheet-bottom) - 12px);
  overflow-y: auto;
}
.auth-sheet--chat {
  height: min(74vh, 620px);
  max-height: calc(100vh - 32px);
}
@media (min-width: 768px) {
  .auth-sheet {
    --auth-sheet-padding: 22px;
    --auth-sheet-radius: 26px;
    top: 50%;
    bottom: auto;
    width: min(calc(100vw - 72px), 560px);
    padding: 22px;
    border-radius: 26px;
    translate: 0 -50%;
  }
  .auth-sheet--signin {
    width: min(calc(100vw - 72px), 520px);
  }
  .auth-sheet--register {
    width: min(calc(100vw - 72px), 680px);
    max-height: min(86vh, 780px);
  }
  .auth-sheet--chat {
    width: min(calc(100vw - 72px), 720px);
    height: min(76vh, 700px);
  }
}
@media (min-width: 1180px) {
  .auth-sheet--signin {
    width: 560px;
  }
  .auth-sheet--register {
    width: 740px;
  }
  .auth-sheet--chat {
    width: 820px;
    height: min(78vh, 760px);
  }
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
  zIndex: 30,
  borderRadius: 'var(--auth-sheet-radius)',
  padding: 'var(--auth-sheet-padding)',
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

export default function Login({ onLogin, notice, initialPanel, onExit }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<Panel>(initialPanel ?? 'signin');
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

          <div style={{ flex: 1 }} />

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
              onClick={onExit}
              style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
            />
            <div
              className="auth-sheet auth-sheet--signin"
              style={{
                ...sharedSheetStyle,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <strong style={{ fontSize: 15, letterSpacing: '-0.02em' }}>
                  {t(lang, 'welcomeBack')}
                </strong>
                <button
                  onClick={onExit}
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
              onClick={onExit}
              style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
            />
            <div
              className="auth-sheet auth-sheet--register"
              style={{
                ...sharedSheetStyle,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Register
                onRegister={onLogin}
                onBack={onExit ?? (() => setPanel('signin'))}
                onClose={onExit ?? (() => setPanel('signin'))}
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
              onClick={onExit}
              style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
            />
            <div
              className="auth-sheet auth-sheet--chat"
              style={{
                ...sharedSheetStyle,
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
                  onClick={onExit}
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
