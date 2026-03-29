import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Login from './components/Login';
import ZoneCard from './components/ZoneCard';
import NewTaskModal from './components/NewTaskModal';
import LiveScout from './components/LiveScout';
import FarmMap from './components/FarmMap';
import ActionQueue from './components/ActionQueue';
import SettingsPage from './components/SettingsPage';
import ZoneModal from './components/ZoneModal';
import RecommendationsBlock from './components/RecommendationsBlock';
import { fetchZones, fetchTasks, runEngineChecks, updateTaskStatus, createZone, updateZone, deleteZone, Zone, Task } from './lib/api';
import { RefreshCw, Plus, Loader2, ArrowLeft, MessageSquare, ChevronRight, BarChart2 } from 'lucide-react';
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
  const [currentView, setCurrentView] = useState('dashboard');

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

  const handleTaskAction = async (id: number, action: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: action as any } : t));
    await updateTaskStatus(id, action);
  };

  const handleCreateTask = async (task: any) => {
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(task),
      });
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
    await updateZone(editingZone.id, data);
    setEditingZone(null);
    loadData();
  };

  const handleDeleteZone = async (id: number) => {
    await deleteZone(id);
    setEditingZone(null);
    loadData();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f9f6f1] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#035925] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={(u) => setUser(u)} />;
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  };

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
    <Layout currentView={currentView} onNavigate={setCurrentView} user={user} onLogout={handleLogout}>
      {currentView !== 'assistant' && (
        <div className="bg-white/80 backdrop-blur-sm border-b border-[#002c11]/5 px-6 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {isDetailView && (
              <button onClick={() => setCurrentView('dashboard')} className="p-1.5 hover:bg-[#002c11]/5 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-[#002c11]" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-black text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                {viewTitles[currentView] || t(lang, 'farmOverview')}
              </h2>
              <p className="text-[11px] text-[#5d6c7b]">
                {locationLabel}{farmSizeLabel ? ` · ${farmSizeLabel}` : ''} · {zones.length} {t(lang, 'activZones')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-[#035925]/5 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#035925] animate-pulse"></span>
              <span className="text-[11px] font-bold text-[#035925]">{t(lang, 'allSystems')}</span>
            </div>
            {currentView === 'dashboard' && (
              <>
                <button
                  onClick={loadData}
                  className="h-9 w-9 flex items-center justify-center text-[#5d6c7b] hover:text-[#002c11] border border-[#002c11]/10 rounded-lg bg-white transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowNewTask(true)}
                  className="h-9 px-4 bg-[#035925] hover:bg-[#002c11] text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors active:scale-[0.98]"
                  style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {lang === 'sw' ? 'Kazi Mpya' : 'New Task'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className={currentView === 'assistant' ? 'h-full' : 'p-6 lg:p-8 max-w-[1100px] mx-auto'}>
        {currentView === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  label: t(lang, 'activZones'),
                  value: String(zones.length || '0'),
                  sub: zones.map(z => z.crop_type).join(' · ') || (lang === 'sw' ? 'Hakuna maeneo' : 'No zones'),
                  icon: '🌱',
                  borderColor: '#035925',
                  view: 'zones-detail'
                },
                {
                  label: t(lang, 'pendingTasks'),
                  value: String(pendingCount),
                  sub: `${tasks.filter(t => t.status === 'Pending' && t.task_type === 'Scouting').length} ${lang === 'sw' ? 'ukaguzi' : 'scouting'}`,
                  icon: '⚡',
                  borderColor: '#fc8e44',
                  view: 'tasks-detail'
                },
                {
                  label: t(lang, 'temperature'),
                  value: weather ? `${Math.round(weather.current?.temp || 28)}°C` : '28°C',
                  sub: weather?.current?.condition || (lang === 'sw' ? 'Inapakia...' : 'Loading...'),
                  icon: '☀️',
                  borderColor: '#f5e197',
                  view: 'weather-detail'
                },
              ].map((s) => (
                <button
                  key={s.label}
                  onClick={() => setCurrentView(s.view)}
                  className="bg-white rounded-xl p-4 border-l-[3px] shadow-sm text-left hover:shadow-md hover:scale-[1.02] transition-all group"
                  style={{ borderLeftColor: s.borderColor }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg">{s.icon}</span>
                    <ChevronRight className="w-4 h-4 text-[#5d6c7b]/30 group-hover:text-[#035925] transition-colors" />
                  </div>
                  <p className="text-[22px] font-black text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{s.value}</p>
                  <p className="text-[11px] font-bold text-[#002c11]/60 mt-0.5">{s.label}</p>
                  <p className="text-[10px] text-[#5d6c7b] mt-0.5">{s.sub}</p>
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentView('assistant')}
              className="w-full bg-gradient-to-r from-[#002c11] to-[#035925] rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-all group active:scale-[0.99]"
            >
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0 border border-white/10">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div className="text-left flex-1">
                <p className="text-white font-black text-sm" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                  {lang === 'sw' ? 'Ongea na BwanaShamba' : 'Talk to BwanaShamba'}
                </p>
                <p className="text-white/50 text-xs">
                  {lang === 'sw' ? 'Msaidizi wa AI wa shamba lako — maandishi, sauti, au kamera' : 'Talk to your AI farm assistant — text, voice, or camera'}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors shrink-0" />
            </button>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              <div className="xl:col-span-12 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xs font-black text-[#002c11] uppercase tracking-[0.15em]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                      {t(lang, 'activZones')}
                    </h3>
                    <div className="h-[2px] w-12 bg-[#fc8e44] rounded-full"></div>
                  </div>
                  <button
                    onClick={() => setCurrentView('map')}
                    className="text-[11px] font-bold text-[#035925] hover:text-[#002c11] flex items-center gap-1 transition-colors"
                  >
                    {t(lang, 'viewMap')}
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {zones.slice(0, 3).map(zone => (
                    <ZoneCard key={zone.id} zone={zone} onUpdate={loadData} lang={lang} onEdit={z => setEditingZone(z)} />
                  ))}
                  {zones.length === 0 && (
                    <button
                      onClick={() => setShowZoneModal(true)}
                      className="col-span-full h-28 border-2 border-dashed border-[#035925]/20 rounded-xl text-sm font-bold text-[#035925]/60 hover:border-[#035925]/40 hover:text-[#035925] hover:bg-[#035925]/5 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> {t(lang, 'addNewZone')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <RecommendationsBlock lang={lang} />

            <ActionQueue tasks={tasks} zones={zones} />
          </div>
        )}

        {currentView === 'tasks-detail' && (
          <TasksDetailView tasks={todayTasks.length > 0 ? todayTasks : tasks.filter(t => t.status === 'Pending')} zones={zones} onAction={handleTaskAction} lang={lang} />
        )}

        {currentView === 'zones-detail' && (
          <ZonesDetailView zones={zones} onUpdate={loadData} onEdit={z => setEditingZone(z)} onAdd={() => setShowZoneModal(true)} lang={lang} />
        )}

        {currentView === 'weather-detail' && (
          <WeatherDetailView weather={weather} lang={lang} />
        )}

        {currentView === 'reports' && (
          <ReportsView zones={zones} tasks={tasks} lang={lang} />
        )}

        {currentView === 'assistant' && <LiveScout />}
        {currentView === 'map' && <FarmMap zones={zones} onUpdate={loadData} onEdit={z => setEditingZone(z)} onAdd={() => setShowZoneModal(true)} />}
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
          />
        )}
      </div>
    </Layout>
  );
}

function TasksDetailView({ tasks, zones, onAction, lang }: { tasks: Task[]; zones: Zone[]; onAction: (id: number, action: string) => void; lang: Language }) {
  return (
    <div className="space-y-4">
      {tasks.length === 0 ? (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-[#002c11]/[0.04] text-center">
          <p className="text-[#5d6c7b] text-sm">{t(lang, 'noPendingTasks')}</p>
        </div>
      ) : (
        tasks.map(task => {
          const zone = zones.find(z => z.id === task.zone_id);
          const emoji = task.task_type === 'Irrigation' ? '💧' : task.task_type === 'Fertigation' ? '🧪' : '🔍';
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

function ReportsView({ zones, tasks, lang }: { zones: Zone[]; tasks: Task[]; lang: Language }) {
  const completedTasks = tasks.filter(t => t.status === 'Completed');
  const pendingTasks = tasks.filter(t => t.status === 'Pending');
  const harvestedZones = zones.filter(z => z.status === 'Harvested');
  const activeZones = zones.filter(z => z.status === 'Active');

  const totalExpectedYield = zones.reduce((sum, z) => sum + (z.expected_yield_kg || 0), 0);
  const totalActualYield = zones.reduce((sum, z) => sum + (z.actual_yield_kg || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: lang === 'sw' ? 'Maeneo Hai' : 'Active Zones', value: activeZones.length, icon: '🌱', color: '#035925' },
          { label: lang === 'sw' ? 'Maeneo Yaliovunwa' : 'Harvested', value: harvestedZones.length, icon: '🌾', color: '#fc8e44' },
          { label: lang === 'sw' ? 'Kazi Zilizokamilika' : 'Tasks Done', value: completedTasks.length, icon: '✅', color: '#0082f3' },
          { label: lang === 'sw' ? 'Kazi Zinazosubiri' : 'Pending Tasks', value: pendingTasks.length, icon: '⏳', color: '#5d6c7b' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-[#002c11]/[0.04] border-l-[3px]" style={{ borderLeftColor: s.color }}>
            <span className="text-2xl block mb-2">{s.icon}</span>
            <p className="text-2xl font-black text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{s.value}</p>
            <p className="text-[11px] text-[#5d6c7b] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-[#002c11]/[0.04]">
        <h3 className="font-black text-[#002c11] mb-4 text-sm uppercase tracking-wider" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
          {lang === 'sw' ? 'Muhtasari wa Mavuno' : 'Yield Summary'}
        </h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-[#5d6c7b]">{lang === 'sw' ? 'Mavuno Yanayotarajiwa' : 'Expected Yield'}</p>
            <p className="text-2xl font-black text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
              {totalExpectedYield.toLocaleString()} kg
            </p>
          </div>
          <div>
            <p className="text-xs text-[#5d6c7b]">{lang === 'sw' ? 'Mavuno Halisi' : 'Actual Yield'}</p>
            <p className="text-2xl font-black text-[#035925]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
              {totalActualYield.toLocaleString()} kg
            </p>
          </div>
        </div>
        {totalExpectedYield > 0 && (
          <div>
            <div className="flex justify-between text-xs text-[#5d6c7b] mb-1">
              <span>{lang === 'sw' ? 'Utendaji' : 'Performance'}</span>
              <span>{Math.round((totalActualYield / totalExpectedYield) * 100)}%</span>
            </div>
            <div className="w-full bg-[#002c11]/[0.06] h-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#035925] rounded-full transition-all"
                style={{ width: `${Math.min(100, (totalActualYield / totalExpectedYield) * 100)}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-[#002c11]/[0.04]">
        <h3 className="font-black text-[#002c11] mb-4 text-sm uppercase tracking-wider" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
          {lang === 'sw' ? 'Utendaji kwa Eneo' : 'Performance by Zone'}
        </h3>
        {zones.length === 0 ? (
          <p className="text-sm text-[#5d6c7b] text-center py-4">{lang === 'sw' ? 'Hakuna maeneo bado' : 'No zones yet'}</p>
        ) : (
          <div className="space-y-4">
            {zones.map(zone => {
              const growth = zone.current_growth_day || 0;
              const cropDays: Record<string, number> = { 'Tomato': 120, 'Onion': 150, 'Pepper': 130, 'Cabbage': 100, 'Spinach': 50, 'Cucumber': 70, 'Watermelon': 90, 'Eggplant': 130, 'Carrot': 90, 'Lettuce': 65, 'Okra': 60, 'Green Bean': 60, 'Maize': 120 };
              const maxDays = cropDays[zone.crop_type] || 120;
              const progress = Math.min(100, Math.round((growth / maxDays) * 100));
              return (
                <div key={zone.id} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm font-bold text-[#002c11]">{zone.name}</span>
                      <span className="text-xs text-[#5d6c7b] ml-2">· {zone.crop_type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${zone.status === 'Active' ? 'bg-green-50 text-green-700' : zone.status === 'Harvested' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {zone.status}
                      </span>
                      <span className="text-xs text-[#5d6c7b]">{progress}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-[#002c11]/[0.06] h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-[#035925] rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-[#5d6c7b]">
                    <span>{lang === 'sw' ? 'Siku' : 'Day'} {growth}/{maxDays}</span>
                    {zone.actual_yield_kg > 0 && <span>✅ {zone.actual_yield_kg} kg {lang === 'sw' ? 'yaliovunwa' : 'harvested'}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-[#002c11]/[0.04]">
        <h3 className="font-black text-[#002c11] mb-4 text-sm uppercase tracking-wider" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
          {lang === 'sw' ? 'Shughuli za Hivi Karibuni' : 'Recent Activity'}
        </h3>
        {completedTasks.length === 0 ? (
          <p className="text-sm text-[#5d6c7b] text-center py-4">{lang === 'sw' ? 'Hakuna shughuli zilizokamilika bado' : 'No completed activities yet'}</p>
        ) : (
          <div className="space-y-2">
            {completedTasks.slice(0, 10).map(task => (
              <div key={task.id} className="flex items-center gap-3 py-2 border-b border-[#002c11]/[0.04] last:border-0">
                <span className="text-lg">{task.task_type === 'Fertigation' ? '🧪' : task.task_type === 'Irrigation' ? '💧' : '🔍'}</span>
                <div className="flex-1">
                  <p className="text-xs font-bold text-[#002c11]">{task.task_type}</p>
                  <p className="text-[10px] text-[#5d6c7b]">{new Date(task.scheduled_time).toLocaleDateString()}</p>
                </div>
                <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{lang === 'sw' ? 'Imekamilika' : 'Done'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
