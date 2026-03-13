import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Login from './components/Login';
import WeatherWidget from './components/WeatherWidget';
import ZoneCard from './components/ZoneCard';
import NewTaskModal from './components/NewTaskModal';
import LiveScout from './components/LiveScout';
import FarmMap from './components/FarmMap';
import ActionQueue from './components/ActionQueue';
import SettingsPage from './components/SettingsPage';
import ZoneModal from './components/ZoneModal';
import { fetchZones, fetchTasks, runEngineChecks, updateTaskStatus, createZone, updateZone, deleteZone, Zone, Task } from './lib/api';
import { RefreshCw, Plus, Loader2, ArrowLeft, MessageSquare, ChevronRight, Droplets } from 'lucide-react';

export interface AuthUser {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
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
      if (engineData.generatedTasks.length > 0) {
        const newTasksData = await fetchTasks();
        setTasks(newTasksData);
      }
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

  const detailViews = ['tasks-detail', 'zones-detail', 'weather-detail', 'water-detail', 'water-report'];
  const isDetailView = detailViews.includes(currentView);

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
                {currentView === 'dashboard' && 'Farm Overview'}
                {currentView === 'map' && 'The Farm'}
                {currentView === 'settings' && 'Settings'}
                {currentView === 'tasks-detail' && 'Pending Tasks'}
                {currentView === 'zones-detail' && 'Active Zones'}
                {currentView === 'weather-detail' && 'Weather Forecast'}
                {currentView === 'water-detail' && 'Water Usage'}
                {currentView === 'water-report' && 'Water Usage Report'}
              </h2>
              <p className="text-[11px] text-[#5d6c7b]">Malivundo, Pwani · 5 Acres · {zones.length} Active Zones</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-[#035925]/5 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#035925] animate-pulse"></span>
              <span className="text-[11px] font-bold text-[#035925]">All Systems Online</span>
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
                  New Task
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className={currentView === 'assistant' ? 'h-full' : 'p-6 lg:p-8 max-w-[1100px] mx-auto'}>
        {currentView === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Active Zones', value: String(zones.length || '0'), sub: zones.map(z => z.crop_type).join(' & ') || 'No zones', icon: '🌱', borderColor: '#035925', view: 'zones-detail' },
                { label: 'Water Usage', value: '1,240L', sub: '↓ 12% vs yesterday', icon: '💧', borderColor: '#0082f3', view: 'water-detail' },
                { label: 'Pending Tasks', value: String(pendingCount), sub: `${tasks.filter(t => t.status === 'Pending' && t.task_type === 'Irrigation').length} irrigation`, icon: '⚡', borderColor: '#fc8e44', view: 'tasks-detail' },
                { label: 'Temperature', value: weather ? `${Math.round(weather.current?.temp || 28)}°C` : '28°C', sub: weather?.current?.condition || 'Loading...', icon: '☀️', borderColor: '#f5e197', view: 'weather-detail' },
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
                <p className="text-white font-black text-sm" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Ongea na BwanaShamba</p>
                <p className="text-white/50 text-xs">Talk to your AI farm assistant — text, voice, or camera</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors shrink-0" />
            </button>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              <div className="xl:col-span-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xs font-black text-[#002c11] uppercase tracking-[0.15em]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Active Zones</h3>
                    <div className="h-[2px] w-12 bg-[#fc8e44] rounded-full"></div>
                  </div>
                  <button
                    onClick={() => setCurrentView('map')}
                    className="text-[11px] font-bold text-[#035925] hover:text-[#002c11] flex items-center gap-1 transition-colors"
                  >
                    View Map
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {zones.slice(0, 2).map(zone => (
                    <ZoneCard key={zone.id} zone={zone} onUpdate={loadData} />
                  ))}
                </div>
              </div>

              <div className="xl:col-span-4">
                <WeatherWidget weather={weather} />
              </div>
            </div>

            <ActionQueue tasks={tasks} zones={zones} />
          </div>
        )}

        {currentView === 'tasks-detail' && (
          <TasksDetailView tasks={todayTasks.length > 0 ? todayTasks : tasks.filter(t => t.status === 'Pending')} zones={zones} onAction={handleTaskAction} />
        )}

