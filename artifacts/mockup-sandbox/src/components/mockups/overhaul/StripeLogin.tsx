import './_group.css';
import { useEffect, useState } from 'react';

const GRADIENT_KEYFRAMES = `
@keyframes meshMove1 {
  0%, 100% { transform: translate(0%, 0%) scale(1); }
  25% { transform: translate(10%, -15%) scale(1.1); }
  50% { transform: translate(-5%, 10%) scale(0.95); }
  75% { transform: translate(15%, 5%) scale(1.05); }
}
@keyframes meshMove2 {
  0%, 100% { transform: translate(0%, 0%) scale(1); }
  25% { transform: translate(-15%, 10%) scale(1.05); }
  50% { transform: translate(10%, -10%) scale(1.1); }
  75% { transform: translate(-10%, -5%) scale(0.95); }
}
@keyframes meshMove3 {
  0%, 100% { transform: translate(0%, 0%) scale(1.05); }
  33% { transform: translate(20%, -20%) scale(1); }
  66% { transform: translate(-15%, 15%) scale(1.1); }
}
@keyframes shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes fadeSlideUp {
  0% { opacity: 0; transform: translateY(24px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes fadeSlideRight {
  0% { opacity: 0; transform: translateX(-30px); }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 30px rgba(52,211,153,0.15), 0 0 60px rgba(52,211,153,0.05); }
  50% { box-shadow: 0 0 40px rgba(52,211,153,0.25), 0 0 80px rgba(52,211,153,0.1); }
}
@keyframes borderGlow {
  0%, 100% { border-color: rgba(52,211,153,0.15); }
  50% { border-color: rgba(52,211,153,0.35); }
}
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
}
@keyframes scaleIn {
  0% { opacity: 0; transform: scale(0.9); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes gridFade {
  0% { opacity: 0; }
  100% { opacity: 0.04; }
}
`;

