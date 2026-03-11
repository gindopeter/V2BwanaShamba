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
import YieldCard from './components/YieldCard';
import { fetchZones, fetchTasks, runEngineChecks, updateTaskStatus, Zone, Task } from './lib/api';
import { RefreshCw, Plus, Settings, Droplets, Battery, ArrowDownToLine, Loader2 } from 'lucide-react';

interface AuthUser {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_image_url: string | null;
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView} user={user}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
              {currentView === 'dashboard' && 'Farm Overview'}
              {currentView === 'scout' && 'Live Scout'}
              {currentView === 'map' && 'Farm Map'}
              {currentView === 'settings' && 'Settings'}
            </h2>
            <p className="text-indigo-600 font-medium tracking-wide text-sm uppercase mt-1">Malivundo, Pwani • 5 Acres</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={loadData}
              className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 bg-white shadow-sm"
              title="Refresh Data"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={() => setShowNewTask(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-full font-medium shadow-sm transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" />
              New Task
            </button>
          </div>
        </div>

        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <div className="flex flex-col xl:grid xl:grid-cols-12 gap-6 xl:gap-8">
            {/* 1. Today's Schedule */}
            <div className="xl:col-span-4 h-full order-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-900">Today's Schedule</h3>
                <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-full">
                  {tasks.filter(t => t.status === 'Pending' && t.task_type === 'Irrigation').length} Pending
                </span>
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex-1 overflow-y-auto">
                <TaskList tasks={tasks.filter(t => t.task_type === 'Irrigation').slice(0, 5)} onAction={handleTaskAction} />
              </div>
            </div>

            {/* 2. Active Zones */}
            <div className="xl:col-span-8 h-full order-2 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-900">Active Zones</h3>
                <button onClick={() => setCurrentView('map')} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 tracking-wide uppercase">View Map</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                {zones.slice(0, 2).map(zone => (
                  <ZoneCard key={zone.id} zone={zone} onUpdate={loadData} />
                ))}
              </div>
            </div>

            {/* 3. Weather Widget */}
            <div className="xl:col-span-4 h-full order-3">
              <WeatherWidget weather={weather} />
            </div>

            {/* 4. Action Queue */}
            <div className="xl:col-span-8 h-full order-4">
              <ActionQueue />
            </div>

            {/* 5. Water Usage */}
            <div className="xl:col-span-12 h-full order-5">
              <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm relative overflow-hidden group h-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Droplets className="w-32 h-32 text-indigo-500" />
                </div>
                
                <div className="flex items-center gap-4 relative z-10">
                  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <Droplets className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-600 mb-1">Total Water Usage</h3>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-bold text-slate-900 tracking-tighter">1,240</span>
                      <span className="text-slate-500 font-medium mb-1">Liters / day</span>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 flex flex-col items-start sm:items-end gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full font-bold">-12%</span>
                    <span className="text-slate-500 font-medium">vs yesterday</span>
                  </div>
                  <p className="text-sm text-slate-400">Optimal usage maintained across all zones.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Scout View */}
        {currentView === 'scout' && (
          <LiveScout />
        )}

        {/* Farm Map View */}
        {currentView === 'map' && (
          <FarmMap />
        )}

        {/* Settings View */}
        {currentView === 'settings' && (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 text-center">
             <Settings className="w-16 h-16 text-slate-300 mx-auto mb-4" />
             <h3 className="text-xl font-bold text-slate-900">Settings</h3>
             <p className="text-slate-500 mt-2">Configuration options coming soon.</p>
          </div>
        )}

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