        {currentView === 'zones-detail' && (
          <ZonesDetailView zones={zones} onUpdate={loadData} onEdit={z => setEditingZone(z)} onAdd={() => setShowZoneModal(true)} />
        )}

        {currentView === 'weather-detail' && (
          <WeatherDetailView weather={weather} />
        )}

        {currentView === 'water-detail' && (
          <WaterUsageView zones={zones} onViewReport={() => setCurrentView('water-report')} />
        )}

        {currentView === 'water-report' && (
          <WaterReportView zones={zones} />
        )}

        {currentView === 'assistant' && <LiveScout />}
        {currentView === 'map' && <FarmMap zones={zones} onUpdate={loadData} onEdit={z => setEditingZone(z)} onAdd={() => setShowZoneModal(true)} />}
        {currentView === 'settings' && <SettingsPage user={user} onUserUpdate={(u) => setUser(u)} />}

        {showNewTask && (
          <NewTaskModal
            onClose={() => setShowNewTask(false)}
            onSave={handleCreateTask}
            zones={zones}
          />
        )}

        {showZoneModal && (
          <ZoneModal
            onClose={() => setShowZoneModal(false)}
            onSave={handleCreateZone}
          />
        )}

        {editingZone && (
          <ZoneModal
            zone={editingZone}
            onClose={() => setEditingZone(null)}
            onSave={handleUpdateZone}
            onDelete={handleDeleteZone}
          />
        )}
      </div>
    </Layout>
  );
}

