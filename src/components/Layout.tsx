import React, { useState } from 'react';
import { LayoutDashboard, Sprout, Map as MapIcon, Settings, Menu, X, LogOut, MessageSquare } from 'lucide-react';

interface AuthUser {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
  user: AuthUser;
  onLogout: () => void;
}

export default function Layout({ children, currentView, onNavigate, user, onLogout }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { icon: <LayoutDashboard />, label: 'Overview', view: 'dashboard' },
    { icon: <Sprout />, label: 'Live Scout', view: 'scout' },
    { icon: <MapIcon />, label: 'Farm Map', view: 'map' },
    { icon: <Settings />, label: 'Settings', view: 'settings' },
  ];

  return (
    <div className="min-h-screen bg-[#f9f6f1] flex" style={{ fontFamily: "'Lato', system-ui, sans-serif" }}>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-[#002c11] p-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#035925] rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <span className="text-sm font-bold text-white" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>MKULIMA</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-white/60 hover:text-white rounded-lg transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 transition duration-200 ease-in-out w-[240px] bg-[#002c11] flex flex-col shrink-0`}>
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
          {navItems.map((item) => {
            const active = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => {
                  onNavigate(item.view);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${active ? 'bg-[#035925] text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'}`}
              >
                {React.cloneElement(item.icon as React.ReactElement<{ size?: number }>, { size: 17 })}
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/[0.08] space-y-2">
          <div className="flex items-center gap-2.5 p-2">
            <div className="w-8 h-8 rounded-lg bg-[#035925] flex items-center justify-center text-white text-[10px] font-black shrink-0">
              {(user.first_name || user.email || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white truncate">
                {user.first_name ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}` : user.email}
              </p>
              <p className="text-[10px] text-white/30 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={14} />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto lg:pt-0 pt-16">
        {children}
      </main>
    </div>
  );
}
