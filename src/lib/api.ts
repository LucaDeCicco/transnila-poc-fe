import { AvailabilityMessageResponse, FleetRefreshStatus, RefreshResponse, Vehicle } from '../types/vehicle';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
if (!API_BASE) console.warn('EXPO_PUBLIC_API_BASE_URL nu este configurat.');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) throw new Error('Adresa backendului nu este configurată.');
  const response = await fetch(`${API_BASE}${path}`, {
    ...init, headers: { 'content-type': 'application/json', ...init?.headers }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message ?? `Cererea a eșuat (${response.status}).`);
  return payload as T;
}

export const api = {
  list: () => request<Vehicle[]>('/vehicles'),
  get: (id: string) => request<Vehicle>(`/vehicles/${encodeURIComponent(id)}`),
  patch: (id: string, data: object) => request<Vehicle>(`/vehicles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  fleetRefreshStatus: () => request<FleetRefreshStatus>('/refresh/fleet/status'),
  autoFleet: () => request<RefreshResponse>('/refresh/fleet/auto', { method: 'POST' }),
  manualFleet: () => request<RefreshResponse>('/refresh/fleet/manual', { method: 'POST' }),
  availabilityMessage: () => request<AvailabilityMessageResponse>('/availability-message'),
  refreshAvailabilityMessage: () => request<AvailabilityMessageResponse>('/availability-message/refresh', { method: 'POST' }),
  autoVehicle: (id: string) => request<RefreshResponse>(`/refresh/vehicles/${encodeURIComponent(id)}/auto`, { method: 'POST' }),
  manualVehicle: (id: string) => request<RefreshResponse>(`/refresh/vehicles/${encodeURIComponent(id)}/manual`, { method: 'POST' })
};
