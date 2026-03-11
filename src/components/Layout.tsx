import React, { useState } from 'react';
import { LayoutDashboard, Sprout, Map as MapIcon, Settings, Menu, Zap, X, LogOut } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
}

export default function Layout({ children, currentView, onNavigate, onLogout }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500/30">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-indigo-600" />
          <h1 className="font-bold text-lg text-slate-900 tracking-tight">Mkulima AI</h1>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      <div className="flex">
        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 transition duration-200 ease-in-out lg:flex flex-col w-64 bg-white border-r border-slate-200 h-screen shadow-2xl lg:shadow-none`}>
          <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">Mkulima AI</span>
          </div>

          <nav className="flex-1 px-4 space-y-2 mt-4">
            <NavItem 
              icon={<LayoutDashboard />} 
              label="Dashboard" 
              view="dashboard" 
              currentView={currentView} 
              onNavigate={onNavigate} 
              onClose={() => setIsMobileMenuOpen(false)}
            />
            <NavItem 
              icon={<Sprout />} 
              label="Live Scout" 
              view="scout" 
              currentView={currentView} 
              onNavigate={onNavigate} 
              onClose={() => setIsMobileMenuOpen(false)}
            />
            <NavItem 
              icon={<MapIcon />} 
              label="Farm Map" 
              view="map" 
              currentView={currentView} 
              onNavigate={onNavigate} 
              onClose={() => setIsMobileMenuOpen(false)}
            />
          </nav>

          <div className="p-4 border-t border-slate-200 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">System Status</p>
              <div className="flex items-center gap-2 text-sm text-indigo-600 font-medium">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                Online & Monitoring
              </div>
            </div>
            
            <button 
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-red-600 hover:bg-red-50 hover:text-red-700 border border-transparent font-semibold"
            >
              <LogOut size={20} />
              Log Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full relative">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavItem({ icon, label, view, currentView, onNavigate, onClose }: { 
  icon: React.ReactNode, 
  label: string, 
  view: string, 
  currentView: string, 
  onNavigate: (view: string) => void,
  onClose?: () => void
}) {
  const active = currentView === view;
  return (
    <button 
      onClick={() => {
        onNavigate(view);
        if (onClose) onClose();
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        active 
        ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100' 
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
      }`}
    >
      {React.cloneElement(icon as React.ReactElement<{ size?: number }> , { size: 20 })}
      {label}
    </button>
  );
}
