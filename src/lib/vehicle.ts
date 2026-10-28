import { Availability, Vehicle } from '../types/vehicle';
import { romanianCountryName } from './country';

export const statusColors: Record<Availability, { accent: string; surface: string; badge: string }> = {
  AVAILABLE: { accent: '#34d399', surface: '#10251f', badge: '#145c46' },
  HEADING_TO_PICKUP: { accent: '#f59e0b', surface: '#282014', badge: '#714a0b' },
  ON_TRIP: { accent: '#60a5fa', surface: '#122238', badge: '#1e4f87' }
};

export const unspecifiedStatus = { accent: '#94a3b8', surface: '#141c29', badge: '#334155' };
export const statusTone = (value: Availability | null) => value ? statusColors[value] : unspecifiedStatus;
export const tachograph = (value: boolean | null) => value === null ? 'Nespecificat' : value ? 'Da' : 'Nu';

export function normalizeRegistration(value: string | null | undefined) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

export function vehicleLocation(vehicle: Vehicle) {
  if (vehicle.postcode) return [[vehicle.postcode, vehicle.city].filter(Boolean).join(' '), vehicle.country].filter(Boolean).join(', ');
  return [vehicle.city, vehicle.country].filter(Boolean).join(', ') || vehicle.formattedAddress || '';
}

export function vehicleDestination(vehicle: Vehicle) {
  const country = romanianCountryName(vehicle.destinationCountryCode, vehicle.destinationCountry ?? '');
  const summary = [[vehicle.destinationPostcode, vehicle.destinationCity].filter(Boolean).join(' '), country]
    .filter(Boolean)
    .join(', ');
  return summary || vehicle.destination || vehicle.destinationFormattedAddress || '';
}

export function positionAgeMinutes(vehicle: Vehicle, now = Date.now()) {
  if (!vehicle.positionAt) return null;
  const value = new Date(vehicle.positionAt).getTime();
  return Number.isFinite(value) ? Math.max(0, Math.floor((now - value) / 60_000)) : null;
}

export type VehicleIssue = {
  key: string;
  severity: 'attention' | 'incomplete';
  title: string;
  detail: string;
  section: 'operations' | 'profile' | 'diagnostics';
};

export function vehicleIssues(vehicle: Vehicle, staleMinutes = 15): VehicleIssue[] {
  const issues: VehicleIssue[] = [];
  if (vehicle.latitude === null || vehicle.longitude === null) {
    issues.push({ key: 'missing-position', severity: 'attention', title: 'Poziție GPS absentă', detail: 'Wialon nu a furnizat coordonate valide.', section: 'diagnostics' });
  } else {
    const age = positionAgeMinutes(vehicle);
    if (age === null || age >= staleMinutes) issues.push({
      key: 'stale-position', severity: 'attention', title: 'Poziție GPS veche',
      detail: age === null ? 'Momentul poziției nu este disponibil.' : `Ultima poziție are ${age} minute.`, section: 'diagnostics'
    });
  }
  for (const warning of vehicle.warnings) issues.push({
    key: `warning-${warning.type}`, severity: 'attention',
    title: warning.type === 'WIALON' ? 'Eroare Wialon' : 'Eroare Geoapify', detail: warning.message, section: 'diagnostics'
  });
  if (!vehicle.availability) issues.push({ key: 'status', severity: 'attention', title: 'Status nespecificat', detail: 'Setează situația operațională a vehiculului.', section: 'operations' });
  if (vehicle.destinationGeocodingError) issues.push({ key: 'destination', severity: 'attention', title: 'Destinație neidentificată', detail: vehicle.destinationGeocodingError, section: 'operations' });
  if (!vehicle.vehicleModel) issues.push({ key: 'model', severity: 'incomplete', title: 'Model lipsă', detail: 'Vehiculul nu poate fi grupat corect în mesaj.', section: 'profile' });
  if (!vehicle.driverName) issues.push({ key: 'driver', severity: 'incomplete', title: 'Șofer nespecificat', detail: 'Completează numele șoferului.', section: 'profile' });
  if (!vehicle.driverPhoneE164) issues.push({ key: 'phone', severity: 'incomplete', title: 'Telefon nespecificat', detail: 'Completează numărul de contact.', section: 'profile' });
  if (vehicle.hasTachograph === null) issues.push({ key: 'tachograph', severity: 'incomplete', title: 'Tahograf nespecificat', detail: 'Completează informația despre tahograf.', section: 'profile' });
  return issues;
}
