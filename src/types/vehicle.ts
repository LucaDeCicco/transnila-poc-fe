export type Availability = 'AVAILABLE' | 'ON_TRIP' | 'HEADING_TO_PICKUP';
export interface Warning { type: 'WIALON' | 'GEOCODING'; message: string; at: string | null }
export interface Vehicle {
  id: string; wialonId: string; registrationNumber: string; driverName: string | null;
  driverPhoneCountryIso: string | null; driverPhoneCountryCode: string | null;
  driverPhoneNumber: string | null; driverPhoneE164: string | null;
  hasTachograph: boolean | null; vehicleModel: string | null; vehicleDetails: string | null;
  availability: Availability | null; destination: string | null; isActive: boolean;
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
export interface AvailabilityMessageResponse {
  message: string;
  generatedAt: string;
  includedVehicles: number;
  incompleteVehicles: number;
  refresh?: RefreshResponse;
}
