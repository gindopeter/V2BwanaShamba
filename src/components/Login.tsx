import React, { useState, useEffect } from 'react';

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

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [mobileShowLogin, setMobileShowLogin] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter both email and password');
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
        setError(data.message || 'Login failed');
        return;
      }
      onLogin(data);
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const logoSvg = (
    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  );

  const stats = [
    { number: '5', unit: 'Acres', label: 'Under Management' },
    { number: '2', unit: 'Zones', label: 'Active Growing' },
    { number: '24/7', unit: '', label: 'AI Monitoring' }
  ];

  const loginForm = (
    <div
      className="w-full max-w-[380px]"
      style={{
        animation: mounted ? 'scaleUp 0.7s ease-out 0.3s forwards' : 'none',
        opacity: 0,
        animationFillMode: 'forwards'
      }}
    >
      <div className="lg:hidden flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#035925] rounded-lg flex items-center justify-center">
            {logoSvg}
          </div>
          <span className="text-lg font-bold text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>BwanaShamba</span>
        </div>
        <button
          onClick={() => setMobileShowLogin(false)}
          className="text-[#035925] text-sm font-semibold flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          Back
        </button>
      </div>

      <div className="mb-8">
        <h2 className="text-[26px] font-black text-[#002c11] mb-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Welcome back</h2>
        <p className="text-[#5d6c7b] text-sm">Sign in to your farm dashboard</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-[#002c11]/60 mb-1.5 uppercase tracking-[0.12em]">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@bwanashamba.com"
            autoComplete="email"
            className="w-full px-4 py-3 bg-white border-2 border-[#002c11]/10 rounded-lg text-[#002c11] text-sm font-medium transition-all duration-300 focus:border-[#035925] focus:shadow-[0_0_0_3px_rgba(3,89,37,0.1)] outline-none placeholder-[#002c11]/30"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[#002c11]/60 mb-1.5 uppercase tracking-[0.12em]">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            className="w-full px-4 py-3 bg-white border-2 border-[#002c11]/10 rounded-lg text-[#002c11] text-sm font-medium transition-all duration-300 focus:border-[#035925] focus:shadow-[0_0_0_3px_rgba(3,89,37,0.1)] outline-none placeholder-[#002c11]/30"
          />
        </div>

        {error && (
          <div className="text-red-700 text-sm bg-red-50 p-3 rounded-lg border border-red-200 font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#035925] hover:bg-[#002c11] text-white py-3.5 rounded-lg font-bold text-sm transition-all duration-300 relative overflow-hidden group disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
          style={{ fontFamily: "'Instrument Sans', sans-serif" }}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {loading ? (
              <span className="animate-pulse">Authenticating...</span>
            ) : (
              <>
                Access Dashboard
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </>
            )}
          </span>
        </button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-[#002c11]/10"></div>
        <span className="text-[10px] text-[#5d6c7b]/60 font-bold uppercase tracking-widest">or</span>
        <div className="flex-1 h-px bg-[#002c11]/10"></div>
      </div>

      <a
        href="mailto:gindopeter@gmail.com?subject=BwanaShamba%20Demo%20Request&body=Hello%2C%0A%0AI%20would%20like%20to%20request%20a%20demo%20of%20BwanaShamba.%0A%0AThank%20you."
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#fc8e44] hover:bg-[#e07d3a] text-white font-bold text-sm transition-colors"
      >
        Request a Demo
        <span className="text-base">→</span>
      </a>
    </div>
  );

  return (
    <>
      <style>{ANIMATIONS}</style>
      <div className="min-h-screen flex" style={{ fontFamily: "'Lato', system-ui, sans-serif" }}>

        {/* Mobile hero landing (visible only on small screens when login form is hidden) */}
        {!mobileShowLogin && (
          <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-[#002c11]">
            <video
              autoPlay muted loop playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ animation: 'panSlow 25s ease-in-out infinite' }}
              src="/assets/drone_farm_aerial.mp4"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#002c11] via-[#002c11]/60 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#002c11]/30 to-transparent"></div>

            <div className="relative z-10 flex flex-col h-full p-6 justify-between">
              <div
                style={{
                  animation: mounted ? 'slideInLeft 0.8s ease-out forwards' : 'none',
                  opacity: mounted ? undefined : 0
                }}
              >
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-10 h-10 bg-[#035925] rounded-lg flex items-center justify-center border border-white/10">
                    {logoSvg}
                  </div>
                  <span className="text-lg font-bold text-white" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>BwanaShamba</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                <div
                  style={{
                    animation: mounted ? 'fadeUp 0.9s ease-out 0.2s forwards' : 'none',
                    opacity: 0,
                    animationFillMode: 'forwards'
                  }}
                >
                  <h1 className="text-[36px] font-black text-white leading-[1.08] mb-4" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                    Agent for your<br/>farming operations
                  </h1>
                  <p className="text-white/60 text-sm leading-relaxed max-w-xs">
                    AI powered insights, real time monitoring, and automated systems for sustainable agriculture.
                  </p>
                </div>
              </div>

              <div>
                <div
                  className="flex gap-6 border-t border-white/10 pt-5 mb-6"
                  style={{
                    animation: mounted ? 'fadeUp 0.8s ease-out 0.6s forwards' : 'none',
                    opacity: 0,
                    animationFillMode: 'forwards'
                  }}
                >
                  {stats.map((stat, i) => (
                    <div
                      key={stat.label}
                      className="flex-1"
                      style={{
                        animation: mounted ? `numberCount 0.6s ease-out ${0.8 + i * 0.15}s forwards` : 'none',
                        opacity: 0,
                        animationFillMode: 'forwards'
                      }}
                    >
                      <div className="flex items-baseline gap-1 mb-0.5">
                        <span className="text-2xl font-black text-white" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{stat.number}</span>
                        {stat.unit && <span className="text-xs font-bold text-[#fc8e44]">{stat.unit}</span>}
                      </div>
                      <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setMobileShowLogin(true)}
                  className="w-full bg-[#035925] hover:bg-[#002c11] text-white py-4 rounded-xl font-bold text-sm transition-all duration-300 active:scale-[0.98] border border-white/10"
                  style={{
                    fontFamily: "'Instrument Sans', sans-serif",
                    animation: mounted ? 'fadeUp 0.8s ease-out 0.9s forwards' : 'none',
                    opacity: 0,
                    animationFillMode: 'forwards'
                  }}
                >
                  <span className="flex items-center justify-center gap-2">
                    Sign In to Dashboard
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                  </span>
                </button>
                <p className="text-[10px] text-white/30 text-center mt-4 pb-2">
                  Malivundo Farm &middot; Pwani Region, Tanzania
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Desktop: Hero video panel (unchanged) */}
        <div className="hidden lg:flex lg:w-[58%] relative overflow-hidden bg-[#002c11]">
          <video
            autoPlay muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ animation: 'panSlow 25s ease-in-out infinite' }}
            src="/assets/drone_farm_aerial.mp4"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#002c11] via-[#002c11]/60 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#002c11]/40 to-transparent"></div>

          <div className="relative z-10 h-full flex flex-col justify-between p-10">
            <div
              style={{
                animation: mounted ? 'slideInLeft 0.8s ease-out forwards' : 'none',
                opacity: mounted ? undefined : 0
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#035925] rounded-lg flex items-center justify-center border border-white/10">
                  {logoSvg}
                </div>
                <span className="text-lg font-bold text-white" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>BwanaShamba</span>
              </div>
            </div>

            <div className="max-w-md">
              <div
                style={{
                  animation: mounted ? 'fadeUp 0.9s ease-out 0.2s forwards' : 'none',
                  opacity: 0,
                  animationFillMode: 'forwards'
                }}
              >
                <h1 className="text-[44px] font-black text-white leading-[1.05] mb-4" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                  Agent for your<br/>farming operations
                </h1>
                <p className="text-white/60 text-base leading-relaxed">
                  AI powered insights, real time monitoring, and automated systems for sustainable agriculture.
                </p>
              </div>
            </div>

            <div
              className="flex gap-8 border-t border-white/10 pt-6"
              style={{
                animation: mounted ? 'fadeUp 0.8s ease-out 0.6s forwards' : 'none',
                opacity: 0,
                animationFillMode: 'forwards'
              }}
            >
              {stats.map((stat, i) => (
                <div
                  key={stat.label}
                  className="flex-1"
                  style={{
                    animation: mounted ? `numberCount 0.6s ease-out ${0.8 + i * 0.15}s forwards` : 'none',
                    opacity: 0,
                    animationFillMode: 'forwards'
                  }}
                >
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-3xl font-black text-white" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{stat.number}</span>
                    {stat.unit && <span className="text-sm font-bold text-[#fc8e44]">{stat.unit}</span>}
                  </div>
                  <p className="text-[11px] text-white/40 font-medium uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Login form panel */}
        <div className={`flex-1 bg-[#f9f6f1] flex items-center justify-center p-8 lg:p-10 ${!mobileShowLogin ? 'hidden lg:flex' : ''}`}>
          {loginForm}
        </div>
      </div>
    </>
  );
}
