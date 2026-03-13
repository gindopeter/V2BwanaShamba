import './_group.css';

export function OverhaulLogin() {
  return (
    <div className="min-h-screen bg-[#0a0f0d] flex" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Left: Full visual panel */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d2818] via-[#1a4d2e] to-[#0d2818]"></div>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 30% 70%, rgba(52,211,153,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(16,185,129,0.1) 0%, transparent 50%)' }}></div>
        
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

        <div className="relative z-10 flex flex-col justify-between p-10 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-400 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#0a0f0d]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">mkulima</span>
          </div>

          {/* Center content */}
          <div className="max-w-lg">
            <div className="inline-flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-emerald-300 text-xs font-semibold tracking-wide">AI-POWERED FARM MANAGEMENT</span>
            </div>
            <h1 className="text-5xl font-bold text-white leading-[1.1] mb-5">
              Grow smarter.<br/>
              <span className="text-emerald-400">Harvest more.</span>
            </h1>
            <p className="text-[#7c9a8a] text-lg leading-relaxed mb-10">
              Real-time crop monitoring, AI-driven insights, and automated irrigation for your Malivundo farm.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { value: '5 ac', label: 'Farm Size' },
                { value: '2', label: 'Active Zones' },
                { value: '98%', label: 'Uptime' }
              ].map((s) => (
                <div key={s.label} className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4">
                  <p className="text-2xl font-bold text-white mb-0.5">{s.value}</p>
                  <p className="text-xs text-[#5a7a6a] font-medium">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <div className="flex items-center gap-2 text-[#3a5a4a] text-xs">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
            Malivundo, Pwani Region — Tanzania
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-2xl bg-emerald-400 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#0a0f0d]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <span className="text-lg font-bold text-white">mkulima</span>
          </div>

          <h2 className="text-[28px] font-bold text-white mb-2">Welcome back</h2>
          <p className="text-[#5a7a6a] mb-8">Enter your credentials to access the dashboard.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#5a7a6a] mb-2 uppercase tracking-wider">Email</label>
              <input
                type="email"
                defaultValue="admin@farm.co.tz"
                readOnly
                className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-[#3a5a4a] focus:border-emerald-400/40 transition-colors text-[15px]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5a7a6a] mb-2 uppercase tracking-wider">Password</label>
              <input
                type="password"
                defaultValue="admin123"
                readOnly
                className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-[#3a5a4a] focus:border-emerald-400/40 transition-colors text-[15px]"
              />
            </div>

            <button className="w-full bg-emerald-400 hover:bg-emerald-300 text-[#0a0f0d] py-3.5 rounded-xl font-bold text-[15px] transition-all mt-2 shadow-[0_0_30px_rgba(52,211,153,0.2)]">
              Sign in to Dashboard
            </button>
          </div>

          <p className="text-[11px] text-[#3a5a4a] text-center mt-8">
            Need access? Contact your farm administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
