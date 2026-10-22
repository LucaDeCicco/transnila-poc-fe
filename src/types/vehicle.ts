export type Availability = 'AVAILABLE' | 'ON_TRIP' | 'HEADING_TO_PICKUP';
export type RoutingMode = 'DRIVE' | 'LIGHT_TRUCK' | 'MEDIUM_TRUCK' | 'TRUCK' | 'HEAVY_TRUCK';
export interface Warning { type: 'WIALON' | 'GEOCODING'; message: string; at: string | null }
export interface Vehicle {
  id: string; wialonId: string; registrationNumber: string; driverName: string | null;
  driverPhoneCountryIso: string | null; driverPhoneCountryCode: string | null;
  driverPhoneNumber: string | null; driverPhoneE164: string | null;
  hasTachograph: boolean | null; vehicleModel: string | null; vehicleDetails: string | null;
  availability: Availability | null; destination: string | null; routingMode: RoutingMode; isActive: boolean;
  destinationGeocodedQuery: string | null; destinationLatitude: number | null; destinationLongitude: number | null;
  destinationFormattedAddress: string | null; destinationCountry: string | null; destinationCountryCode: string | null;
  destinationCity: string | null; destinationPostcode: string | null; destinationGeocodingConfidence: number | null;
  destinationLocationPrecision: 'EXACT' | 'APPROXIMATE' | null; destinationLocationConfirmedAt: string | null;
  destinationLocationInput: LocationInput | null; destinationLocation: ConfirmedLocation | null;
  destinationGeocodedAt: string | null; destinationGeocodingError: string | null; destinationGeocodingErrorAt: string | null;
  isAvailableSoon: boolean; availableSoonStraightLineDistanceMeters: number | null;
  availableSoonRoadDistanceMeters: number | null; availableSoonRouteCalculatedAt: string | null;
  latitude: number | null; longitude: number | null; speedKph: number | null; positionAt: string | null;
  courseDegrees: number | null; altitudeMeters: number | null; satellites: number | null;
  lastMessageAt: string | null; lastMessageReceivedAt: string | null; trackerParams: Record<string, unknown> | null;
  country: string | null; countryCode: string | null; city: string | null; region: string | null;
  district: string | null; street: string | null; houseNumber: string | null; postcode: string | null;
  formattedAddress: string | null; geocodedLatitude: number | null; geocodedLongitude: number | null;
  lastGeocodedAt: string | null; lastWialonSuccessAt: string | null; lastManualAttemptAt: string | null;
  warnings: Warning[]; hasWarning: boolean; attribution: string;
  currentTrip: Trip | null;
  currentDriverId: string | null;
  drivers: VehicleDriver[];
}
export interface VehicleDriver {
  id: string; name: string; phoneCountryIso: string | null; phoneCountryCode: string | null;
  phoneNumber: string | null; phoneE164: string | null; slot: number; isCurrent: boolean;
}
export interface Driver {
  id: string; name: string; phoneCountryIso: string | null; phoneCountryCode: string | null;
  phoneNumber: string | null; phoneE164: string | null; notes: string | null; isActive: boolean;
  activeAssignments: { vehicleId: string; slot: number; vehicle: Vehicle }[];
}
export interface Trip {
  id: string; vehicleId: string; status: Availability; orderNumber: string; externalReference: string | null; orderDate: string | null;
  clientName: string | null; clientVat: string | null; clientAddress: string | null; clientContactName: string | null; clientContactEmail: string | null; clientContactPhone: string | null;
  pickupCompany: string | null; pickupAddress: string; pickupCity: string | null; pickupPostcode: string | null; pickupCountry: string | null; pickupCountryCode: string | null; pickupLocalDate: string; pickupLocalTime: string | null; pickupTimeZone: string | null; pickupContactName: string | null; pickupContactPhone: string | null; pickupReference: string | null; pickupInstructions: string | null; pickupGoogleMapsUrl: string | null; pickupLocation: ConfirmedLocation | null;
  deliveryCompany: string | null; deliveryAddress: string | null; deliveryCity: string | null; deliveryPostcode: string | null; deliveryCountry: string | null; deliveryCountryCode: string | null; deliveryLocalDate: string; deliveryLocalTime: string | null; deliveryTimeZone: string | null; deliveryContactName: string | null; deliveryContactPhone: string | null; deliveryReference: string | null; deliveryInstructions: string | null; deliveryGoogleMapsUrl: string | null; deliveryLocation: ConfirmedLocation | null;
  cargoDescription: string | null; cargoQuantity: number | null; cargoPackageType: string | null; cargoDimensions: string | null; cargoWeightKg: number | null; cargoVolumeM3: number | null; cargoLoadingMeters: number | null; cargoPallets: number | null; cargoParcels: number | null; cargoDangerous: boolean | null; cargoStackable: boolean | null; cargoTemperatureC: number | null;
  priceAmount: number | null; currency: string | null; vatRate: number | null; vatAmount: number | null; totalAmount: number | null; paymentTerms: string | null; invoicingInstructions: string | null; operationalInstructions: string | null; contractualNotes: string | null;
  assignedDriverName: string | null; assignedDriverPhone: string | null; assignedRegistrationNumber: string;
  sourceDocumentType: 'PDF' | 'IMAGE' | null; sourceDocumentUrl: string | null; sourceDocumentPathname: string | null;
  sourceDocumentOriginalName: string | null; sourceDocumentContentType: string | null; sourceDocumentSize: number | null;
  extraction: Record<string, unknown> | null; additionalData: unknown; createdAt: string; updatedAt: string;
}
export interface TripSearchResult { vehicleId: string; registrationNumber: string; driverName: string | null; orderNumber: string | null; externalReference: string | null; clientName: string | null; status: Availability | null }
export interface BlobReference { blobUrl: string; pathname: string; originalName: string; contentType: string; size: number }
export interface ExtractedField { value: string | null; confidence: number; sourceText: string | null }
export interface ExtractionResult { fields: Record<string, ExtractedField>; additionalData: { label: string; value: string }[]; documentWarnings: string[]; usage?: unknown }
export interface LocationInput {
  company?: string | null; address?: string | null; city?: string | null; postcode?: string | null; country?: string | null;
  countryCode?: string | null; googleMapsUrl?: string | null;
}
export interface ConfirmedLocation {
  inputKey: string; latitude: number; longitude: number; formattedAddress: string; country: string; countryCode: string;
  city: string; postcode: string | null; precision: 'EXACT' | 'APPROXIMATE'; source: 'GEOCODING' | 'POSTCODE' | 'GOOGLE_MAPS';
  confidence: number | null; resultType: string | null; warning: string | null;
}
export interface RefreshResponse {
  performed: boolean; success?: boolean; reason?: string; error?: string; nextAllowedAt?: string;
  retryAfter?: number; vehicle?: Vehicle; updated?: number; skipped?: unknown[]; failed?: unknown[];
}
export interface FleetRefreshStatus { lastSuccessAt: string | null }
export interface MapConfig {
  refreshIntervalSeconds: number; stalePositionMinutes: number; styleUrl: string; attribution: string;
}
export interface LiveFleetResponse extends RefreshResponse {
  lastSuccessAt: string | null; vehicles: Vehicle[];
}
export interface VehicleRoute {
  status: 'ready' | 'unavailable'; warning?: string | null;
  feature?: GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>;
  destination?: { latitude: number; longitude: number; formattedAddress: string; precision?: string | null };
  distanceMeters?: number | null; durationSeconds?: number | null; routingMode?: RoutingMode;
}
export interface VehicleTripHistoryEvent {
  type: 'TRIP'; startedAt: string; endedAt: string; durationSeconds: number;
  startAddress: string | null; endAddress: string | null;
  startLatitude: number | null; startLongitude: number | null; endLatitude: number | null; endLongitude: number | null;
  distanceKm: number | null; maxSpeedKph: number | null;
}
export interface VehicleParkingHistoryEvent {
  type: 'PARKING'; startedAt: string; endedAt: string; durationSeconds: number;
  address: string | null; latitude: number | null; longitude: number | null; engineOnSeconds: number;
}
export type VehicleHistoryEvent = VehicleTripHistoryEvent | VehicleParkingHistoryEvent;
export interface VehicleHistory {
  vehicleId: string; registrationNumber: string; date: string; timeZone: string; source: 'WIALON'; generatedAt: string;
  events: VehicleHistoryEvent[];
}
export interface AvailabilityMessageResponse {
  message: string;
  generatedAt: string;
  includedVehicles: number;
  incompleteVehicles: number;
  vehicles: AvailabilityMessageVehicle[];
  refresh?: RefreshResponse;
}
export interface AvailabilityMessageVehicle {
  id: string;
  registrationNumber: string;
  vehicleModel: string | null;
  included: boolean;
  reason: string | null;
  locationSource: 'destination' | 'current';
  location: string | null;
  isAvailableSoon: boolean;
  availableSoonRoadDistanceMeters: number | null;
}
