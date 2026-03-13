import './_group.css';

export function RedesignLogin() {
  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Left Panel - Video + Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12">
        {/* Drone video background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          src="/assets/drone_farm_aerial.mp4"
        />
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/80 via-green-800/70 to-emerald-700/60"></div>
        <div className="absolute inset-0 bg-black/20"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Mkulima AI</span>
          </div>
        </div>
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-extrabold text-white leading-tight mb-4">Smart Farming<br/>Starts Here</h2>
            <p className="text-green-100/80 text-lg leading-relaxed max-w-md">AI-powered crop management, irrigation automation, and real-time scouting for your farm in Malivundo, Pwani.</p>
          </div>
          <div className="flex gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-4 border border-white/10">
              <p className="text-3xl font-bold text-white">5</p>
              <p className="text-green-200/70 text-sm font-medium">Acres</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-4 border border-white/10">
              <p className="text-3xl font-bold text-white">2</p>
              <p className="text-green-200/70 text-sm font-medium">Active Zones</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-4 border border-white/10">
              <p className="text-3xl font-bold text-white">AI</p>
              <p className="text-green-200/70 text-sm font-medium">Powered</p>
            </div>
          </div>
        </div>
        <p className="text-green-200/40 text-sm relative z-10">Malivundo, Pwani Region — Tanzania</p>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
            </div>
            <span className="text-xl font-bold text-gray-900">Mkulima AI</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-gray-500 mb-8">Sign in to manage your farm operations.</p>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <input type="email" defaultValue="admin@farm.co.tz" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-gray-50 focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all" readOnly />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input type="password" defaultValue="admin123" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-gray-50 focus:ring-2 focus:ring-green-500/30 focus:border-green-600 transition-all" readOnly />
            </div>
            <button className="w-full bg-green-700 hover:bg-green-800 text-white py-3.5 rounded-xl font-semibold text-base shadow-lg shadow-green-700/25 transition-all">
              Sign In
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center mt-8">Contact your administrator for account access</p>
        </div>
      </div>
    </div>
  );
}
