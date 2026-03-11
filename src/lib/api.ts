export interface Zone {
  id: number;
  name: string;
  crop_type: 'Tomato' | 'Onion';
  planting_date: string;
  area_size: number;
  status: string;
  current_growth_day: number;
  expected_yield_kg: number;
  actual_yield_kg: number;
  irrigation_status: 'Off' | 'Running';
  expected_harvest_date: string;
  next_fertigation_date: string | null;
}

export interface Task {
  id: number;
  zone_id: number;
  zone_name: string;
  crop_type: string;
  task_type: 'Irrigation' | 'Fertigation' | 'Scouting';
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

export async function toggleIrrigation(id: number, status: 'Running' | 'Off') {
  await fetch(`/api/zones/${id}/irrigation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
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