export function StripeLogin() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      <style>{GRADIENT_KEYFRAMES}</style>
      <div className="min-h-screen bg-[#080b09] flex overflow-hidden" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        
        {/* Left: Animated visual panel */}
        <div className="flex w-[56%] relative overflow-hidden">
          {/* Drone video background */}
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-30"
            src="/__mockup/assets/drone_farm_aerial.mp4"
          />
          {/* Animated mesh gradient blobs */}
          <div className="absolute inset-0">
            <div
              className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-60"
              style={{
                background: 'radial-gradient(circle, #065f46 0%, transparent 70%)',
                top: '10%', left: '10%',
                animation: 'meshMove1 12s ease-in-out infinite',
              }}
            />
            <div
              className="absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-50"
              style={{
                background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)',
                top: '40%', right: '5%',
                animation: 'meshMove2 15s ease-in-out infinite',
              }}
            />
            <div
              className="absolute w-[400px] h-[400px] rounded-full blur-[90px] opacity-40"
              style={{
                background: 'radial-gradient(circle, #34d399 0%, transparent 70%)',
                bottom: '10%', left: '30%',
                animation: 'meshMove3 18s ease-in-out infinite',
              }}
            />
            <div
              className="absolute w-[300px] h-[300px] rounded-full blur-[80px] opacity-30"
              style={{
                background: 'radial-gradient(circle, #a7f3d0 0%, transparent 70%)',
                top: '20%', right: '25%',
                animation: 'meshMove1 20s ease-in-out infinite reverse',
              }}
            />
          </div>

          {/* Animated grid overlay */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
              animation: 'gridFade 2s ease-out forwards',
              maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 100%)',
            }}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col justify-between p-10 w-full">
            {/* Logo with glow */}
            <div
              style={{
                animation: mounted ? 'fadeSlideRight 0.8s ease-out forwards' : 'none',
                opacity: mounted ? undefined : 0
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl bg-emerald-400 flex items-center justify-center"
                  style={{ animation: 'pulseGlow 3s ease-in-out infinite' }}
                >
                  <svg className="w-6 h-6 text-[#080b09]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <div>
                  <span className="text-xl font-bold text-white tracking-tight block">mkulima</span>
                  <span className="text-[10px] text-emerald-400/60 font-semibold tracking-[0.2em] uppercase">AI Platform</span>
                </div>
              </div>
            </div>

            {/* Center hero */}
            <div
              className="max-w-lg"
              style={{
                animation: mounted ? 'fadeSlideUp 1s ease-out 0.3s forwards' : 'none',
                opacity: mounted ? undefined : 0,
                animationFillMode: 'backwards'
              }}
            >
              <div className="inline-flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-4 py-1.5 mb-6" style={{ animation: 'borderGlow 3s ease-in-out infinite' }}>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span
                  className="text-xs font-semibold tracking-wider"
                  style={{
                    background: 'linear-gradient(90deg, #34d399, #a7f3d0, #34d399)',
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: 'shimmer 3s linear infinite',
                  }}
                >
                  AI-POWERED FARM MANAGEMENT
                </span>
              </div>
              
              <h1 className="text-[52px] font-bold text-white leading-[1.05] mb-5 tracking-tight">
                Grow smarter.<br/>
                <span style={{
                  background: 'linear-gradient(135deg, #34d399, #6ee7b7, #a7f3d0)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  Harvest more.
                </span>
              </h1>
              <p className="text-[#5a7a6a] text-lg leading-relaxed">
                Real-time monitoring, intelligent automation, and predictive insights for modern farming.
              </p>
            </div>

            {/* Floating stat cards */}
            <div
              className="grid grid-cols-3 gap-3"
              style={{
                animation: mounted ? 'fadeSlideUp 1s ease-out 0.6s forwards' : 'none',
                opacity: mounted ? undefined : 0,
                animationFillMode: 'backwards'
              }}
            >
              {[
                { value: '5 acres', label: 'Farm Size', icon: '🌾', delay: '0s' },
                { value: '2 zones', label: 'Active', icon: '🌱', delay: '0.5s' },
                { value: '99.9%', label: 'Uptime', icon: '⚡', delay: '1s' }
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-white/[0.04] backdrop-blur-md border border-white/[0.08] rounded-2xl p-4 hover:bg-white/[0.07] transition-all duration-500 cursor-default group"
                  style={{ animation: `float 4s ease-in-out ${s.delay} infinite` }}
                >
                  <span className="text-xl mb-2 block group-hover:scale-110 transition-transform">{s.icon}</span>
                  <p className="text-xl font-bold text-white mb-0.5">{s.value}</p>
                  <p className="text-[11px] text-[#4a6a5a] font-medium">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Login form */}
        <div className="flex-1 flex items-center justify-center p-8 relative">
          {/* Subtle gradient bleed from left */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-emerald-900/10 to-transparent pointer-events-none"></div>

          <div
            className="w-full max-w-[400px] relative z-10"
            style={{
              animation: mounted ? 'fadeSlideUp 0.8s ease-out 0.2s forwards' : 'none',
              opacity: mounted ? undefined : 0,
              animationFillMode: 'backwards'
            }}
          >
            {/* Mobile logo */}
            <div className="hidden items-center gap-3 mb-12">
              <div className="w-10 h-10 rounded-2xl bg-emerald-400 flex items-center justify-center" style={{ animation: 'pulseGlow 3s ease-in-out infinite' }}>
                <svg className="w-5 h-5 text-[#080b09]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              </div>
              <span className="text-lg font-bold text-white">mkulima</span>
            </div>

            <h2 className="text-[30px] font-bold text-white mb-1.5 tracking-tight">Welcome back</h2>
            <p className="text-[#4a6a5a] mb-8 text-[15px]">Sign in to your farm dashboard.</p>

            <div className="space-y-5">
              <div
                style={{
                  animation: mounted ? 'fadeSlideUp 0.6s ease-out 0.4s forwards' : 'none',
                  opacity: mounted ? undefined : 0,
                  animationFillMode: 'backwards'
                }}
              >
                <label className="block text-[11px] font-semibold text-[#5a7a6a] mb-2 uppercase tracking-[0.15em]">Email address</label>
                <div className="relative group">
                  <input
                    type="email"
                    defaultValue="admin@farm.co.tz"
                    readOnly
                    className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-[#3a5a4a] text-[15px] transition-all duration-300 focus:border-emerald-400/40 focus:bg-white/[0.06] focus:shadow-[0_0_20px_rgba(52,211,153,0.1)] outline-none"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3a5a4a] group-hover:text-emerald-400/50 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                  </div>
                </div>
              </div>

              <div
                style={{
                  animation: mounted ? 'fadeSlideUp 0.6s ease-out 0.5s forwards' : 'none',
                  opacity: mounted ? undefined : 0,
                  animationFillMode: 'backwards'
                }}
              >
                <label className="block text-[11px] font-semibold text-[#5a7a6a] mb-2 uppercase tracking-[0.15em]">Password</label>
                <div className="relative group">
                  <input
                    type="password"
                    defaultValue="admin123"
                    readOnly
                    className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-[#3a5a4a] text-[15px] transition-all duration-300 focus:border-emerald-400/40 focus:bg-white/[0.06] focus:shadow-[0_0_20px_rgba(52,211,153,0.1)] outline-none"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3a5a4a] group-hover:text-emerald-400/50 transition-colors cursor-pointer">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                </div>
              </div>

              <div
                style={{
                  animation: mounted ? 'fadeSlideUp 0.6s ease-out 0.6s forwards' : 'none',
                  opacity: mounted ? undefined : 0,
                  animationFillMode: 'backwards'
                }}
              >
                <button
                  className="w-full py-3.5 rounded-xl font-bold text-[15px] transition-all duration-300 relative overflow-hidden group"
                  style={{
                    background: 'linear-gradient(135deg, #34d399, #10b981)',
                    color: '#080b09',
                    boxShadow: '0 0 30px rgba(52,211,153,0.2), 0 4px 15px rgba(52,211,153,0.15)',
                  }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Sign in to Dashboard
                    <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                  </span>
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: 'linear-gradient(135deg, #6ee7b7, #34d399)' }}
                  />
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-7"
              style={{
                animation: mounted ? 'fadeSlideUp 0.6s ease-out 0.7s forwards' : 'none',
                opacity: mounted ? undefined : 0,
                animationFillMode: 'backwards'
              }}
            >
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"></div>
              <span className="text-[10px] text-[#3a5a4a] font-medium uppercase tracking-widest">Secured Access</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"></div>
            </div>

            {/* Security badge */}
            <div
              className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.05] rounded-xl p-3"
              style={{
                animation: mounted ? 'fadeSlideUp 0.6s ease-out 0.8s forwards' : 'none',
                opacity: mounted ? undefined : 0,
                animationFillMode: 'backwards'
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-400/10 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#5a7a6a]">End-to-end encrypted</p>
                <p className="text-[10px] text-[#3a5a4a]">Your data is secure on local servers</p>
              </div>
            </div>

            <p
              className="text-[11px] text-[#2a4a3a] text-center mt-6"
              style={{
                animation: mounted ? 'fadeSlideUp 0.6s ease-out 0.9s forwards' : 'none',
                opacity: mounted ? undefined : 0,
                animationFillMode: 'backwards'
              }}
            >
              Need access? Contact your farm administrator.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
