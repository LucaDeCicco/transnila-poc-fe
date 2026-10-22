import { getCountries } from 'libphonenumber-js';

const romanianRegions = displayNames('ro');
const namesToCodes = new Map<string, string>();
for (const locale of ['ro', 'en', 'fr', 'de', 'es', 'it', 'pt']) {
  const names = displayNames(locale);
  if (!names) continue;
  for (const code of getCountries()) {
    const name = names.of(code);
    if (name) namesToCodes.set(normalize(name), code);
  }
}

export function romanianCountryName(countryCode?: string | null, fallback = '') {
  const explicitCode = countryCode?.trim().toUpperCase();
  const code = explicitCode && /^[A-Z]{2}$/.test(explicitCode) ? explicitCode : namesToCodes.get(normalize(fallback));
  if (!code || !/^[A-Z]{2}$/.test(code)) return fallback;
  const name = romanianRegions?.of(code);
  return name && name !== code ? name : fallback;
}

export function countryCodeFromName(value?: string | null) {
  return value ? namesToCodes.get(normalize(value)) ?? null : null;
}

function displayNames(locale: string) {
  return typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames([locale], { type: 'region' }) : null;
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en-US').trim();
}
