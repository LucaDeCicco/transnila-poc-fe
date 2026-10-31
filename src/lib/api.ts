import { AvailabilityMessageResponse, BlobReference, ConfirmedLocation, Driver, ExtractionResult, FleetRefreshStatus, LiveFleetResponse, LocationInput, MapConfig, OfferStatus, OfferSyncProgress, OffersResponse, OfferTripPrefill, RefreshResponse, TripSearchResult, Vehicle, VehicleHistory, VehicleRoute } from '../types/vehicle';

export const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
if (!API_BASE) console.warn('EXPO_PUBLIC_API_BASE_URL nu este configurat.');

const TOKEN_KEY = 'transnila_poc_access_token';
type AuthEvent = 'blocked' | 'unauthorized';
let accessToken = readStoredToken();
let authEventHandler: ((event: AuthEvent) => void) | null = null;

export function setAuthEventHandler(handler: ((event: AuthEvent) => void) | null) {
  authEventHandler = handler;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  try {
    if (typeof window === 'undefined') return;
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* Storage can be unavailable in private browser contexts. */ }
}

export function getAccessToken() {
  return accessToken;
}

export function getAuthorizationHeaders(): Record<string, string> {
  return accessToken ? { authorization: `Bearer ${accessToken}` } : {};
}

async function request<T>(path: string, init?: RequestInit, authenticated = true): Promise<T> {
  if (!API_BASE) throw new Error('Adresa backendului nu este configurată.');
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(authenticated ? getAuthorizationHeaders() : {}),
      ...init?.headers
    }
  });
  const payload = await response.json().catch(() => null);
  handleAccessResponse(response.status, payload, authenticated);
  if (!response.ok) throw new ApiError(errorMessage(payload, response.status), response.status, payload);
  return payload as T;
}

async function requestBlob(path: string) {
  if (!API_BASE) throw new Error('Adresa backendului nu este configurată.');
  const response = await fetch(`${API_BASE}${path}`, { headers: getAuthorizationHeaders() });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    handleAccessResponse(response.status, payload, true);
    throw new ApiError(errorMessage(payload, response.status), response.status, payload);
  }
  return response.blob();
}

function handleAccessResponse(status: number, payload: unknown, authenticated: boolean) {
  if (apiCode(payload) === 'BLOCKED_IP') authEventHandler?.('blocked');
  else if (authenticated && status === 401) authEventHandler?.('unauthorized');
}

function apiCode(payload: unknown) {
  if (!payload || typeof payload !== 'object' || !('code' in payload)) return null;
  return typeof payload.code === 'string' ? payload.code : null;
}

function readStoredToken() {
  try { return typeof window === 'undefined' ? null : window.sessionStorage.getItem(TOKEN_KEY); }
  catch { return null; }
}

function errorMessage(payload: { message?: unknown } | null, status: number) {
  if (Array.isArray(payload?.message)) {
    const messages = payload.message.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
    if (messages.length) return messages.join(' ');
  }
  if (typeof payload?.message === 'string' && payload.message.trim() && payload.message !== 'Internal server error') {
    return payload.message;
  }
  if (status === 503) return 'Serviciul solicitat nu este disponibil momentan. Încearcă din nou.';
  if (status >= 500) return 'A apărut o problemă internă. Încearcă din nou.';
  return `Cererea nu a putut fi procesată (${status}).`;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly payload: unknown) { super(message); }
}

export const api = {
  auth: {
    preflight: () => request<{ allowed: true }>('/auth/preflight', undefined, false),
    login: (username: string, password: string) => request<{ accessToken: string; expiresIn: number }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password })
    }, false),
    session: () => request<{ authenticated: true }>('/auth/session')
  },
  list: (activeOnly = true) => request<Vehicle[]>(`/vehicles?activeOnly=${activeOnly}`),
  get: (id: string) => request<Vehicle>(`/vehicles/${encodeURIComponent(id)}`),
  patch: (id: string, data: object) => request<Vehicle>(`/vehicles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateVehicleDestination: (id: string, data: LocationInput & { resolution: ConfirmedLocation }) => request<Vehicle>(`/vehicles/${encodeURIComponent(id)}/destination`, { method: 'PATCH', body: JSON.stringify(data) }),
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
  resolveLocation: (data: LocationInput) => request<ConfirmedLocation>('/trips/locations/resolve', { method: 'POST', body: JSON.stringify(data) }),
  cancelTripUpload: (blobUrl: string) => request<{ deleted: boolean }>('/trips/cancel-upload', { method: 'POST', body: JSON.stringify({ blobUrl }) }),
  assignTrip: (vehicleId: string, data: object) => request<Vehicle>(`/trips/vehicles/${encodeURIComponent(vehicleId)}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateTripLocation: (vehicleId: string, kind: 'pickup' | 'delivery', data: LocationInput & { resolution: ConfirmedLocation }) => request<Vehicle>(`/trips/vehicles/${encodeURIComponent(vehicleId)}/locations/${kind}`, { method: 'PATCH', body: JSON.stringify(data) }),
  search: (query: string) => request<TripSearchResult[]>(`/search?q=${encodeURIComponent(query)}`),
  tripDocument: (vehicleId: string) => requestBlob(`/trips/vehicles/${encodeURIComponent(vehicleId)}/document`)
  ,drivers: (activeOnly = true) => request<Driver[]>(`/drivers?activeOnly=${activeOnly}`),
  createDriver: (data: object) => request<Driver>('/drivers', { method: 'POST', body: JSON.stringify(data) }),
  updateDriver: (id: string, data: object) => request<Driver>(`/drivers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  assignDrivers: (vehicleId: string, data: { driverIds: string[]; currentDriverId?: string | null }) => request<Vehicle>(`/vehicles/${encodeURIComponent(vehicleId)}/drivers`, { method: 'PATCH', body: JSON.stringify(data) })
  ,offers: (status?: OfferStatus, query = '') => request<OffersResponse>(`/offers?${new URLSearchParams({ ...(status ? { status } : {}), ...(query ? { q: query } : {}) }).toString()}`),
  refreshOffers: () => request<OfferSyncProgress>('/offers/refresh', { method: 'POST' }),
  offerTripPrefill: (id: string) => request<OfferTripPrefill>(`/offers/${encodeURIComponent(id)}/trip-prefill`)
};
