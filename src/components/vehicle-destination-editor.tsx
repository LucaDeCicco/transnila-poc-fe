import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { countryCodeFromName, romanianCountryName } from '../lib/country';
import { ConfirmedLocation, LocationInput, MapConfig, Vehicle } from '../types/vehicle';
import { LocationVerification } from './location-verification';
import { Button, colors, Field, Message } from './ui';

type Form = { company: string; address: string; city: string; postcode: string; country: string; countryCode: string; googleMapsUrl: string };

export function VehicleDestinationEditor({ vehicle, config, onSaved }: {
  vehicle: Vehicle; config: MapConfig | null; onSaved: (vehicle: Vehicle) => void;
}) {
  const [form, setForm] = useState<Form>(() => values(vehicle));
  const [location, setLocation] = useState<ConfirmedLocation | null>(() => vehicle.destinationLocation ?? legacyLocation(vehicle));
  const [confirmed, setConfirmed] = useState(Boolean(vehicle.destinationLocationPrecision));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm(values(vehicle)); setLocation(vehicle.destinationLocation ?? legacyLocation(vehicle));
    setConfirmed(Boolean(vehicle.destinationLocationPrecision)); setDirty(false); setError(null); setMessage(null);
  }, [vehicle]);

  const set = (key: keyof Form, value: string) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'country') {
        next.countryCode = countryCodeFromName(value) ?? '';
        if (next.countryCode) next.country = romanianCountryName(next.countryCode, value);
      }
      return next;
    });
    setLocation(null); setConfirmed(false); setDirty(true); setError(null); setMessage(null);
  };
  const input: LocationInput = {
    company: form.company || null, address: form.address || null, city: form.city || null,
    postcode: form.postcode, country: form.country, countryCode: form.countryCode || null,
    googleMapsUrl: form.googleMapsUrl || null
  };
  const save = async () => {
    if (!form.googleMapsUrl.trim() && (!form.postcode.trim() || !form.country.trim())) return setError('Completează codul poștal și țara sau introdu un link Google Maps.');
    if (!location || !confirmed) return setError('Verifică pinul și confirmă locația înainte de salvare.');
    setSaving(true); setError(null); setMessage(null);
    try {
      const updated = await api.updateVehicleDestination(vehicle.id, { ...input, resolution: location });
      onSaved(updated); setMessage(location.precision === 'APPROXIMATE' ? 'Destinația aproximativă a fost confirmată și salvată.' : 'Destinația exactă a fost confirmată și salvată.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Destinația nu a putut fi salvată.'); }
    finally { setSaving(false); }
  };
  const clear = async () => {
    setSaving(true); setError(null); setMessage(null);
    try { const updated = await api.patch(vehicle.id, { destination: null }); onSaved(updated); setMessage('Destinația a fost eliminată.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Destinația nu a putut fi eliminată.'); }
    finally { setSaving(false); }
  };

  return <View style={styles.root}>
    <Text style={styles.help}>Această destinație aparține direct vehiculului. Dacă asignezi ulterior o cursă, locația activă a cursei o va înlocui.</Text>
    <View style={styles.fields}>
      <Field label="Companie" value={form.company} onChangeText={(value) => set('company', value)} />
      <Field label="Adresă" value={form.address} onChangeText={(value) => set('address', value)} placeholder="Stradă și număr, dacă sunt cunoscute" />
      <Field label="Localitate" value={form.city} onChangeText={(value) => set('city', value)} />
      <Field label={`Cod poștal${form.googleMapsUrl.trim() ? '' : ' *'}`} value={form.postcode} onChangeText={(value) => set('postcode', value)} />
      <Field label={`Țară${form.googleMapsUrl.trim() ? '' : ' *'}`} value={form.country} onChangeText={(value) => set('country', value)} />
      <Field label="Link Google Maps (opțional)" value={form.googleMapsUrl} onChangeText={(value) => set('googleMapsUrl', value)} autoCapitalize="none" />
    </View>
    <LocationVerification label="Destinația vehiculului" input={input} value={location} confirmed={confirmed} config={config} disabled={saving} onResolved={(value) => { setLocation(value); setConfirmed(false); setDirty(true); setError(null); }} onConfirmed={() => { setConfirmed(true); setError(null); }} />
    {error && <Message error>{error}</Message>}{message && <Message>{message}</Message>}
    <View style={styles.actions}><Button title="Salvează destinația confirmată" onPress={() => void save()} disabled={saving || !dirty} />{vehicle.destination && <Button secondary title="Elimină destinația" onPress={() => void clear()} disabled={saving} />}</View>
  </View>;
}

function values(vehicle: Vehicle): Form {
  const input = vehicle.destinationLocationInput;
  return {
    company: input?.company ?? '', address: input?.address ?? vehicle.destination ?? '',
    city: input?.city ?? vehicle.destinationCity ?? '', postcode: input?.postcode ?? vehicle.destinationPostcode ?? '',
    country: romanianCountryName(input?.countryCode ?? vehicle.destinationCountryCode, input?.country ?? vehicle.destinationCountry ?? ''),
    countryCode: input?.countryCode ?? vehicle.destinationCountryCode ?? '', googleMapsUrl: input?.googleMapsUrl ?? ''
  };
}

function legacyLocation(vehicle: Vehicle): ConfirmedLocation | null {
  if (!vehicle.destinationLocationPrecision || vehicle.destinationLatitude === null || vehicle.destinationLongitude === null || !vehicle.destinationFormattedAddress) return null;
  return {
    inputKey: '', latitude: vehicle.destinationLatitude, longitude: vehicle.destinationLongitude,
    formattedAddress: vehicle.destinationFormattedAddress, country: vehicle.destinationCountry ?? '',
    countryCode: vehicle.destinationCountryCode ?? '', city: vehicle.destinationCity ?? '',
    postcode: vehicle.destinationPostcode, precision: vehicle.destinationLocationPrecision,
    source: vehicle.destinationLocationPrecision === 'APPROXIMATE' ? 'POSTCODE' : 'GEOCODING',
    confidence: vehicle.destinationGeocodingConfidence, resultType: null,
    warning: vehicle.destinationLocationPrecision === 'APPROXIMATE' ? 'Locația exactă nu a fost identificată; pinul folosește poziția aproximativă a codului poștal.' : null
  };
}

const styles = StyleSheet.create({
  root: { gap: 12 }, fields: { gap: 10 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  help: { color: colors.muted, fontSize: 12, lineHeight: 18 }
});
