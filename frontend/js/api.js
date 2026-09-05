/**
 * TEMAS 2.0 - API Client Service
 */

const API_BASE = '/api';

export async function fetchEarthquakes(params = {}) {
  const query = new URLSearchParams();
  if (params.min_magnitude !== undefined) query.set('min_magnitude', params.min_magnitude);
  if (params.max_magnitude !== undefined) query.set('max_magnitude', params.max_magnitude);
  if (params.start_date) query.set('start_date', params.start_date);
  if (params.end_date) query.set('end_date', params.end_date);
  if (params.region) query.set('region', params.region);
  if (params.limit) query.set('limit', params.limit);
  if (params.offset) query.set('offset', params.offset);

  const res = await fetch(`${API_BASE}/earthquakes?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch earthquakes: ${res.statusText}`);
  return await res.json();
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.statusText}`);
  return await res.json();
}

export async function fetchTectonicBoundaries() {
  const res = await fetch(`${API_BASE}/boundaries/tectonic`);
  if (!res.ok) throw new Error(`Failed to fetch tectonic boundaries: ${res.statusText}`);
  return await res.json();
}

export async function triggerManualSync() {
  const res = await fetch(`${API_BASE}/sync`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to trigger sync: ${res.statusText}`);
  return await res.json();
}
