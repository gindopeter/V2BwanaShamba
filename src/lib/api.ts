export interface Zone {
  id: number;
  name: string;
  crop_type: string;
  planting_date: string;
  area_size: number;
  status: string;
  current_growth_day: number;
  expected_yield_kg: number;
  actual_yield_kg: number;
  expected_harvest_date: string;
  next_fertigation_date: string | null;
}

export interface Task {
  id: number;
  zone_id: number;
  zone_name: string;
  crop_type: string;
  task_type: 'Fertigation' | 'Scouting';
  scheduled_time: string;
  duration_minutes: number;
  status: 'Pending' | 'Confirmed' | 'Completed' | 'Missed';
  reasoning: string;
}

export async function fetchZones(): Promise<Zone[]> {
  const res = await fetch('/api/zones');
  return res.json();
}

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch('/api/tasks');
  return res.json();
}

export async function updateTaskStatus(id: number, status: string) {
  await fetch(`/api/tasks/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export async function updateZoneYield(id: number, actual_yield_kg: number) {
  await fetch(`/api/zones/${id}/yield`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actual_yield_kg }),
  });
}


export async function runEngineChecks() {
  const res = await fetch('/api/engine/run-checks', { method: 'POST' });
  return res.json();
}

export async function sendChatMessage(message: string, image?: string) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, image }),
  });
  return res.json();
}

export async function analyzeCropImage(zone_id: number, image: string) {
  const res = await fetch('/api/analyze-crop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zone_id, image }),
  });
  return res.json();
}

export async function createZone(data: { name: string; crop_type: string; planting_date: string; area_size: number }) {
  const res = await fetch('/api/zones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'Failed to create zone'); }
  return res.json();
}

export async function updateZone(id: number, data: { name?: string; crop_type?: string; planting_date?: string; area_size?: number; status?: string }) {
  const res = await fetch(`/api/zones/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'Failed to update zone'); }
  return res.json();
}

export async function deleteZone(id: number) {
  const res = await fetch(`/api/zones/${id}`, { method: 'DELETE' });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'Failed to delete zone'); }
  return res.json();
}

export interface Memory {
  id: number;
  category: string;
  fact: string;
  source: string;
  created_at: string;
}

export async function fetchMemories(): Promise<Memory[]> {
  const res = await fetch('/api/memory', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load memory');
  const data = await res.json();
  return data.memories || [];
}

export async function deleteMemory(id: number) {
  const res = await fetch(`/api/memory/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to delete memory'); }
  return res.json();
}
