import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Login from './components/Login';
import WeatherWidget from './components/WeatherWidget';
import ZoneCard from './components/ZoneCard';
import TaskList from './components/TaskList';
import NewTaskModal from './components/NewTaskModal';
import LiveScout from './components/LiveScout';
import FarmMap from './components/FarmMap';
import ActionQueue from './components/ActionQueue';
import SettingsPage from './components/SettingsPage';
import { fetchZones, fetchTasks, runEngineChecks, updateTaskStatus, Zone, Task } from './lib/api';
import { RefreshCw, Plus, Loader2 } from 'lucide-react';

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

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView} user={user} onLogout={handleLogout}>
      {/* Top bar */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-[#002c11]/5 px-6 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h2 className="text-lg font-black text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
            {currentView === 'dashboard' && 'Farm Overview'}
            {currentView === 'scout' && 'Live Scout'}
            {currentView === 'map' && 'Farm Map'}
            {currentView === 'settings' && 'Settings'}
          </h2>
          <p className="text-[11px] text-[#5d6c7b]">Malivundo, Pwani · 5 Acres · {zones.length} Active Zones</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-[#035925]/5 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-[#035925] animate-pulse"></span>
            <span className="text-[11px] font-bold text-[#035925]">All Systems Online</span>
          </div>
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
        </div>
      </div>

      <div className="p-6 lg:p-8 max-w-[1100px] mx-auto">
        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Active Zones', value: String(zones.length || '0'), sub: zones.map(z => z.crop_type).join(' & ') || 'No zones', icon: '🌱', borderColor: '#035925' },
                { label: 'Water Usage', value: '1,240L', sub: '↓ 12% vs yesterday', icon: '💧', borderColor: '#0082f3' },
                { label: 'Pending Tasks', value: String(pendingCount), sub: `${tasks.filter(t => t.status === 'Pending' && t.task_type === 'Irrigation').length} irrigation`, icon: '⚡', borderColor: '#fc8e44' },
                { label: 'Temperature', value: weather ? `${Math.round(weather.current?.temp || 28)}°C` : '28°C', sub: weather?.current?.condition || 'Loading...', icon: '☀️', borderColor: '#f5e197' },
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
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              {/* Zone cards */}
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

              {/* Right column */}
              <div className="xl:col-span-4 space-y-4">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xs font-black text-[#002c11] uppercase tracking-[0.15em]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Today</h3>
                    <div className="h-[2px] w-8 bg-[#fc8e44] rounded-full"></div>
                  </div>
                  <TaskList tasks={tasks.filter(t => t.task_type === 'Irrigation').slice(0, 4)} onAction={handleTaskAction} />
                </div>

                <WeatherWidget weather={weather} />
              </div>
            </div>

            {/* Action Queue */}
            <ActionQueue />
          </div>
        )}

        {/* Other Views */}
        {currentView === 'scout' && <LiveScout />}
        {currentView === 'map' && <FarmMap />}
        {currentView === 'settings' && <SettingsPage user={user} onUserUpdate={(u) => setUser(u)} />}

        {/* Modals */}
        {showNewTask && (
          <NewTaskModal
            onClose={() => setShowNewTask(false)}
            onSave={handleCreateTask}
            zones={zones}
          />
        )}
      </div>
    </Layout>
  );
}
