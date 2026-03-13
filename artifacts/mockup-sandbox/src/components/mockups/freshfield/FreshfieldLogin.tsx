import './_group.css';
import { useEffect, useState } from 'react';

const ANIMATIONS = `
@keyframes fadeUp {
  0% { opacity: 0; transform: translateY(30px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes slideInLeft {
  0% { opacity: 0; transform: translateX(-40px); }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes scaleUp {
  0% { opacity: 0; transform: scale(0.92); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes lineGrow {
  0% { width: 0; }
  100% { width: 100%; }
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

export function FreshfieldLogin() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      <style>{ANIMATIONS}</style>
      <div className="min-h-screen flex" style={{ fontFamily: "'Lato', system-ui, sans-serif" }}>
        
        {/* Left: Hero video panel — Freshfield style */}
        <div className="w-[58%] relative overflow-hidden bg-[#002c11]">
          {/* Background video with slow pan */}
          <video
            autoPlay muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ animation: 'panSlow 25s ease-in-out infinite' }}
            src="/__mockup/assets/drone_farm_aerial.mp4"
          />
          {/* Gradient overlay — bottom-heavy for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#002c11] via-[#002c11]/60 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#002c11]/40 to-transparent"></div>

          {/* Content */}
          <div className="relative z-10 h-full flex flex-col justify-between p-10">
            {/* Top: Logo */}
            <div
              style={{
                animation: mounted ? 'slideInLeft 0.8s ease-out forwards' : 'none',
                opacity: mounted ? undefined : 0
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#035925] rounded-lg flex items-center justify-center border border-white/10">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                </div>
                <span className="text-lg font-bold text-white" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>MKULIMA</span>
              </div>
            </div>

            {/* Center: Hero text */}
            <div className="max-w-md">
              <div
                style={{
                  animation: mounted ? 'fadeUp 0.9s ease-out 0.2s forwards' : 'none',
                  opacity: 0,
                  animationFillMode: 'forwards'
                }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-[2px] bg-[#fc8e44] rounded-full" style={{ animation: mounted ? 'lineGrow 1s ease-out 0.5s forwards' : 'none', width: 0 }}></div>
                  <span className="text-[#fc8e44] text-xs font-bold tracking-[0.2em] uppercase whitespace-nowrap">Farm Intelligence Platform</span>
                </div>
                <h1 className="text-[44px] font-black text-white leading-[1.05] mb-4" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                  Cultivating the<br/>future of farming
                </h1>
                <p className="text-white/60 text-base leading-relaxed">
                  AI-powered insights, real-time monitoring, and automated systems for sustainable agriculture.
                </p>
              </div>
            </div>

            {/* Bottom: Stats row — Freshfield number style */}
            <div
              className="flex gap-8 border-t border-white/10 pt-6"
              style={{
                animation: mounted ? 'fadeUp 0.8s ease-out 0.6s forwards' : 'none',
                opacity: 0,
                animationFillMode: 'forwards'
              }}
            >
              {[
                { number: '5', unit: 'Acres', label: 'Under Management' },
                { number: '2', unit: 'Zones', label: 'Active Growing' },
                { number: '24/7', unit: '', label: 'AI Monitoring' }
              ].map((stat, i) => (
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

        {/* Right: Login form — warm, clean */}
        <div className="flex-1 bg-[#f9f6f1] flex items-center justify-center p-10">
          <div
            className="w-full max-w-[360px]"
            style={{
              animation: mounted ? 'scaleUp 0.7s ease-out 0.3s forwards' : 'none',
              opacity: 0,
              animationFillMode: 'forwards'
            }}
          >
            <div className="mb-8">
              <h2 className="text-[26px] font-black text-[#002c11] mb-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Welcome back</h2>
              <p className="text-[#5d6c7b] text-sm">Sign in to your farm dashboard</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#002c11]/60 mb-1.5 uppercase tracking-[0.12em]">Email</label>
                <input
                  type="email"
                  defaultValue="admin@farm.co.tz"
                  readOnly
                  className="w-full px-4 py-3 bg-white border-2 border-[#002c11]/10 rounded-lg text-[#002c11] text-sm font-medium transition-all duration-300 focus:border-[#035925] focus:shadow-[0_0_0_3px_rgba(3,89,37,0.1)] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#002c11]/60 mb-1.5 uppercase tracking-[0.12em]">Password</label>
                <input
                  type="password"
                  defaultValue="admin123"
                  readOnly
                  className="w-full px-4 py-3 bg-white border-2 border-[#002c11]/10 rounded-lg text-[#002c11] text-sm font-medium transition-all duration-300 focus:border-[#035925] focus:shadow-[0_0_0_3px_rgba(3,89,37,0.1)] outline-none"
                />
              </div>

              <button
                className="w-full bg-[#035925] text-white py-3.5 rounded-lg font-bold text-sm transition-all duration-300 relative overflow-hidden group"
                style={{ fontFamily: "'Instrument Sans', sans-serif" }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Access Dashboard
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </span>
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-[#002c11]/10"></div>
              <span className="text-[10px] text-[#5d6c7b]/60 font-bold uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-[#002c11]/10"></div>
            </div>

            {/* Quick info */}
            <div className="bg-white rounded-xl p-4 border border-[#002c11]/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#fc8e44]/10 flex items-center justify-center shrink-0">
                  <span className="text-base">🌾</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#002c11]">Malivundo Farm</p>
                  <p className="text-[10px] text-[#5d6c7b]">Pwani Region, Tanzania · Active</p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#035925] animate-pulse"></span>
                  <span className="text-[10px] font-bold text-[#035925]">Online</span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-[#5d6c7b]/50 text-center mt-6">
              Contact your administrator for access · v2.0
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