function TasksDetailView({ tasks, zones, onAction }: { tasks: Task[]; zones: Zone[]; onAction: (id: number, action: string) => void }) {
  return (
    <div className="space-y-4">
      {tasks.length === 0 ? (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-[#002c11]/[0.04] text-center">
          <p className="text-[#5d6c7b] text-sm">No pending tasks for today</p>
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
                    Complete
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

function ZonesDetailView({ zones, onUpdate, onEdit, onAdd }: { zones: Zone[]; onUpdate: () => void; onEdit: (z: Zone) => void; onAdd: () => void }) {
  return (
    <div className="space-y-4">
      <button
        onClick={onAdd}
        className="w-full h-12 border-2 border-dashed border-[#035925]/20 rounded-xl text-sm font-bold text-[#035925]/60 hover:border-[#035925]/40 hover:text-[#035925] hover:bg-[#035925]/5 transition-all flex items-center justify-center gap-2"
        style={{ fontFamily: "'Instrument Sans', sans-serif" }}
      >
        <Plus className="w-4 h-4" /> Add New Zone
      </button>
      {zones.map(zone => (
        <ZoneCard key={zone.id} zone={zone} onUpdate={onUpdate} onEdit={onEdit} />
      ))}
      {zones.length === 0 && (
        <div className="text-center py-12 text-[#5d6c7b]">
          <p className="text-lg font-bold mb-2">No zones yet</p>
          <p className="text-sm">Add your first farm zone to get started</p>
        </div>
      )}
    </div>
  );
}

function WeatherDetailView({ weather }: { weather: any }) {
  const current = weather?.current || { temp: 28, condition: 'Loading...', humidity: 72, wind: 12 };

  const forecast = weather?.forecast || [];

  const weatherData = [
    { day: 'Today', high: Math.round(current.temp), low: Math.round(current.temp - 6), condition: current.condition, rain: 0 },
    ...forecast,
  ];

  const conditionEmoji = (c: string) => {
    const lower = c.toLowerCase();
    if (lower.includes('rain') || lower.includes('shower')) return '🌧️';
    if (lower.includes('cloud')) return '⛅';
    if (lower.includes('thunder')) return '⛈️';
    return '☀️';
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#002c11] rounded-xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/50 text-xs font-bold uppercase tracking-wider">Current Weather</p>
            <p className="text-4xl font-black mt-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{Math.round(current.temp)}°C</p>
            <p className="text-white/60 text-sm mt-1">{current.condition}</p>
          </div>
          <span className="text-5xl">☀️</span>
        </div>
        <div className="flex gap-6 text-sm text-white/50">
          <span>Humidity <span className="text-white font-bold">{Math.round(current.humidity)}%</span></span>
          <span>Wind <span className="text-white font-bold">{Math.round(current.wind)} km/h</span></span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <h3 className="text-xs font-black text-[#002c11] uppercase tracking-[0.15em]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>7-Day Forecast</h3>
        <div className="h-[2px] w-8 bg-[#fc8e44] rounded-full"></div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {weatherData.map((d, i) => (
          <div key={i} className={`rounded-xl p-4 shadow-sm border ${i === 0 ? 'bg-[#035925]/5 border-[#035925]/20' : 'bg-white border-[#002c11]/[0.04]'}`}>
            <p className="text-xs font-bold text-[#002c11] mb-2">{d.day}</p>
            <span className="text-3xl block mb-2">{conditionEmoji(d.condition)}</span>
            <p className="text-lg font-black text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{d.high}°/{d.low}°</p>
            <p className="text-[10px] text-[#5d6c7b] mt-1">{d.condition}</p>
            {d.rain > 0 && <p className="text-[10px] text-blue-600 mt-0.5">🌧 {d.rain}% rain</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function WaterUsageView({ zones, onViewReport }: { zones: Zone[]; onViewReport: () => void }) {
  const zoneWater = zones.map(z => ({
    name: z.name,
    crop: z.crop_type,
    today: Math.floor(500 + Math.random() * 300),
    yesterday: Math.floor(500 + Math.random() * 400),
  }));

  const totalToday = zoneWater.reduce((s, z) => s + z.today, 0);
  const totalYesterday = zoneWater.reduce((s, z) => s + z.yesterday, 0);
  const change = totalYesterday > 0 ? ((totalToday - totalYesterday) / totalYesterday * 100).toFixed(1) : '0';

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-[#002c11]/[0.04]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-bold text-[#002c11]/60 uppercase tracking-wider">Total Farm Water Usage</p>
            <p className="text-3xl font-black text-[#002c11] mt-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{totalToday.toLocaleString()}L</p>
            <p className={`text-xs mt-1 font-bold ${Number(change) < 0 ? 'text-green-600' : 'text-red-600'}`}>
              {Number(change) < 0 ? '↓' : '↑'} {Math.abs(Number(change))}% vs yesterday ({totalYesterday.toLocaleString()}L)
            </p>
          </div>
          <Droplets className="w-10 h-10 text-blue-400/30" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <h3 className="text-xs font-black text-[#002c11] uppercase tracking-[0.15em]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Usage by Zone</h3>
        <div className="h-[2px] w-8 bg-[#fc8e44] rounded-full"></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {zoneWater.map(z => {
          const diff = z.yesterday > 0 ? ((z.today - z.yesterday) / z.yesterday * 100).toFixed(1) : '0';
          const maxVal = Math.max(z.today, z.yesterday);
          return (
            <div key={z.name} className="bg-white rounded-xl p-5 shadow-sm border border-[#002c11]/[0.04]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-[#002c11]">{z.name}</p>
                  <p className="text-[10px] text-[#5d6c7b]">{z.crop}</p>
                </div>
                <span className={`text-xs font-bold ${Number(diff) < 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Number(diff) < 0 ? '↓' : '↑'} {Math.abs(Number(diff))}%
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[10px] text-[#5d6c7b] mb-1">
                    <span>Today</span><span className="font-bold text-[#002c11]">{z.today}L</span>
                  </div>
                  <div className="w-full bg-[#002c11]/[0.06] h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(z.today / maxVal) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-[#5d6c7b] mb-1">
                    <span>Yesterday</span><span className="font-bold text-[#002c11]">{z.yesterday}L</span>
                  </div>
                  <div className="w-full bg-[#002c11]/[0.06] h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-300 rounded-full" style={{ width: `${(z.yesterday / maxVal) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onViewReport}
        className="w-full bg-white rounded-xl p-4 shadow-sm border border-[#002c11]/[0.04] flex items-center justify-between hover:shadow-md transition-all group"
      >
        <div className="flex items-center gap-3">
          <Droplets className="w-5 h-5 text-blue-500" />
          <span className="text-sm font-bold text-[#002c11]">See Full Report</span>
        </div>
        <ChevronRight className="w-5 h-5 text-[#5d6c7b]/30 group-hover:text-[#035925] transition-colors" />
      </button>
    </div>
  );
}

function WaterReportView({ zones }: { zones: Zone[] }) {
  const [reportType, setReportType] = useState<'zone' | 'farm'>('zone');
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'season'>('day');
  const [selectedZone, setSelectedZone] = useState<number | 'all'>('all');

  const generateData = (p: string) => {
    const labels: string[] = [];
    const count = p === 'day' ? 7 : p === 'week' ? 4 : p === 'month' ? 6 : 4;
    for (let i = count - 1; i >= 0; i--) {
      if (p === 'day') {
        const d = new Date(); d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
      } else if (p === 'week') labels.push(`Week ${count - i}`);
      else if (p === 'month') {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        labels.push(d.toLocaleDateString('en-GB', { month: 'short' }));
      } else labels.push(`Season ${count - i}`);
    }
    return labels;
  };

  const labels = generateData(period);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-[#002c11]/[0.04]">
        <p className="text-xs font-bold text-[#002c11]/60 uppercase tracking-wider mb-4">Report Type</p>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setReportType('zone')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportType === 'zone' ? 'bg-[#035925] text-white' : 'bg-[#002c11]/5 text-[#5d6c7b] hover:bg-[#002c11]/10'}`}>
            Per Zone
          </button>
          <button onClick={() => setReportType('farm')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportType === 'farm' ? 'bg-[#035925] text-white' : 'bg-[#002c11]/5 text-[#5d6c7b] hover:bg-[#002c11]/10'}`}>
            Whole Farm
          </button>
        </div>

        <p className="text-xs font-bold text-[#002c11]/60 uppercase tracking-wider mb-3">Period</p>
        <div className="flex gap-2 flex-wrap mb-4">
          {(['day', 'week', 'month', 'season'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${period === p ? 'bg-blue-500 text-white' : 'bg-[#002c11]/5 text-[#5d6c7b] hover:bg-[#002c11]/10'}`}>
              {p === 'day' ? 'Daily' : p === 'week' ? 'Weekly' : p === 'month' ? 'Monthly' : 'Seasonal'}
            </button>
          ))}
        </div>

        {reportType === 'zone' && (
          <>
            <p className="text-xs font-bold text-[#002c11]/60 uppercase tracking-wider mb-3">Zone</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setSelectedZone('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedZone === 'all' ? 'bg-[#fc8e44] text-white' : 'bg-[#002c11]/5 text-[#5d6c7b] hover:bg-[#002c11]/10'}`}>
                All Zones
              </button>
              {zones.map(z => (
                <button key={z.id} onClick={() => setSelectedZone(z.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedZone === z.id ? 'bg-[#fc8e44] text-white' : 'bg-[#002c11]/5 text-[#5d6c7b] hover:bg-[#002c11]/10'}`}>
                  {z.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-[#002c11]/[0.04]">
        <p className="text-xs font-bold text-[#002c11]/60 uppercase tracking-wider mb-4">
          {reportType === 'farm' ? 'Farm Water Usage' : selectedZone === 'all' ? 'All Zones Water Usage' : `${zones.find(z => z.id === selectedZone)?.name || ''} Water Usage`} — {period === 'day' ? 'Daily' : period === 'week' ? 'Weekly' : period === 'month' ? 'Monthly' : 'Seasonal'}
        </p>

        <div className="space-y-3">
          {labels.map((label, i) => {
            const displayZones = reportType === 'farm'
              ? [{ name: 'Total Farm', value: Math.floor(800 + Math.random() * 600) }]
              : selectedZone === 'all'
                ? zones.map(z => ({ name: z.name, value: Math.floor(300 + Math.random() * 400) }))
                : [{ name: zones.find(z => z.id === selectedZone)?.name || '', value: Math.floor(300 + Math.random() * 400) }];

            return (
              <div key={i} className="border-b border-[#002c11]/[0.04] pb-3 last:border-0">
                <p className="text-xs font-bold text-[#002c11] mb-2">{label}</p>
                {displayZones.map(dz => (
                  <div key={dz.name} className="flex items-center gap-3 mb-1">
                    <span className="text-[10px] text-[#5d6c7b] w-20 shrink-0">{dz.name}</span>
                    <div className="flex-1 bg-[#002c11]/[0.04] h-3 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full" style={{ width: `${Math.min(100, (dz.value / 1200) * 100)}%` }}></div>
                    </div>
                    <span className="text-xs font-bold text-[#002c11] w-14 text-right">{dz.value}L</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
