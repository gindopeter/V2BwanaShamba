import { Zap, ArrowRight, Sprout, Droplets, Shield } from 'lucide-react';

export default function Login() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="bg-slate-900/80 backdrop-blur-xl w-full max-w-md rounded-3xl shadow-2xl border border-slate-800 overflow-hidden relative z-10">
        <div className="p-10 text-center border-b border-slate-800">
          <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            <Zap className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2 tracking-tight">Mkulima AI</h1>
          <p className="text-emerald-400/80 font-medium">Tanzania Farm Operations</p>
        </div>

        <div className="p-10 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-slate-400 text-sm">
              <Sprout className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>AI-powered crop monitoring & scouting</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400 text-sm">
              <Droplets className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Smart irrigation scheduling & automation</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400 text-sm">
              <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Secure access with your Replit account</span>
            </div>
          </div>

          <a
            href="/api/login"
            className="w-full flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-4 rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all active:scale-95"
          >
            Log In with Replit
            <ArrowRight className="w-6 h-6" />
          </a>

          <p className="text-xs text-slate-600 text-center">
            Sign in with Google, GitHub, or email via Replit
          </p>
        </div>
      </div>
    </div>
  );
}
