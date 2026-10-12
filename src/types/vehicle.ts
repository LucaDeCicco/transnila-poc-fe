export type Availability = 'AVAILABLE' | 'ON_TRIP' | 'HEADING_TO_PICKUP';
export type RoutingMode = 'DRIVE' | 'LIGHT_TRUCK' | 'MEDIUM_TRUCK' | 'TRUCK' | 'HEAVY_TRUCK';
export interface Warning { type: 'WIALON' | 'GEOCODING'; message: string; at: string | null }
export interface Vehicle {
  id: string; wialonId: string; registrationNumber: string; driverName: string | null;
  driverPhoneCountryIso: string | null; driverPhoneCountryCode: string | null;
  driverPhoneNumber: string | null; driverPhoneE164: string | null;
  hasTachograph: boolean | null; vehicleModel: string | null; vehicleDetails: string | null;
  availability: Availability | null; destination: string | null; routingMode: RoutingMode; isActive: boolean;
  latitude: number | null; longitude: number | null; speedKph: number | null; positionAt: string | null;
  courseDegrees: number | null; altitudeMeters: number | null; satellites: number | null;
  lastMessageAt: string | null; lastMessageReceivedAt: string | null; trackerParams: Record<string, unknown> | null;
  country: string | null; countryCode: string | null; city: string | null; region: string | null;
  district: string | null; street: string | null; houseNumber: string | null; postcode: string | null;
  formattedAddress: string | null; geocodedLatitude: number | null; geocodedLongitude: number | null;
  lastGeocodedAt: string | null; lastWialonSuccessAt: string | null; lastManualAttemptAt: string | null;
  warnings: Warning[]; hasWarning: boolean; attribution: string;
}
export interface RefreshResponse {
  performed: boolean; success?: boolean; reason?: string; error?: string; nextAllowedAt?: string;
  retryAfter?: number; vehicle?: Vehicle; updated?: number; skipped?: unknown[]; failed?: unknown[];
}
export interface FleetRefreshStatus { lastSuccessAt: string | null }
export interface MapConfig {
  refreshIntervalSeconds: number; styleUrl: string; attribution: string;
}
export interface LiveFleetResponse extends RefreshResponse {
  lastSuccessAt: string | null; vehicles: Vehicle[];
}
export interface VehicleRoute {
  status: 'ready' | 'unavailable'; warning?: string | null;
  feature?: GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>;
  destination?: { latitude: number; longitude: number; formattedAddress: string };
  distanceMeters?: number | null; durationSeconds?: number | null; routingMode?: RoutingMode;
}
export interface AvailabilityMessageResponse {
  message: string;
  generatedAt: string;
  includedVehicles: number;
  incompleteVehicles: number;
  refresh?: RefreshResponse;
}
