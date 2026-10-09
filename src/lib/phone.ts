import { CountryCode, getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js';

const displayNames = typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['ro'], { type: 'region' }) : null;

export const countryFlag = (countryIso: string) => [...countryIso.toUpperCase()]
  .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('');

export const phoneCountries = getCountries().map((iso) => ({
  iso,
  name: displayNames?.of(iso) ?? iso,
  callingCode: `+${getCountryCallingCode(iso)}`,
  flag: countryFlag(iso)
})).sort((a, b) => a.name.localeCompare(b.name, 'ro-RO'));

export const formatInternationalPhone = (value: string | null) => {
  if (!value) return 'Nespecificat';
  return parsePhoneNumberFromString(value)?.formatInternational() ?? value;
};

export const normalizeNationalPhone = (value: string, countryIso: string) => {
  const parsed = parsePhoneNumberFromString(value, countryIso as CountryCode);
  return parsed?.country === countryIso && parsed.isValid() ? parsed.nationalNumber : null;
};
