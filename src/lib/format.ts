import { Availability } from '../types/vehicle';
export const unspecified = (value: unknown) => value === null || value === undefined || value === '' ? 'Nespecificat' : String(value);
export const availabilityLabels: Record<Availability, string> = {
  AVAILABLE: 'Disponibil', ON_TRIP: 'În cursă', HEADING_TO_PICKUP: 'Către preluare cursă'
};
export const availability = (value: Availability | null) => value ? availabilityLabels[value] : 'Nespecificat';
export const bucharestDate = (value: string | null) => value ? new Intl.DateTimeFormat('ro-RO', {
  dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Europe/Bucharest'
}).format(new Date(value)) : 'Nespecificat';
