import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { countryCodeFromName, romanianCountryName } from '../lib/country';
import { ConfirmedLocation, LocationInput, MapConfig, Trip, Vehicle } from '../types/vehicle';
import { LocationVerification } from './location-verification';
import { Button, colors, Field, Message } from './ui';

type Kind = 'pickup' | 'delivery';
type Form = { company: string; address: string; city: string; postcode: string; country: string; countryCode: string; googleMapsUrl: string };

export function TripLocationEditor({ vehicleId, trip, kind, config, onSaved }: {
  vehicleId: string; trip: Trip; kind: Kind; config: MapConfig | null; onSaved: (vehicle: Vehicle) => void;
}) {
  const initial = values(trip, kind);
  const [form, setForm] = useState<Form>(initial);
  const [location, setLocation] = useState<ConfirmedLocation | null>(trip[`${kind}Location`]);
  const [confirmed, setConfirmed] = useState(Boolean(trip[`${kind}Location`]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm(values(trip, kind)); setLocation(trip[`${kind}Location`]); setConfirmed(Boolean(trip[`${kind}Location`]));
    setError(null); setMessage(null);
  }, [kind, trip]);

  const set = (key: keyof Form, value: string) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'country') {
        next.countryCode = countryCodeFromName(value) ?? '';
        if (next.countryCode) next.country = romanianCountryName(next.countryCode, value);
      }
      return next;
    }); setLocation(null); setConfirmed(false); setMessage(null);
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
      const updated = await api.updateTripLocation(vehicleId, kind, { ...input, resolution: location });
      onSaved(updated); setMessage(location.precision === 'APPROXIMATE' ? 'Locația aproximativă a fost confirmată și salvată.' : 'Locația exactă a fost confirmată și salvată.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Locația nu a putut fi salvată.'); }
    finally { setSaving(false); }
  };

  return <View style={styles.root}>
    <View style={styles.fields}>
      <Field label="Companie" value={form.company} onChangeText={(value) => set('company', value)} />
      <Field label="Adresă" value={form.address} onChangeText={(value) => set('address', value)} placeholder="Stradă și număr, dacă sunt cunoscute" />
      <Field label="Localitate" value={form.city} onChangeText={(value) => set('city', value)} />
      <Field label={`Cod poștal${form.googleMapsUrl.trim() ? '' : ' *'}`} value={form.postcode} onChangeText={(value) => set('postcode', value)} />
      <Field label={`Țară${form.googleMapsUrl.trim() ? '' : ' *'}`} value={form.country} onChangeText={(value) => set('country', value)} />
      <Field label="Link Google Maps (opțional)" value={form.googleMapsUrl} onChangeText={(value) => set('googleMapsUrl', value)} autoCapitalize="none" />
    </View>
    <LocationVerification label={kind === 'pickup' ? 'Locația de ridicare' : 'Locația de livrare'} input={input} value={location} confirmed={confirmed} config={config} disabled={saving} onResolved={(value) => { setLocation(value); setConfirmed(false); setError(null); }} onConfirmed={() => { setConfirmed(true); setError(null); }} />
    {error && <Message error>{error}</Message>}{message && <Message>{message}</Message>}
    <View style={styles.actions}><Button title="Salvează locația confirmată" onPress={() => void save()} disabled={saving} /></View>
    <Text style={styles.help}>Orice modificare a câmpurilor anulează confirmarea și necesită o nouă verificare.</Text>
  </View>;
}

function values(trip: Trip, kind: Kind): Form {
  return {
    company: trip[`${kind}Company`] ?? '', address: trip[`${kind}Address`] ?? '', city: trip[`${kind}City`] ?? '',
    postcode: trip[`${kind}Postcode`] ?? '', country: romanianCountryName(trip[`${kind}CountryCode`], trip[`${kind}Country`] ?? ''), countryCode: trip[`${kind}CountryCode`] ?? '',
    googleMapsUrl: trip[`${kind}GoogleMapsUrl`] ?? ''
  };
}

const styles = StyleSheet.create({
  root: { gap: 12 }, fields: { gap: 10 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  help: { color: colors.muted, fontSize: 12, lineHeight: 18 }
});
