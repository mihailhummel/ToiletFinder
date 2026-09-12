import { auth } from '@/firebase';
import type { DashboardData, LocationsData, LocationsQuery, Viewer } from '@/types';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// Attach the signed-in user's Firebase ID token. The server re-verifies it and
// checks admin/allowlist — this header is the whole auth story.
async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { headers: await authHeaders(), signal });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export const fetchMe = () => getJson<Viewer>('/api/me');
export const fetchDashboard = () => getJson<DashboardData>('/api/dashboard');

/** Locations tab. Filtering + paging happen server-side (see lib/locations.mjs). */
export function fetchLocations(query: LocationsQuery = {}, signal?: AbortSignal) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '' || value === false) continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return getJson<LocationsData>(`/api/locations${qs ? `?${qs}` : ''}`, signal);
}
