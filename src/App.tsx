import { useCallback, useEffect, useRef, useState } from 'react';
import Layout from './components/Layout';
import Login from './components/Login';
import LandingPage, { type AuthTarget } from './components/LandingPage';
import ZoneCard from './components/ZoneCard';
import NewTaskModal from './components/NewTaskModal';
import LiveScout from './components/LiveScout';
import FarmMap from './components/FarmMap';
import ActionQueue from './components/ActionQueue';
import SettingsPage from './components/SettingsPage';
import ZoneModal from './components/ZoneModal';
import RecommendationsBlock from './components/RecommendationsBlock';
import Reports from './components/Reports';
import Planning from './components/Planning';
import { fetchZones, fetchTasks, runEngineChecks, updateTaskStatus, createZone, updateZone, deleteZone, Zone, Task } from './lib/api';
import { Plus, Loader2, ArrowLeft, BarChart2 } from 'lucide-react';
import { type Language, t } from './lib/i18n';

export interface AuthUser {
  id: number;
  email: string | null;
  phone_number: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
  language?: Language;
  region?: string;
  district?: string;
  farm_size_acres?: number;
}

// Auto-logout after this many ms of no user interaction (security requirement).
// Mirrors IDLE_TIMEOUT_MS in server/middleware/auth.ts.
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;

// While the user is active, refresh the server session at most this often so it
// doesn't expire during interaction that isn't hitting the API (reading, scrolling).
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

// Persist the last view so users return to where they left off after re-login / reload.
const LAST_VIEW_KEY = 'bwanashamba:lastView';

function readLastView(): string {
  const fromHash = window.location.hash.slice(1);
  if (fromHash) return fromHash;
  try {
    return localStorage.getItem(LAST_VIEW_KEY) || 'dashboard';
  } catch {
    return 'dashboard';
  }
}

function getGreeting(lang: Language, firstName: string | null): string {
  const hour = new Date().getHours();
  const name = firstName || (lang === 'sw' ? 'Mkulima' : 'Farmer');
  if (lang === 'sw') {
    const salutation = hour >= 5 && hour < 12 ? 'Habari ya asubuhi'
      : hour >= 12 && hour < 17 ? 'Habari za mchana'
      : 'Habari za jioni';
    return `${salutation}, ${name} 👋`;
  }
  const salutation = hour >= 5 && hour < 12 ? 'Good morning'
    : hour >= 12 && hour < 17 ? 'Good afternoon'
    : 'Good evening';
  return `${salutation}, ${name} 👋`;
}

