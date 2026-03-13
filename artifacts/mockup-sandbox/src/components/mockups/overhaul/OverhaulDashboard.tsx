import './_group.css';

export function OverhaulDashboard() {
  return (
    <div className="min-h-screen bg-[#0a0f0d] flex" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside className="w-[72px] bg-[#0d1210] border-r border-white/[0.06] flex flex-col items-center py-5 shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-emerald-400 flex items-center justify-center mb-8">
          <svg className="w-5 h-5 text-[#0a0f0d]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>

        <nav className="flex-1 flex flex-col items-center gap-1">
          {[
            { active: true, icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', tooltip: 'Overview' },
            { active: false, icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', tooltip: 'Scout' },
            { active: false, icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7', tooltip: 'Map' },
            { active: false, icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', tooltip: 'AI Chat' },
            { active: false, icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', tooltip: 'Settings' }
          ].map((item, i) => (
            <button key={i} className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${item.active ? 'bg-emerald-400/15 text-emerald-400' : 'text-[#3a5a4a] hover:text-[#7c9a8a] hover:bg-white/[0.03]'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={item.icon}/></svg>
            </button>
          ))}
        </nav>

        <div className="w-9 h-9 rounded-full bg-emerald-400/20 flex items-center justify-center text-emerald-300 text-xs font-bold border border-emerald-400/20">
          FA
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-[1100px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-7">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-white">Farm Overview</h2>
                <span className="inline-flex items-center gap-1.5 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-2.5 py-0.5 text-[10px] text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  LIVE
                </span>
              </div>
              <p className="text-[#4a6a5a] text-sm">Malivundo, Pwani · 5 acres · 2 zones active</p>
            </div>
            <div className="flex gap-2">
              <button className="h-9 px-3 text-[#5a7a6a] hover:text-white border border-white/[0.08] rounded-xl bg-white/[0.03] transition-colors flex items-center gap-1.5 text-xs font-medium">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                Refresh
              </button>
              <button className="h-9 px-4 bg-emerald-400 text-[#0a0f0d] rounded-xl font-semibold text-xs flex items-center gap-1.5 shadow-[0_0_20px_rgba(52,211,153,0.15)]">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                New Task
              </button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Active Zones', value: '2', change: '+0', changeColor: 'text-[#4a6a5a]', icon: '🌱', bg: 'from-emerald-500/10 to-emerald-500/5' },
              { label: 'Water Today', value: '1,240L', change: '-12%', changeColor: 'text-emerald-400', icon: '💧', bg: 'from-cyan-500/10 to-cyan-500/5' },
              { label: 'Pending Tasks', value: '3', change: '2 urgent', changeColor: 'text-amber-400', icon: '⚡', bg: 'from-amber-500/10 to-amber-500/5' },
              { label: 'Temperature', value: '28°C', change: 'Partly cloudy', changeColor: 'text-[#4a6a5a]', icon: '🌤️', bg: 'from-sky-500/10 to-sky-500/5' },
            ].map((m) => (
              <div key={m.label} className={`bg-gradient-to-br ${m.bg} border border-white/[0.06] rounded-2xl p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg">{m.icon}</span>
                  <span className={`text-[10px] font-semibold ${m.changeColor}`}>{m.change}</span>
                </div>
                <p className="text-[22px] font-bold text-white mb-0.5">{m.value}</p>
                <p className="text-[11px] text-[#4a6a5a] font-medium">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-12 gap-4">
            {/* Zone Cards */}
            <div className="col-span-8 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#5a7a6a] uppercase tracking-widest">Zones</h3>
                <button className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 uppercase tracking-wider">View Map →</button>
              </div>
              
              {[
                { name: 'Zone A', crop: 'Tomato', emoji: '🍅', days: 31, total: 120, area: '2.5 ac', irrigation: 'Running', irrigColor: 'bg-cyan-400' },
                { name: 'Zone B', crop: 'Onion', emoji: '🧅', days: 61, total: 150, area: '2.5 ac', irrigation: 'Off', irrigColor: 'bg-[#3a5a4a]' }
              ].map((zone) => (
                <div key={zone.name} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.1] transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-white/[0.05] flex items-center justify-center text-2xl">{zone.emoji}</div>
                      <div>
                        <h4 className="font-bold text-white text-[15px]">{zone.name} — {zone.crop}</h4>
                        <p className="text-[11px] text-[#4a6a5a]">{zone.area} · Planted {zone.days} days ago</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${zone.irrigColor}`}></span>
                        <span className="text-[11px] font-medium text-[#5a7a6a]">Irrigation: {zone.irrigation}</span>
                      </div>
                      <button className="h-8 px-3 text-[11px] font-semibold rounded-lg bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 hover:bg-emerald-400/20 transition-colors">
                        💧 Toggle
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-[#5a7a6a] font-medium">Growth</span>
                      <span className="text-white font-semibold">{Math.round(zone.days/zone.total*100)}% · Day {zone.days}/{zone.total}</span>
                    </div>
                    <div className="w-full bg-white/[0.06] rounded-full h-2">
                      <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all" style={{ width: `${zone.days/zone.total*100}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right Column */}
            <div className="col-span-4 space-y-4">
              {/* Tasks */}
              <div>
                <h3 className="text-xs font-bold text-[#5a7a6a] uppercase tracking-widest mb-3">Today's Tasks</h3>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
                  {[
                    { task: 'Morning Irrigation', zone: 'Zone A', time: '6:00 AM', status: 'pending', dot: 'bg-amber-400' },
                    { task: 'Fertilizer Application', zone: 'Zone B', time: '2:00 PM', status: 'pending', dot: 'bg-amber-400' },
                    { task: 'Crop Scouting', zone: 'Zone A', time: '4:00 PM', status: 'done', dot: 'bg-emerald-400' }
                  ].map((t, i) => (
                    <div key={i} className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${t.dot}`}></span>
                        <div>
                          <p className="text-[13px] font-semibold text-white">{t.task}</p>
                          <p className="text-[10px] text-[#4a6a5a]">{t.zone} · {t.time}</p>
                        </div>
                      </div>
                      {t.status === 'pending' ? (
                        <button className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">DO</button>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">✓</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Weather */}
              <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-[#5a7a6a] uppercase tracking-widest">Weather</h3>
                  <span className="text-lg">🌤️</span>
                </div>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-4xl font-bold text-white">28°</span>
                  <span className="text-[#5a7a6a] text-sm mb-1 font-medium">Partly Cloudy</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/[0.04] rounded-xl p-3">
                    <p className="text-[10px] text-[#3a5a4a] mb-0.5">Humidity</p>
                    <p className="text-sm font-bold text-white">72%</p>
                  </div>
                  <div className="bg-white/[0.04] rounded-xl p-3">
                    <p className="text-[10px] text-[#3a5a4a] mb-0.5">Wind</p>
                    <p className="text-sm font-bold text-white">12 km/h</p>
                  </div>
                  <div className="bg-white/[0.04] rounded-xl p-3">
                    <p className="text-[10px] text-[#3a5a4a] mb-0.5">Rain Risk</p>
                    <p className="text-sm font-bold text-white">15%</p>
                  </div>
                  <div className="bg-white/[0.04] rounded-xl p-3">
                    <p className="text-[10px] text-[#3a5a4a] mb-0.5">UV Index</p>
                    <p className="text-sm font-bold text-white">6</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
