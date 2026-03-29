import React, { useState, useEffect, useRef } from 'react';
import Register from './Register';
import { type Language, t } from '../lib/i18n';

interface LoginProps {
  onLogin: (user: any) => void;
}

const ANIMATIONS = `
@keyframes fadeUp {
  0% { opacity: 0; transform: translateY(30px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes slideInLeft {
  0% { opacity: 0; transform: translateX(-40px); }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes scaleUp {
  0% { opacity: 0; transform: scale(0.92); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes numberCount {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes panSlow {
  0% { transform: scale(1.05) translate(0, 0); }
  50% { transform: scale(1.1) translate(-1%, -1%); }
  100% { transform: scale(1.05) translate(0, 0); }
}
`;

type Panel = 'landing' | 'signin' | 'register' | 'chat';

interface GuestMessage {
  role: 'user' | 'ai';
  text: string;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [panel, setPanel] = useState<Panel>('landing');
  const [lang, setLang] = useState<Language>('en');

  const [guestMessages, setGuestMessages] = useState<GuestMessage[]>([]);
  const [guestInput, setGuestInput] = useState('');
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestLimitReached, setGuestLimitReached] = useState(false);
  const [guestLimitMsg, setGuestLimitMsg] = useState('');
  const [guestRemaining, setGuestRemaining] = useState(5);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);
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
        body: JSON.stringify({ message: userMsg, language: lang }),
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

  const logoSvg = (
    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  );

  const stats = [
    { number: '24/7', unit: '', label: t(lang, 'aiSupport') },
    { number: '∞', unit: '', label: t(lang, 'aiMonitoring') },
  ];

  const renderLandingContent = (dark: boolean) => (
    <>
      <div
        className="flex gap-6 border-t border-white/10 pt-5 mb-4"
        style={{ animation: mounted ? 'fadeUp 0.8s ease-out 0.6s forwards' : 'none' }}
      >
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="flex-1"
            style={{ animation: mounted ? `numberCount 0.6s ease-out ${0.8 + i * 0.15}s forwards` : 'none' }}
          >
            <div className="flex items-baseline gap-1 mb-0.5">
              <span className="text-2xl font-black text-white" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{stat.number}</span>
              {stat.unit && <span className="text-xs font-bold text-[#fc8e44]">{stat.unit}</span>}
            </div>
            <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      <div
        className="space-y-2"
        style={{ animation: mounted ? 'fadeUp 0.8s ease-out 0.9s forwards' : 'none' }}
      >
        <div className="flex gap-2">
          <button
            onClick={() => setPanel('signin')}
            className="flex-1 bg-[#035925] hover:bg-[#024a1f] text-white py-3.5 rounded-xl font-bold text-sm transition-all duration-300 active:scale-[0.98] border border-white/10"
            style={{ fontFamily: "'Instrument Sans', sans-serif" }}
          >
            {t(lang, 'signIn')}
          </button>
          <button
            onClick={() => setPanel('register')}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3.5 rounded-xl font-bold text-sm transition-all duration-300 active:scale-[0.98] border border-white/20"
            style={{ fontFamily: "'Instrument Sans', sans-serif" }}
          >
            {t(lang, 'signUp')}
          </button>
        </div>

        <button
          onClick={() => setPanel('chat')}
          className="w-full bg-[#fc8e44] hover:bg-[#e07d3a] text-white py-3.5 rounded-xl font-bold text-sm transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ fontFamily: "'Instrument Sans', sans-serif" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          {t(lang, 'chatWithUs')}
        </button>

        <div className="flex justify-center gap-2 pt-1">
          <button
            onClick={() => setLang('en')}
            className={`text-xs px-2 py-1 rounded transition-all ${lang === 'en' ? 'text-white font-bold' : 'text-white/40 hover:text-white/60'}`}
          >
            EN
          </button>
          <span className="text-white/20 text-xs">|</span>
          <button
            onClick={() => setLang('sw')}
            className={`text-xs px-2 py-1 rounded transition-all ${lang === 'sw' ? 'text-white font-bold' : 'text-white/40 hover:text-white/60'}`}
          >
            SW
          </button>
        </div>
      </div>
    </>
  );

  const signInForm = (
    <div className="w-full max-w-[380px]">
      <div className="lg:hidden flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#035925] rounded-lg flex items-center justify-center">{logoSvg}</div>
          <span className="text-lg font-bold text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>BwanaShamba</span>
        </div>
        <button onClick={() => setPanel('landing')} className="text-[#035925] text-sm font-semibold flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          {t(lang, 'back')}
        </button>
      </div>

      <div className="mb-8">
        <h2 className="text-[26px] font-black text-[#002c11] mb-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{t(lang, 'welcomeBack')}</h2>
        <p className="text-[#5d6c7b] text-sm">{t(lang, 'signInDashboard')}</p>
      </div>

      <form onSubmit={handleSignIn} className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-[#002c11]/60 mb-1.5 uppercase tracking-[0.12em]">{t(lang, 'emailOrPhone')}</label>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={lang === 'sw' ? 'Barua pepe au +255 7XX XXX XXX' : 'Email or +255 7XX XXX XXX'}
            autoComplete="username"
            className="w-full px-4 py-3 bg-white border-2 border-[#002c11]/10 rounded-lg text-[#002c11] text-sm font-medium transition-all duration-300 focus:border-[#035925] focus:shadow-[0_0_0_3px_rgba(3,89,37,0.1)] outline-none placeholder-[#002c11]/30"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[#002c11]/60 mb-1.5 uppercase tracking-[0.12em]">{t(lang, 'password')}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t(lang, 'enterPassword')}
            autoComplete="current-password"
            className="w-full px-4 py-3 bg-white border-2 border-[#002c11]/10 rounded-lg text-[#002c11] text-sm font-medium transition-all duration-300 focus:border-[#035925] focus:shadow-[0_0_0_3px_rgba(3,89,37,0.1)] outline-none placeholder-[#002c11]/30"
          />
        </div>

        {error && (
          <div className="text-red-700 text-sm bg-red-50 p-3 rounded-lg border border-red-200 font-medium">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#035925] hover:bg-[#002c11] text-white py-3.5 rounded-lg font-bold text-sm transition-all duration-300 relative overflow-hidden group disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
          style={{ fontFamily: "'Instrument Sans', sans-serif" }}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {loading ? <span className="animate-pulse">{lang === 'sw' ? 'Inaingia...' : 'Signing in...'}</span> : (
              <>{t(lang, 'signIn')} <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg></>
            )}
          </span>
        </button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-[#002c11]/10"></div>
        <span className="text-[10px] text-[#5d6c7b]/60 font-bold uppercase tracking-widest">{t(lang, 'or')}</span>
        <div className="flex-1 h-px bg-[#002c11]/10"></div>
      </div>

      <div className="space-y-2">
        <button
          onClick={() => setPanel('register')}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-[#035925]/20 text-[#035925] hover:border-[#035925]/40 hover:bg-[#035925]/5 font-bold text-sm transition-colors"
        >
          {t(lang, 'signUp')}
        </button>
        <button
          onClick={() => setPanel('chat')}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#fc8e44] hover:bg-[#e07d3a] text-white font-bold text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          {t(lang, 'chatWithUs')}
        </button>
      </div>

      <div className="flex justify-center gap-3 mt-6">
        <button onClick={() => setLang('en')} className={`text-xs font-bold transition-colors ${lang === 'en' ? 'text-[#035925]' : 'text-[#5d6c7b]/50 hover:text-[#5d6c7b]'}`}>EN</button>
        <span className="text-[#002c11]/20">|</span>
        <button onClick={() => setLang('sw')} className={`text-xs font-bold transition-colors ${lang === 'sw' ? 'text-[#035925]' : 'text-[#5d6c7b]/50 hover:text-[#5d6c7b]'}`}>SW</button>
      </div>
    </div>
  );

  const guestChatPanel = (
    <div className="w-full max-w-[420px] flex flex-col h-full max-h-[600px]">
      <div className="lg:hidden flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#035925] rounded-lg flex items-center justify-center">{logoSvg}</div>
          <span className="text-lg font-bold text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>BwanaShamba</span>
        </div>
        <button onClick={() => setPanel('landing')} className="text-[#035925] text-sm font-semibold flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          {t(lang, 'back')}
        </button>
      </div>

      <div className="mb-4">
        <h2 className="text-[22px] font-black text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
          {t(lang, 'guestChatTitle')}
        </h2>
        <p className="text-[#5d6c7b] text-sm">{t(lang, 'guestChatSubtitle')}</p>
        {!guestLimitReached && (
          <p className="text-[11px] text-[#5d6c7b]/60 mt-1">
            {lang === 'sw' ? `Ujumbe ${guestRemaining} uliosalia` : `${guestRemaining} messages remaining`}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4 min-h-[180px] max-h-[300px]">
        {guestMessages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-14 h-14 bg-[#035925]/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-[#035925]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <p className="text-sm text-[#5d6c7b]">
              {lang === 'sw' ? 'Niulize swali lolote kuhusu kilimo!' : 'Ask me anything about farming!'}
            </p>
          </div>
        )}
        {guestMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
              msg.role === 'user'
                ? 'bg-[#035925] text-white rounded-tr-sm'
                : 'bg-[#f9f6f1] text-[#002c11] rounded-tl-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {guestLoading && (
          <div className="flex justify-start">
            <div className="bg-[#f9f6f1] px-3 py-2 rounded-xl rounded-tl-sm">
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-[#035925]/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-[#035925]/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-[#035925]/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {guestLimitReached ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-sm font-bold text-amber-800 mb-1">{t(lang, 'guestLimitReached')}</p>
          <p className="text-xs text-amber-700 mb-3">{guestLimitMsg || t(lang, 'guestLimitMsg')}</p>
          <button
            onClick={() => setPanel('register')}
            className="w-full bg-[#035925] hover:bg-[#002c11] text-white py-2.5 rounded-lg font-bold text-sm transition-colors"
          >
            {t(lang, 'registerPrompt')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleGuestChat} className="flex gap-2">
          <input
            type="text"
            value={guestInput}
            onChange={e => setGuestInput(e.target.value)}
            placeholder={t(lang, 'chatPlaceholder')}
            className="flex-1 px-4 py-3 bg-[#f9f6f1] border border-[#002c11]/10 rounded-xl text-[#002c11] text-sm outline-none focus:border-[#035925] transition-colors"
            disabled={guestLoading}
          />
          <button
            type="submit"
            disabled={guestLoading || !guestInput.trim()}
            className="px-4 bg-[#035925] hover:bg-[#002c11] text-white rounded-xl transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </form>
      )}

      <div className="flex items-center gap-2 mt-3">
        <button onClick={() => setPanel('signin')} className="flex-1 text-xs text-center text-[#5d6c7b] hover:text-[#002c11] transition-colors font-medium">
          {t(lang, 'signIn')}
        </button>
        <span className="text-[#002c11]/20">|</span>
        <button onClick={() => setPanel('register')} className="flex-1 text-xs text-center text-[#035925] hover:text-[#002c11] transition-colors font-bold">
          {t(lang, 'signUp')}
        </button>
      </div>
    </div>
  );

  const activeRightPanel = () => {
    if (panel === 'signin') return signInForm;
    if (panel === 'register') return (
      <Register
        onRegister={onLogin}
        onBack={() => setPanel('signin')}
        initialLanguage={lang}
      />
    );
    if (panel === 'chat') return guestChatPanel;
    return null;
  };

  return (
    <>
      <style>{ANIMATIONS}</style>
      <div className="min-h-screen flex" style={{ fontFamily: "'Lato', system-ui, sans-serif" }}>

        {/* Mobile: full screen landing (shown when panel === 'landing') */}
        {panel === 'landing' && (
          <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-[#002c11]">
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 60%, #024a1f 0%, #011a0a 100%)' }}></div>
            <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff'%3E%3Ccircle cx='40' cy='40' r='1'/%3E%3C/g%3E%3C/svg%3E\")" }}></div>

            <div className="relative z-10 flex flex-col h-full p-6 justify-between">
              <div style={{ animation: mounted ? 'slideInLeft 0.8s ease-out forwards' : 'none', opacity: mounted ? undefined : 0 }}>
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-10 h-10 bg-[#035925] rounded-lg flex items-center justify-center border border-white/10">{logoSvg}</div>
                  <span className="text-lg font-bold text-white" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>BwanaShamba</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                <div style={{ animation: mounted ? 'fadeUp 0.9s ease-out 0.2s forwards' : 'none' }}>
                  <h1 className="text-[36px] font-black text-white leading-[1.08] mb-4" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                    {t(lang, 'tagline').split(' ').slice(0, 4).join(' ')}<br/>{t(lang, 'tagline').split(' ').slice(4).join(' ')}
                  </h1>
                  <p className="text-white/60 text-sm leading-relaxed max-w-xs">
                    {lang === 'sw' ? 'Maarifa ya AI, ufuatiliaji wa wakati halisi, na mifumo ya kiotomatiki kwa kilimo endelevu.' : 'AI powered insights, real time monitoring, and automated systems for sustainable agriculture.'}
                  </p>
                </div>
              </div>

              <div>
                {renderLandingContent(true)}
              </div>
            </div>
          </div>
        )}

        {/* Mobile: panel content (for signin/register/chat) */}
        {panel !== 'landing' && (
          <div className="lg:hidden fixed inset-0 z-50 bg-[#f9f6f1] flex items-start justify-center overflow-y-auto pt-6 pb-8 px-6">
            {activeRightPanel()}
          </div>
        )}

        {/* Desktop: Hero video panel */}
        <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-[#002c11]">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 35% 55%, #024a1f 0%, #011a0a 100%)' }}></div>
          <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff'%3E%3Ccircle cx='40' cy='40' r='1'/%3E%3C/g%3E%3C/svg%3E\")" }}></div>

          <div className="relative z-10 h-full flex flex-col justify-between p-10">
            <div style={{ animation: mounted ? 'slideInLeft 0.8s ease-out forwards' : 'none', opacity: mounted ? undefined : 0 }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#035925] rounded-lg flex items-center justify-center border border-white/10">{logoSvg}</div>
                <span className="text-lg font-bold text-white" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>BwanaShamba</span>
              </div>
            </div>

            <div className="max-w-md">
              <div style={{ animation: mounted ? 'fadeUp 0.9s ease-out 0.2s forwards' : 'none' }}>
                <h1 className="text-[44px] font-black text-white leading-[1.05] mb-4" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                  {t(lang, 'tagline')}
                </h1>
                <p className="text-white/60 text-base leading-relaxed">
                  {lang === 'sw' ? 'Maarifa ya AI, ufuatiliaji wa wakati halisi, na mifumo ya kiotomatiki kwa kilimo endelevu.' : 'AI powered insights, real time monitoring, and automated systems for sustainable agriculture.'}
                </p>
              </div>
            </div>

            <div>
              {renderLandingContent(true)}
            </div>
          </div>
        </div>

        {/* Desktop: Right panel */}
        <div className="hidden lg:flex flex-1 bg-[#f9f6f1] items-center justify-center p-8 lg:p-10 overflow-y-auto">
          {panel === 'landing' ? signInForm : activeRightPanel()}
        </div>
      </div>
    </>
  );
}
