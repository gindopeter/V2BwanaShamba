import './_group.css';

export function FreshfieldDashboard() {
  return (
    <div className="min-h-screen bg-[#f9f6f1] flex" style={{ fontFamily: "'Lato', system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside className="w-[240px] bg-[#002c11] flex flex-col shrink-0">
        <div className="p-5 flex items-center gap-3 border-b border-white/[0.08]">
          <div className="w-9 h-9 bg-[#035925] rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div>
            <span className="text-sm font-bold text-white block" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>MKULIMA</span>
            <span className="text-[9px] text-[#fc8e44] font-bold tracking-[0.15em] uppercase">Dashboard</span>
          </div>
        </div>

        <nav className="flex-1 px-3 pt-4 space-y-0.5">
          {[
            { label: 'Overview', active: true, icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
            { label: 'Live Scout', active: false, icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
            { label: 'Farm Map', active: false, icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
            { label: 'AI Assistant', active: false, icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
            { label: 'Settings', active: false, icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
          ].map((item) => (
            <button key={item.label} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${item.active ? 'bg-[#035925] text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'}`}>
              <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={item.icon}/></svg>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.08]">
          <div className="flex items-center gap-2.5 p-2">
            <div className="w-8 h-8 rounded-lg bg-[#035925] flex items-center justify-center text-white text-[10px] font-black">FA</div>
            <div>
              <p className="text-[11px] font-bold text-white">Farm Admin</p>
              <p className="text-[10px] text-white/30">admin@farm.co.tz</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-[#002c11]/5 px-8 py-4 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h2 className="text-lg font-black text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Farm Overview</h2>
            <p className="text-[11px] text-[#5d6c7b]">Malivundo, Pwani · 5 Acres · 2 Active Zones</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#035925]/5 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#035925] animate-pulse"></span>
              <span className="text-[11px] font-bold text-[#035925]">All Systems Online</span>
            </div>
            <button className="h-9 px-4 bg-[#035925] text-white rounded-lg font-bold text-xs flex items-center gap-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              New Task
            </button>
          </div>
        </div>

        <div className="p-8 max-w-[1050px] mx-auto">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4 mb-7">
            {[
              { label: 'Active Zones', value: '2', sub: 'Tomato & Onion', icon: '🌱', borderColor: '#035925' },
              { label: 'Water Usage', value: '1,240L', sub: '↓ 12% vs yesterday', icon: '💧', borderColor: '#0082f3' },
              { label: 'Pending Tasks', value: '3', sub: '2 irrigation, 1 scout', icon: '⚡', borderColor: '#fc8e44' },
              { label: 'Temperature', value: '28°C', sub: 'Partly cloudy', icon: '☀️', borderColor: '#f5e197' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl p-4 border-l-[3px] shadow-sm" style={{ borderLeftColor: s.borderColor }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg">{s.icon}</span>
                </div>
                <p className="text-[22px] font-black text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{s.value}</p>
                <p className="text-[11px] font-bold text-[#002c11]/60 mt-0.5">{s.label}</p>
                <p className="text-[10px] text-[#5d6c7b] mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Zone cards + Tasks */}
          <div className="grid grid-cols-12 gap-5">
            {/* Zone cards */}
            <div className="col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-xs font-black text-[#002c11] uppercase tracking-[0.15em]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Active Zones</h3>
                  <div className="h-[2px] w-12 bg-[#fc8e44] rounded-full"></div>
                </div>
                <button className="text-[11px] font-bold text-[#035925] hover:text-[#002c11] flex items-center gap-1 transition-colors">
                  View Map
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
                </button>
              </div>

              {[
                { name: 'Zone A', crop: 'Tomato', emoji: '🍅', days: 31, total: 120, area: '2.5 acres', irrigation: 'Running', irrigDot: 'bg-blue-500' },
                { name: 'Zone B', crop: 'Onion', emoji: '🧅', days: 61, total: 150, area: '2.5 acres', irrigation: 'Off', irrigDot: 'bg-gray-400' }
              ].map((zone) => (
                <div key={zone.name} className="bg-white rounded-xl p-5 shadow-sm border border-[#002c11]/[0.04] hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-[#f9f6f1] flex items-center justify-center text-2xl border border-[#002c11]/5">{zone.emoji}</div>
                      <div>
                        <h4 className="font-black text-[#002c11] text-[15px]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{zone.name} — {zone.crop}</h4>
                        <p className="text-[11px] text-[#5d6c7b]">{zone.area} · Planted {zone.days} days ago</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 bg-[#f9f6f1] px-2.5 py-1 rounded-full">
                        <span className={`w-2 h-2 rounded-full ${zone.irrigDot}`}></span>
                        <span className="text-[10px] font-bold text-[#002c11]/60">{zone.irrigation}</span>
                      </div>
                      <button className="h-8 px-3 text-[11px] font-bold rounded-lg bg-[#035925] text-white hover:bg-[#002c11] transition-colors">
                        💧 Irrigate
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="font-bold text-[#002c11]/50">Growth Progress</span>
                      <span className="font-black text-[#002c11]">{Math.round(zone.days/zone.total*100)}% · Day {zone.days}/{zone.total}</span>
                    </div>
                    <div className="w-full bg-[#002c11]/[0.06] rounded-full h-2.5">
                      <div className="h-2.5 rounded-full bg-gradient-to-r from-[#035925] to-[#0a8f3f] transition-all" style={{ width: `${zone.days/zone.total*100}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right column */}
            <div className="col-span-4 space-y-4">
              {/* Tasks */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-xs font-black text-[#002c11] uppercase tracking-[0.15em]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Today</h3>
                  <div className="h-[2px] w-8 bg-[#fc8e44] rounded-full"></div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-[#002c11]/[0.04] divide-y divide-[#002c11]/[0.04]">
                  {[
                    { task: 'Morning Irrigation', zone: 'Zone A', time: '6:00 AM', status: 'pending', color: 'bg-[#fc8e44]' },
                    { task: 'Fertilizer Application', zone: 'Zone B', time: '2:00 PM', status: 'pending', color: 'bg-[#fc8e44]' },
                    { task: 'Crop Scouting', zone: 'Zone A', time: '4:00 PM', status: 'done', color: 'bg-[#035925]' }
                  ].map((t, i) => (
                    <div key={i} className="flex items-center gap-3 p-3.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${t.color}`}></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-[#002c11] truncate">{t.task}</p>
                        <p className="text-[10px] text-[#5d6c7b]">{t.zone} · {t.time}</p>
                      </div>
                      {t.status === 'pending' ? (
                        <button className="text-[10px] font-black text-[#fc8e44] bg-[#fc8e44]/10 px-2.5 py-1 rounded-full border border-[#fc8e44]/20 shrink-0">TODO</button>
                      ) : (
                        <span className="text-[10px] font-black text-[#035925] bg-[#035925]/10 px-2.5 py-1 rounded-full border border-[#035925]/20 shrink-0">DONE</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Weather */}
              <div className="bg-[#002c11] rounded-xl p-5 text-white">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Weather</h3>
                  <span className="text-lg">🌤️</span>
                </div>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-4xl font-black" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>28°</span>
                  <span className="text-white/50 text-sm mb-1 font-medium">Partly Cloudy</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Humidity', value: '72%' },
                    { label: 'Wind', value: '12 km/h' },
                    { label: 'Rain Risk', value: '15%' },
                    { label: 'UV Index', value: '6' }
                  ].map((w) => (
                    <div key={w.label} className="bg-white/[0.06] rounded-lg p-2.5">
                      <p className="text-[9px] text-white/30 font-bold uppercase tracking-wider">{w.label}</p>
                      <p className="text-sm font-black text-white">{w.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
