import { AvailabilityMessageResponse, BlobReference, Driver, ExtractionResult, FleetRefreshStatus, LiveFleetResponse, MapConfig, RefreshResponse, TripSearchResult, Vehicle, VehicleHistory, VehicleRoute } from '../types/vehicle';

export const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
if (!API_BASE) console.warn('EXPO_PUBLIC_API_BASE_URL nu este configurat.');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) throw new Error('Adresa backendului nu este configurată.');
  const response = await fetch(`${API_BASE}${path}`, {
    ...init, headers: { 'content-type': 'application/json', ...init?.headers }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(payload?.message ?? `Cererea a eșuat (${response.status}).`, response.status, payload);
  return payload as T;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly payload: unknown) { super(message); }
}

export const api = {
  list: (activeOnly = true) => request<Vehicle[]>(`/vehicles?activeOnly=${activeOnly}`),
  get: (id: string) => request<Vehicle>(`/vehicles/${encodeURIComponent(id)}`),
  patch: (id: string, data: object) => request<Vehicle>(`/vehicles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  fleetRefreshStatus: () => request<FleetRefreshStatus>('/refresh/fleet/status'),
  mapConfig: () => request<MapConfig>('/map/config'),
  liveFleet: () => request<LiveFleetResponse>('/map/live', { method: 'POST' }),
  vehicleRoute: (id: string) => request<VehicleRoute>(`/map/vehicles/${encodeURIComponent(id)}/route`),
  vehicleHistory: (id: string, date: string) => request<VehicleHistory>(`/vehicles/${encodeURIComponent(id)}/history?date=${encodeURIComponent(date)}`),
  autoFleet: () => request<RefreshResponse>('/refresh/fleet/auto', { method: 'POST' }),
  manualFleet: () => request<RefreshResponse>('/refresh/fleet/manual', { method: 'POST' }),
  availabilityMessage: () => request<AvailabilityMessageResponse>('/availability-message'),
  refreshAvailabilityMessage: () => request<AvailabilityMessageResponse>('/availability-message/refresh', { method: 'POST' }),
  autoVehicle: (id: string) => request<RefreshResponse>(`/refresh/vehicles/${encodeURIComponent(id)}/auto`, { method: 'POST' }),
  manualVehicle: (id: string) => request<RefreshResponse>(`/refresh/vehicles/${encodeURIComponent(id)}/manual`, { method: 'POST' })
  ,extractTrip: (blob: BlobReference) => request<ExtractionResult>('/trips/extract', { method: 'POST', body: JSON.stringify(blob) }),
  cancelTripUpload: (blobUrl: string) => request<{ deleted: boolean }>('/trips/cancel-upload', { method: 'POST', body: JSON.stringify({ blobUrl }) }),
  assignTrip: (vehicleId: string, data: object) => request<Vehicle>(`/trips/vehicles/${encodeURIComponent(vehicleId)}`, { method: 'PUT', body: JSON.stringify(data) }),
  search: (query: string) => request<TripSearchResult[]>(`/search?q=${encodeURIComponent(query)}`),
  tripPdfUrl: (vehicleId: string) => `${API_BASE}/trips/vehicles/${encodeURIComponent(vehicleId)}/pdf`
  ,drivers: (activeOnly = true) => request<Driver[]>(`/drivers?activeOnly=${activeOnly}`),
  createDriver: (data: object) => request<Driver>('/drivers', { method: 'POST', body: JSON.stringify(data) }),
  updateDriver: (id: string, data: object) => request<Driver>(`/drivers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  assignDrivers: (vehicleId: string, data: { driverIds: string[]; currentDriverId?: string | null }) => request<Vehicle>(`/vehicles/${encodeURIComponent(vehicleId)}/drivers`, { method: 'PATCH', body: JSON.stringify(data) })
};