function getDateLabel(lang: Language): string {
  return new Date().toLocaleDateString(lang === 'sw' ? 'sw-KE' : 'en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  }).toUpperCase();
}

function weatherEmoji(condition = ''): string {
  const l = condition.toLowerCase();
  if (l.includes('rain') || l.includes('shower') || l.includes('mvua')) return '🌧️';
  if (l.includes('cloud') || l.includes('wingu')) return '⛅';
  if (l.includes('thunder') || l.includes('radi')) return '⛈️';
  return '☀️';
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [zones, setZones] = useState<Zone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [currentView, setCurrentView] = useState<string>(readLastView);
  const [chatPrefill, setChatPrefill] = useState<string | null>(null);
  const [loggedOutNotice, setLoggedOutNotice] = useState<string | null>(null);
  // For logged-out visitors: marketing landing first, then the auth/chat flow.
  // null = show the LandingPage; a target = show Login with that panel open.
  const [authTarget, setAuthTarget] = useState<AuthTarget | null>(null);

  // Centralised logout — clears the server session, then the local user.
  // `reason` surfaces a notice on the login screen (e.g. inactivity timeout).
  // `reset` is a clean restart (explicit logout button): forget the last view
  // and hard-reload so the next login lands on the dashboard.
  const logout = useCallback(async (opts: { reason?: string; reset?: boolean } = {}) => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error('Logout request failed', e);
    }
    if (opts.reset) {
      try {
        localStorage.removeItem(LAST_VIEW_KEY);
      } catch {
        /* storage unavailable */
      }
      window.location.hash = '';
      window.location.reload();
      return;
    }
    setLoggedOutNotice(opts.reason ?? null);
    setUser(null);
  }, []);

  // Catch server-enforced idle expiry: if the client timer didn't fire (e.g. the
  // tab was asleep), the next API call returns 401 SESSION_TIMEOUT. Wrap fetch
  // once to turn that into the same in-app "session-expired" signal.
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      if (res.status === 401) {
        try {
          const data = await res.clone().json();
          if (data?.code === 'SESSION_TIMEOUT') {
            window.dispatchEvent(new CustomEvent('session-expired'));
          }
        } catch {
          /* non-JSON 401 — not a session timeout */
        }
      }
      return res;
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  // Keep URL hash in sync with the current view
  const navigate = (view: string) => {
    window.location.hash = view;
    setCurrentView(view);
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', { page_title: view, page_path: `/#${view}` });
    }
  };

  // Handle browser back / forward and manual hash edits
  useEffect(() => {
    const onHashChange = () => {
      const view = window.location.hash.slice(1) || 'dashboard';
      setCurrentView(view);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Remember the last view, and reflect a storage-restored view in the URL hash.
  useEffect(() => {
    try {
      localStorage.setItem(LAST_VIEW_KEY, currentView);
    } catch {
      /* storage unavailable — fall back to hash only */
    }
    if (window.location.hash.slice(1) !== currentView) {
      window.location.hash = currentView;
    }
  }, [currentView]);

  const lang: Language = (user?.language as Language) || 'en';

  useEffect(() => {
    fetch('/api/auth/user', { credentials: 'include' })
      .then(res => {
        if (res.ok) return res.json();
        return null;
      })
      .then(data => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [zonesData, tasksData] = await Promise.all([fetchZones(), fetchTasks()]);
      setZones(zonesData);
      setTasks(tasksData);

      const engineData = await runEngineChecks();
      setWeather(engineData.weather);
    } catch (e) {
      console.error("Failed to load data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Auto-logout after 15 minutes of inactivity (security requirement).
  // The server enforces the same window (server/middleware/auth.ts); this is the
  // UX layer that logs the user out and keeps the server session alive while active.
  useEffect(() => {
    if (!user) return;

    let timer: ReturnType<typeof setTimeout>;
    let lastActivity = Date.now();
    let lastHeartbeat = Date.now();

    const doLogout = () => logout({ reason: t(lang, 'sessionTimedOut') });

    const resetTimer = () => {
      lastActivity = Date.now();
      clearTimeout(timer);
      timer = setTimeout(doLogout, INACTIVITY_LIMIT_MS);
      // Keep the server session alive during interaction that isn't hitting the API.
      if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
        lastHeartbeat = Date.now();
        fetch('/api/auth/heartbeat', { method: 'POST', credentials: 'include' }).catch(() => {});
      }
    };

    // setTimeout is paused while the tab is backgrounded or the device asleep,
    // so re-check the elapsed idle time whenever the tab becomes active again.
    const checkOnResume = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastActivity >= INACTIVITY_LIMIT_MS) {
        doLogout();
      } else {
        resetTimer();
      }
    };

    const events: (keyof WindowEventMap)[] = [
      'mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click',
    ];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    document.addEventListener('visibilitychange', checkOnResume);
    window.addEventListener('focus', checkOnResume);
    // Server-enforced expiry (e.g. tab was asleep past the window).
    window.addEventListener('session-expired', doLogout);
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
      document.removeEventListener('visibilitychange', checkOnResume);
      window.removeEventListener('focus', checkOnResume);
      window.removeEventListener('session-expired', doLogout);
    };
  }, [user, lang, logout]);

  const handleTaskAction = async (id: number, action: string) => {
    const previous = tasks;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: action as any } : t));
    try {
      await updateTaskStatus(id, action);
    } catch (e) {
      console.error("Failed to update task status", e);
      setTasks(previous);
    }
  };

  const handleCreateTask = async (task: any) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(task),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Failed to create task:", data.message || res.status);
        return;
      }
      setShowNewTask(false);
      loadData();
    } catch (e) {
      console.error("Failed to create task", e);
    }
  };

  const handleCreateZone = async (data: { name: string; crop_type: string; planting_date: string; area_size: number }) => {
    await createZone(data);
    setShowZoneModal(false);
    loadData();
  };

  const handleUpdateZone = async (data: { name: string; crop_type: string; planting_date: string; area_size: number }) => {
    if (!editingZone) return;
    try {
      await updateZone(editingZone.id, data);
      setEditingZone(null);
      loadData();
    } catch (e) {
      console.error("Failed to update zone", e);
    }
  };

  const handleDeleteZone = async (id: number) => {
    try {
      await deleteZone(id);
      setEditingZone(null);
      loadData();
    } catch (e) {
      console.error("Failed to delete zone", e);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f9f6f1] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#035925] animate-spin" />
      </div>
    );
  }

  if (!user) {
    // Show the marketing landing first. A pending logout notice (e.g. inactivity
    // timeout) skips it and drops straight into the sign-in panel.
    if (authTarget === null && !loggedOutNotice) {
      return <LandingPage onEnter={setAuthTarget} />;
    }
    return (
      <Login
        notice={loggedOutNotice}
        initialPanel={authTarget ?? undefined}
        onExit={() => {
          setLoggedOutNotice(null);
          setAuthTarget(null);
        }}
        onLogin={(u) => {
          setLoggedOutNotice(null);
          setAuthTarget(null);
          setUser(u);
        }}
      />
    );
  }

  const handleLogout = () => logout({ reset: true });

  const pendingCount = tasks.filter(t => t.status === 'Pending').length;
  const todayTasks = tasks.filter(t => {
    const taskDate = new Date(t.scheduled_time).toDateString();
    return taskDate === new Date().toDateString() && t.status === 'Pending';
  });

  const detailViews = ['tasks-detail', 'zones-detail', 'weather-detail', 'reports'];
  const isDetailView = detailViews.includes(currentView);

  const locationLabel = user.district && user.region
    ? `${user.district}, ${user.region}`
    : user.region
    ? user.region
    : 'Tanzania';

  const farmSizeLabel = user.farm_size_acres ? `${user.farm_size_acres} ${lang === 'sw' ? 'Ekari' : 'Acres'}` : '';

  const viewTitles: Record<string, string> = {
    dashboard: t(lang, 'farmOverview'),
    map: lang === 'sw' ? 'Ramani ya Shamba' : 'The Farm',
    settings: t(lang, 'settings'),
    'tasks-detail': t(lang, 'pendingTasks'),
    'zones-detail': t(lang, 'activZones'),
    'weather-detail': lang === 'sw' ? 'Hali ya Hewa' : 'Weather Forecast',
    reports: t(lang, 'reports'),
  };

  return (
    <Layout currentView={currentView} onNavigate={navigate} user={user} onLogout={handleLogout}>
      {isDetailView && (
        <div
          className="px-5 lg:px-8 py-3.5 flex items-center justify-between sticky top-0 z-20"
          style={{
            background: 'rgba(249,246,241,0.92)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(0,44,17,0.06)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('dashboard')}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: '#002c11' }}
              onMouseOver={e => (e.currentTarget.style.background = 'rgba(0,44,17,0.05)')}
              onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2
                className="text-base font-black text-[#002c11] leading-tight"
                style={{ fontFamily: "'Instrument Sans', sans-serif" }}
              >
                {viewTitles[currentView] || t(lang, 'farmOverview')}
              </h2>
              <p className="text-[10px] text-[#5d6c7b] mt-0.5">
                {locationLabel}{farmSizeLabel ? ` · ${farmSizeLabel}` : ''} · {zones.length} {t(lang, 'activZones')}
              </p>
            </div>
          </div>

          {currentView === 'tasks-detail' && (
            <button
              onClick={() => setShowNewTask(true)}
              className="h-8 px-3.5 flex items-center gap-1.5 rounded-xl font-bold text-[11px] transition-all active:scale-[0.97]"
              style={{
                background: '#002c11',
                color: 'white',
                fontFamily: "'Instrument Sans', sans-serif",
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              {lang === 'sw' ? 'Kazi Mpya' : 'New Task'}
            </button>
          )}
        </div>
      )}

      <div className={currentView === 'assistant' ? 'overflow-hidden' : 'p-6 lg:p-8 pb-28 max-w-[1100px] mx-auto'}>
        {currentView === 'dashboard' && (
          <div className="space-y-6">
            {/* ── Personalised greeting ── */}
            <div>
              <p className="text-[11px] font-bold text-[#5d6c7b] uppercase tracking-[0.12em] mb-1">
                {getDateLabel(lang)}{locationLabel ? ` · ${locationLabel}` : ''}
              </p>
              <h2 className="text-2xl font-black text-[#002c11] leading-tight" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                {getGreeting(lang, user.first_name)}
              </h2>
            </div>

            {/* ── Weather Hero ── */}
            <button
              onClick={() => navigate('weather-detail')}
              className="w-full rounded-2xl overflow-hidden text-left active:scale-[0.99] transition-transform"
              style={{
                background: 'linear-gradient(135deg, #002c11 0%, #035925 100%)',
                boxShadow: '0 4px 20px rgba(0,44,17,0.25)',
              }}
            >
              <div className="p-5 relative overflow-hidden">
                {/* Decorative circles */}
                <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,232,107,0.06)' }} />
                <div style={{ position: 'absolute', top: 10, right: 10, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,232,107,0.04)' }} />

                <div className="flex items-center justify-between relative">
                  <div>
                    <p className="text-white/50 text-[10px] font-bold tracking-[0.1em] uppercase mb-1">
                      {lang === 'sw' ? 'Hali ya Hewa Sasa' : 'Weather Now'}
                    </p>
                    <p
                      className="text-white font-black leading-none"
                      style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 36, letterSpacing: '-0.04em' }}
                    >
                      {weather ? `${Math.round(weather.current?.temp ?? 28)}°C` : '—°C'}
                    </p>
                    <p className="text-white/60 text-xs mt-1.5">
                      {weather?.current?.condition || (lang === 'sw' ? 'Inapakia...' : 'Loading...')}
                      {weather?.location ? ` · ${weather.location}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span style={{ fontSize: 44 }}>{weatherEmoji(weather?.current?.condition)}</span>
                    <div className="flex gap-3 mt-1.5 justify-end">
                      <span className="text-white/50 text-[10px]">
                        💧 {weather ? Math.round(weather.current?.humidity ?? 0) : '—'}%
                      </span>
                      <span className="text-white/50 text-[10px]">
                        🌬️ {weather ? Math.round(weather.current?.wind ?? 0) : '—'} km/h
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </button>

            {/* ── Pending Tasks pill ── */}
            <button
              onClick={() => navigate('tasks-detail')}
              className="w-full rounded-2xl p-4 text-left flex items-center gap-3 active:scale-[0.99] transition-transform"
              style={{
                background: '#fffbeb',
                border: '1.5px solid rgba(217,119,6,0.13)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <span className="text-2xl flex-shrink-0">⚡</span>
              <p
                className="font-black text-[#002c11] flex-shrink-0"
                style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 28, letterSpacing: '-0.04em', lineHeight: 1 }}
              >
                {pendingCount}
              </p>
              <div className="flex-1">
                <p className="text-[11px] font-black text-[#d97706] uppercase tracking-[0.08em] leading-none">
                  {t(lang, 'pendingTasks')}
                </p>
                <p className="text-[10px] text-[#5d6c7b] mt-0.5">
                  {tasks.filter(t => t.status === 'Pending' && t.task_type === 'Scouting').length} {lang === 'sw' ? 'ukaguzi' : 'scouting'}
                </p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>


            {/* ── Active Zones ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h3
                    className="text-[11px] font-black text-[#002c11] uppercase tracking-[0.15em]"
                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                  >
                    {t(lang, 'activZones')}
                  </h3>
                  <div className="h-[2px] w-8 bg-[#fc8e44] rounded-full" />
                </div>
                <button
                  onClick={() => navigate('map')}
                  className="text-[11px] font-bold text-[#035925] hover:text-[#002c11] flex items-center gap-1 transition-colors"
                >
                  {t(lang, 'viewMap')} →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {zones.slice(0, 3).map(zone => (
                  <ZoneCard key={zone.id} zone={zone} onUpdate={loadData} lang={lang} onEdit={z => setEditingZone(z)} />
                ))}
                {zones.length === 0 && (
                  <button
                    onClick={() => setShowZoneModal(true)}
                    className="col-span-full h-24 border-2 border-dashed border-[#035925]/20 rounded-2xl text-sm font-bold text-[#035925]/60 hover:border-[#035925]/40 hover:text-[#035925] hover:bg-[#035925]/5 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> {t(lang, 'addNewZone')}
                  </button>
                )}
              </div>
            </div>

            <RecommendationsBlock
              lang={lang}
              onLearnMore={(msg) => {
                setChatPrefill(msg);
                navigate('assistant');
              }}
            />

            <ActionQueue tasks={tasks} zones={zones} />
          </div>
        )}

        {currentView === 'tasks-detail' && (
          <TasksDetailView tasks={todayTasks.length > 0 ? todayTasks : tasks.filter(t => t.status === 'Pending')} zones={zones} onAction={handleTaskAction} onAdd={() => setShowNewTask(true)} lang={lang} />
        )}

        {currentView === 'zones-detail' && (
          <ZonesDetailView zones={zones} onUpdate={loadData} onEdit={z => setEditingZone(z)} onAdd={() => setShowZoneModal(true)} lang={lang} />
        )}

        {currentView === 'weather-detail' && (
          <WeatherDetailView weather={weather} lang={lang} />
        )}

        {currentView === 'reports' && (
          <div className="p-4 lg:p-6">
            <Reports zones={zones} lang={lang} user={user} />
          </div>
        )}

        {currentView === 'planning' && (
          <div className="p-4 lg:p-6">
            <Planning lang={lang} />
          </div>
        )}

        {currentView === 'assistant' && (
          <LiveScout
            initialMessage={chatPrefill ?? undefined}
            onInitialMessageConsumed={() => setChatPrefill(null)}
          />
        )}
        {currentView === 'map' && <FarmMap zones={zones} onUpdate={loadData} onEdit={z => setEditingZone(z)} onAdd={() => setShowZoneModal(true)} farmSizeAcres={user?.farm_size_acres} lang={lang} />}
        {currentView === 'settings' && <SettingsPage user={user} onUserUpdate={(u) => setUser(u)} lang={lang} />}

        {showNewTask && (
          <NewTaskModal
            onClose={() => setShowNewTask(false)}
            onSave={handleCreateTask}
            zones={zones}
            lang={lang}
          />
        )}

        {showZoneModal && (
          <ZoneModal
            onClose={() => setShowZoneModal(false)}
            onSave={handleCreateZone}
            lang={lang}
            maxAreaSize={user?.farm_size_acres}
            usedAcres={zones.reduce((sum, z) => sum + z.area_size, 0)}
          />
        )}

        {editingZone && (
          <ZoneModal
            zone={editingZone}
            onClose={() => setEditingZone(null)}
            onSave={handleUpdateZone}
            onDelete={handleDeleteZone}
            lang={lang}
            maxAreaSize={user?.farm_size_acres}
            usedAcres={zones.filter(z => z.id !== editingZone.id).reduce((sum, z) => sum + z.area_size, 0)}
          />
        )}
      </div>
    </Layout>
  );
}

function TasksDetailView({ tasks, zones, onAction, onAdd, lang }: { tasks: Task[]; zones: Zone[]; onAction: (id: number, action: string) => void; onAdd: () => void; lang: Language }) {
  return (
    <div className="space-y-4">
      {tasks.length === 0 ? (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-[#002c11]/[0.04] text-center">
          <p className="text-[#5d6c7b] text-sm">{t(lang, 'noPendingTasks')}</p>
        </div>
      ) : (
        tasks.map(task => {
          const zone = zones.find(z => z.id === task.zone_id);
          const emoji = task.task_type === 'Fertigation' ? '🧪' : '🔍';
          const time = new Date(task.scheduled_time);
          return (
            <div key={task.id} className="bg-white rounded-xl p-5 shadow-sm border border-[#002c11]/[0.04]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{emoji}</span>
                  <div>
                    <p className="text-sm font-bold text-[#002c11]">{task.task_type}</p>
                    <p className="text-xs text-[#5d6c7b]">{zone?.name || `Zone ${task.zone_id}`} · {task.duration_minutes || 60} mins</p>
                    <p className="text-[10px] text-[#5d6c7b]/60 mt-0.5">
                      {time.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at {time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                    {task.status}
                  </span>
                  <button
                    onClick={() => onAction(task.id, 'Completed')}
                    className="text-xs font-bold text-[#035925] hover:text-[#002c11] px-3 py-1.5 bg-[#035925]/5 hover:bg-[#035925]/10 rounded-lg transition-colors"
                  >
                    {t(lang, 'complete')}
                  </button>
                </div>
              </div>
              {task.reasoning && (
                <p className="text-[11px] text-[#5d6c7b] mt-2 bg-[#f9f6f1] p-2 rounded-lg">{task.reasoning}</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function ZonesDetailView({ zones, onUpdate, onEdit, onAdd, lang }: { zones: Zone[]; onUpdate: () => void; onEdit: (z: Zone) => void; onAdd: () => void; lang: Language }) {
  return (
    <div className="space-y-4">
      <button
        onClick={onAdd}
        className="w-full h-12 border-2 border-dashed border-[#035925]/20 rounded-xl text-sm font-bold text-[#035925]/60 hover:border-[#035925]/40 hover:text-[#035925] hover:bg-[#035925]/5 transition-all flex items-center justify-center gap-2"
        style={{ fontFamily: "'Instrument Sans', sans-serif" }}
      >
        <Plus className="w-4 h-4" /> {t(lang, 'addNewZone')}
      </button>
      {zones.map(zone => (
        <ZoneCard key={zone.id} zone={zone} onUpdate={onUpdate} onEdit={onEdit} lang={lang} />
      ))}
      {zones.length === 0 && (
        <div className="text-center py-12 text-[#5d6c7b]">
          <p className="text-lg font-bold mb-2">{t(lang, 'noZonesYet')}</p>
          <p className="text-sm">{t(lang, 'addFirstZone')}</p>
        </div>
      )}
    </div>
  );
}

function WeatherDetailView({ weather, lang }: { weather: any; lang: Language }) {
  const current = weather?.current || { temp: 28, condition: 'Loading...', humidity: 72, wind: 12 };
  const forecast = weather?.forecast || [];

  const weatherData = [
    { day: lang === 'sw' ? 'Leo' : 'Today', high: Math.round(current.temp), low: Math.round(current.temp - 6), condition: current.condition, rain: 0 },
    ...forecast,
  ];

  const conditionEmoji = (c: string) => {
    const lower = (c || '').toLowerCase();
    if (lower.includes('rain') || lower.includes('shower') || lower.includes('mvua')) return '🌧️';
    if (lower.includes('cloud') || lower.includes('wingu')) return '⛅';
    if (lower.includes('thunder') || lower.includes('radi')) return '⛈️';
    return '☀️';
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#002c11] rounded-xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/50 text-xs font-bold uppercase tracking-wider">{lang === 'sw' ? 'Hali ya Hewa Sasa' : 'Current Weather'}</p>
            {weather?.location && (
              <p className="text-white/40 text-[11px] mt-0.5">📍 {weather.location}</p>
            )}
            <p className="text-4xl font-black mt-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{Math.round(current.temp)}°C</p>
            <p className="text-white/60 text-sm mt-1">{current.condition}</p>
          </div>
          <span className="text-5xl">{conditionEmoji(current.condition)}</span>
        </div>
        <div className="flex gap-6 text-sm text-white/50">
          <span>{lang === 'sw' ? 'Unyevunyevu' : 'Humidity'} <span className="text-white font-bold">{Math.round(current.humidity)}%</span></span>
          <span>{lang === 'sw' ? 'Upepo' : 'Wind'} <span className="text-white font-bold">{Math.round(current.wind)} km/h</span></span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <h3 className="text-xs font-black text-[#002c11] uppercase tracking-[0.15em]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
          {lang === 'sw' ? 'Utabiri wa Siku 7' : '7-Day Forecast'}
        </h3>
        <div className="h-[2px] w-8 bg-[#fc8e44] rounded-full"></div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {weatherData.map((d, i) => (
          <div key={i} className={`rounded-xl p-4 shadow-sm border ${i === 0 ? 'bg-[#035925]/5 border-[#035925]/20' : 'bg-white border-[#002c11]/[0.04]'}`}>
            <p className="text-xs font-bold text-[#002c11] mb-2">{d.day}</p>
            <span className="text-3xl block mb-2">{conditionEmoji(d.condition)}</span>
            <p className="text-lg font-black text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{d.high}°/{d.low}°</p>
            <p className="text-[10px] text-[#5d6c7b] mt-1">{d.condition}</p>
            {d.rain > 0 && <p className="text-[10px] text-blue-600 mt-0.5">🌧 {d.rain}% {lang === 'sw' ? 'mvua' : 'rain'}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
