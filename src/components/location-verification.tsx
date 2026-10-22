import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { ConfirmedLocation, LocationInput, MapConfig } from '../types/vehicle';
import { LocationPreviewMap } from './location-preview-map';
import { Button, colors, Message } from './ui';

export function LocationVerification({ label, input, value, confirmed, config, disabled, onResolved, onConfirmed }: {
  label: string; input: LocationInput; value: ConfirmedLocation | null; confirmed: boolean; config: MapConfig | null;
  disabled?: boolean; onResolved: (value: ConfirmedLocation) => void; onConfirmed: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputSignature = JSON.stringify(input);
  useEffect(() => { setError(null); }, [inputSignature]);
  const verify = async () => {
    setLoading(true); setError(null);
    try { onResolved(await api.resolveLocation(input)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Locația nu a putut fi verificată.'); }
    finally { setLoading(false); }
  };
  const approximate = value?.precision === 'APPROXIMATE';
  return <View style={styles.card}>
    <View style={styles.header}><Text style={styles.title}>Confirmare {label.toLowerCase()}</Text><View style={[styles.badge, confirmed ? approximate ? styles.approximate : styles.exact : styles.pending]}><Text style={styles.badgeText}>{confirmed ? approximate ? 'CONFIRMATĂ APROXIMATIV' : 'CONFIRMATĂ EXACT' : value ? 'DE CONFIRMAT' : 'NEVERIFICATĂ'}</Text></View></View>
    {value ? <>
      <Text style={styles.address}>{value.formattedAddress}</Text>
      {approximate && <View style={styles.warning}><Text style={styles.warningText}>{value.warning ?? `Locația exactă nu a fost identificată. Pinul este aproximativ, pe baza codului poștal ${input.postcode}.`}</Text></View>}
      {config ? <LocationPreviewMap config={config} latitude={value.latitude} longitude={value.longitude} approximate={approximate} /> : <Text style={styles.help}>Se încarcă minimapa…</Text>}
      <View style={styles.actions}>{!confirmed && <Button title={approximate ? 'Acceptă locația aproximativă' : 'Confirmă locația'} onPress={onConfirmed} disabled={disabled} />}<Button secondary title="Verifică din nou" onPress={() => void verify()} disabled={disabled || loading} /></View>
    </> : <>
      <Text style={styles.help}>{input.googleMapsUrl?.trim()
        ? 'Linkul Google Maps va fi folosit pentru identificarea pinului și a detaliilor locației.'
        : 'Completează codul poștal și țara; compania și adresa ajută la identificarea exactă. Apoi verifică pinul înainte de salvare.'}</Text>
      <View style={styles.actions}><Button title="Verifică locația" onPress={() => void verify()} disabled={disabled || loading} /></View>
    </>}
    {error && <Message error>{error}</Message>}
    <Text style={styles.attribution}>Powered by Geoapify | © OpenMapTiles | © OpenStreetMap contributors</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel2 },
  header: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontWeight: '900', fontSize: 15 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 }, pending: { backgroundColor: '#334155' }, exact: { backgroundColor: '#166534' }, approximate: { backgroundColor: '#92400e' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' }, address: { color: colors.text, fontWeight: '800', lineHeight: 20 },
  help: { color: colors.muted, fontSize: 12, lineHeight: 18 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  warning: { padding: 11, borderRadius: 9, backgroundColor: '#3b2a0d', borderColor: colors.orange, borderWidth: 1 }, warningText: { color: '#fde68a', lineHeight: 18, fontWeight: '700' },
  attribution: { color: colors.muted, fontSize: 10 }
});
