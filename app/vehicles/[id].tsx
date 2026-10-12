import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { availability as availabilityText, availabilityLabels, bucharestDate, unspecified } from '@/lib/format';
import { formatInternationalPhone, normalizeNationalPhone } from '@/lib/phone';
import { Availability, MapConfig, RoutingMode, Vehicle, VehicleRoute } from '@/types/vehicle';
import { Button, colors, Field, Message, Row, Section, styles as ui } from '@/components/ui';
import { CountryPhoneField } from '@/components/country-phone-field';
import { VehicleMap } from '@/components/vehicle-map';

type Form = { driverName: string; phoneCountryIso: string; phoneNumber: string; tachograph: 'null' | 'true' | 'false'; vehicleModel: string; vehicleDetails: string; availability: Availability | 'null'; destination: string; routingMode: RoutingMode };
const fromVehicle = (v: Vehicle): Form => ({
  driverName: v.driverName ?? '', phoneCountryIso: v.driverPhoneCountryIso ?? 'RO', phoneNumber: v.driverPhoneNumber ?? '',
  tachograph: v.hasTachograph === null ? 'null' : String(v.hasTachograph) as 'true' | 'false',
  vehicleModel: v.vehicleModel ?? '', vehicleDetails: v.vehicleDetails ?? '', availability: v.availability ?? 'null', destination: v.destination ?? '', routingMode: v.routingMode
});

const routingModeLabels: Record<RoutingMode, string> = {
  DRIVE: 'Autoturism', LIGHT_TRUCK: 'Autoutilitară', MEDIUM_TRUCK: 'Camion mediu', TRUCK: 'Camion', HEAVY_TRUCK: 'Camion greu'
};

export default function VehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null);
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [route, setRoute] = useState<VehicleRoute | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapRefreshing, setMapRefreshing] = useState(false);
  const [lastMapUpdatedAt, setLastMapUpdatedAt] = useState<string | null>(null);
  const activeRequest = useRef(false);
  const activeMapRequest = useRef(false);
  const editingRef = useRef(false);

  const enter = useCallback(async () => {
    if (!id || activeRequest.current) return;
    activeRequest.current = true; setLoading(true); setError(null);
    try {
      const saved = await api.get(id); setVehicle(saved); setForm((current) => editingRef.current ? current : fromVehicle(saved)); setLoading(false);
      const refreshed = await api.autoVehicle(id);
      const next = refreshed.vehicle ?? await api.get(id);
      setVehicle(next); setForm((current) => editingRef.current ? current : fromVehicle(next));
      if (refreshed.performed && refreshed.success === false) setError(refreshed.error ?? 'Actualizarea locației a eșuat.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Mașina nu poate fi încărcată.'); }
    finally { setLoading(false); activeRequest.current = false; }
  }, [id]);
  useFocusEffect(useCallback(() => { void enter(); return undefined; }, [enter]));

  const refreshMap = useCallback(async () => {
    if (!id || activeMapRequest.current) return;
    activeMapRequest.current = true; setMapRefreshing(true);
    try {
      const live = await api.liveFleet();
      setFleet(live.vehicles); setLastMapUpdatedAt(live.lastSuccessAt);
      setMapError(live.success === false ? live.error ?? 'Actualizarea pozițiilor a eșuat.' : null);
      const selected = live.vehicles.find((item) => item.id === id);
      if (selected) {
        setVehicle(selected);
        setForm((current) => editingRef.current ? current : fromVehicle(selected));
      }
      setRoute(await api.vehicleRoute(id));
    } catch (e) { setMapError(e instanceof Error ? e.message : 'Harta nu poate fi actualizată.'); }
    finally { activeMapRequest.current = false; setMapRefreshing(false); }
  }, [id]);
  const openVehicle = useCallback((vehicleId: string) => router.push(`/vehicles/${vehicleId}`), [router]);

  useFocusEffect(useCallback(() => {
    let disposed = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    api.mapConfig().then((config) => {
      if (disposed) return;
      setMapConfig(config);
      void refreshMap();
      timer = setInterval(() => void refreshMap(), Math.max(1, config.refreshIntervalSeconds) * 1000);
    }).catch((e: unknown) => { if (!disposed) setMapError(e instanceof Error ? e.message : 'Configurația hărții nu poate fi încărcată.'); });
    return () => { disposed = true; if (timer) clearInterval(timer); };
  }, [refreshMap]));

  const save = async () => {
    if (!vehicle || !form || saving) return; setSaving(true); setError(null);
    try {
      const normalizedPhone = form.phoneNumber.trim() ? normalizeNationalPhone(form.phoneNumber, form.phoneCountryIso) : null;
      if (form.phoneNumber.trim() && !normalizedPhone) throw new Error('Numărul de telefon nu este valid pentru țara selectată.');
      const next = await api.patch(vehicle.id, {
        driverName: form.driverName, driverPhoneCountryIso: normalizedPhone ? form.phoneCountryIso : null, driverPhoneNumber: normalizedPhone,
        hasTachograph: form.tachograph === 'null' ? null : form.tachograph === 'true',
        vehicleModel: form.vehicleModel, vehicleDetails: form.vehicleDetails,
        availability: form.availability === 'null' ? null : form.availability, destination: form.destination, routingMode: form.routingMode
      });
      setVehicle(next); setForm(fromVehicle(next)); editingRef.current = false; setEditing(false); setMessage('Profilul a fost salvat.');
      void refreshMap();
    } catch (e) { setError(e instanceof Error ? e.message : 'Salvarea a eșuat.'); }
    finally { setSaving(false); }
  };
  const manualRefresh = async () => {
    if (!vehicle || refreshing) return; setRefreshing(true); setError(null); setMessage(null);
    try {
      const result = await api.manualVehicle(vehicle.id);
      if (result.vehicle) setVehicle(result.vehicle);
      if (!result.performed) setMessage(result.nextAllowedAt ? `Actualizarea este disponibilă după ${new Date(result.nextAllowedAt).toLocaleString('ro-RO')}.` : 'Actualizarea nu este disponibilă acum.');
      else if (!result.success) setError(result.error ?? 'Actualizarea a eșuat.'); else setMessage('Locația și adresa au fost actualizate.');
      void refreshMap();
    } catch (e) { setError(e instanceof Error ? e.message : 'Actualizarea a eșuat.'); }
    finally { setRefreshing(false); }
  };

  if (loading && !vehicle) return <View style={[ui.screen, detail.center]}><ActivityIndicator size="large" color={colors.accent} /></View>;
  if (!vehicle || !form) return <View style={[ui.screen, detail.center]}><Message error>{error ?? 'Mașina nu a fost găsită.'}</Message><Button title="Reîncearcă" onPress={() => void enter()} /></View>;
  const trackerEntries = Object.entries(vehicle.trackerParams ?? {}).sort(([a], [b]) => a.localeCompare(b));

  return <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
    <View style={detail.heading}><View style={{ flex: 1 }}><Text style={ui.title}>{vehicle.registrationNumber}</Text><Text style={ui.subtitle}>{vehicle.isActive ? 'Activă în flota Wialon' : 'Inactivă în flota Wialon'}</Text></View>
      {!editing && <Button title="Editează" onPress={() => { setForm(fromVehicle(vehicle)); editingRef.current = true; setEditing(true); setMessage(null); }} />}
    </View>
    {error && <Message error>{error}</Message>}{message && <Message>{message}</Message>}
    <Section title="Profil">
      <Row label="Număr de înmatriculare" value={vehicle.registrationNumber} />
      {editing ? <>
        <Field label="Șofer" value={form.driverName} onChangeText={(driverName) => setForm({ ...form, driverName })} maxLength={120} />
        <CountryPhoneField countryIso={form.phoneCountryIso} phoneNumber={form.phoneNumber}
          onCountryChange={(phoneCountryIso) => setForm({ ...form, phoneCountryIso })}
          onPhoneChange={(phoneNumber) => setForm({ ...form, phoneNumber })} />
        <Choice label="Tahograf" value={form.tachograph} options={[['null', 'Nespecificat'], ['true', 'Da'], ['false', 'Nu']]} onChange={(tachograph) => setForm({ ...form, tachograph: tachograph as Form['tachograph'] })} />
        <Field label="Model" value={form.vehicleModel} onChangeText={(vehicleModel) => setForm({ ...form, vehicleModel })} maxLength={120} />
        <Field label="Detaliile mașinii" multiline value={form.vehicleDetails} onChangeText={(vehicleDetails) => setForm({ ...form, vehicleDetails })} maxLength={4000} />
      </> : <>
        <Row label="Șofer" value={unspecified(vehicle.driverName)} /><Row label="Telefon" value={formatInternationalPhone(vehicle.driverPhoneE164)} />
        {vehicle.driverPhoneE164 && <View style={ui.actions}>
          <Button title="Sună" onPress={() => void Linking.openURL(`tel:${vehicle.driverPhoneE164}`)} />
          <Button secondary title="Deschide WhatsApp" onPress={() => void Linking.openURL(`https://wa.me/${vehicle.driverPhoneE164!.replace(/\D/g, '')}`)} />
        </View>}
        <Row label="Tahograf" value={vehicle.hasTachograph === null ? 'Nespecificat' : vehicle.hasTachograph ? 'Da' : 'Nu'} />
        <Row label="Model" value={unspecified(vehicle.vehicleModel)} /><Row label="Detaliile mașinii" value={unspecified(vehicle.vehicleDetails)} />
      </>}
    </Section>
    <Section title="Disponibilitate și destinație">
      {editing ? <>
        <Choice label="Disponibilitate" value={form.availability} options={[['null', 'Nespecificat'], ...Object.entries(availabilityLabels)]} onChange={(availability) => setForm({ ...form, availability: availability as Form['availability'] })} />
        <Field label="Destinație" value={form.destination} onChangeText={(destination) => setForm({ ...form, destination })} maxLength={500} />
        <Choice label="Profil de rutare" value={form.routingMode} options={Object.entries(routingModeLabels)} onChange={(routingMode) => setForm({ ...form, routingMode: routingMode as RoutingMode })} />
      </> : <><Row label="Disponibilitate" value={availabilityText(vehicle.availability)} /><Row label="Destinație" value={unspecified(vehicle.destination)} /><Row label="Profil de rutare" value={routingModeLabels[vehicle.routingMode]} /></>}
    </Section>
    {editing && <View style={ui.actions}><Button title="Salvează" onPress={() => void save()} disabled={saving} /><Button secondary title="Anulează" onPress={() => { setForm(fromVehicle(vehicle)); editingRef.current = false; setEditing(false); setError(null); }} /></View>}
    <Section title="Hartă live și traseu">
      <View style={detail.mapMeta}><Text style={detail.muted}>Pozițiile flotei se actualizează la fiecare {mapConfig?.refreshIntervalSeconds ?? 60} secunde.</Text><Text style={detail.muted}>Ultima sincronizare: {bucharestDate(lastMapUpdatedAt)}</Text></View>
      {mapError && <Message error>{mapError}</Message>}
      {route?.warning && <View style={detail.warning}><Text style={detail.warningMark}>!</Text><Text style={detail.warningText}>{route.warning}</Text></View>}
      {route?.status === 'ready' && <View style={detail.routeSummary}>
        <Text style={detail.routeSummaryText}>Traseu: {formatDistance(route.distanceMeters)} · {formatDuration(route.durationSeconds)}</Text>
        <Text style={detail.muted}>Destinație identificată: {route.destination?.formattedAddress}</Text>
      </View>}
      {mapConfig ? <VehicleMap config={mapConfig} vehicles={fleet.length ? fleet : [vehicle]} selectedVehicleId={vehicle.id} route={route} onVehiclePress={openVehicle} /> : !mapError && <ActivityIndicator color={colors.accent} />}
      <View style={ui.actions}><Button secondary title={mapRefreshing ? 'Se actualizează…' : 'Actualizează harta'} onPress={() => void refreshMap()} disabled={mapRefreshing} /></View>
      <Text style={detail.attribution}>{mapConfig?.attribution ?? vehicle.attribution}</Text>
    </Section>
    <Section title="Locație">
      <Row label="Țară" value={unspecified(vehicle.country)} /><Row label="Cod țară" value={unspecified(vehicle.countryCode)} />
      <Row label="Localitate" value={unspecified(vehicle.city)} /><Row label="Regiune / județ" value={unspecified(vehicle.region)} />
      <Row label="District / suburbie" value={unspecified(vehicle.district)} /><Row label="Stradă" value={unspecified(vehicle.street)} />
      <Row label="Număr" value={unspecified(vehicle.houseNumber)} /><Row label="Cod poștal" value={unspecified(vehicle.postcode)} />
      <Row label="Adresă completă" value={unspecified(vehicle.formattedAddress)} /><Row label="Latitudine" value={unspecified(vehicle.latitude)} />
      <Row label="Longitudine" value={unspecified(vehicle.longitude)} /><Row label="Ultima geocodare reușită (Europe/Bucharest)" value={bucharestDate(vehicle.lastGeocodedAt)} />
      <Row label="Starea actualizării" value={vehicle.warnings.length ? 'Necesită atenție' : 'Fără erori active'} />
      {vehicle.warnings.map((warning) => <View key={warning.type} style={detail.warning}><Text style={detail.warningMark}>!</Text><Text style={detail.warningText}>{warning.message}{warning.at ? `\nTentativă: ${bucharestDate(warning.at)}` : ''}</Text></View>)}
      <View style={ui.actions}><Button title="Actualizează locația" onPress={() => void manualRefresh()} disabled={refreshing} />
        <Button secondary title="Deschide în Google Maps" disabled={vehicle.latitude === null || vehicle.longitude === null} onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${vehicle.latitude},${vehicle.longitude}`)} /></View>
      <Text style={detail.attribution}>{vehicle.attribution}</Text>
    </Section>
    <Section title="Mai multe detalii — GPS și tracker">
      <Pressable onPress={() => setExpanded(!expanded)} style={detail.expand}><Text style={detail.expandText}>{expanded ? 'Ascunde detaliile' : 'Afișează detaliile'}</Text></Pressable>
      {expanded && <>
        <Row label="Viteză raportată la momentul poziției" value={vehicle.speedKph === null ? 'Nespecificat' : `${vehicle.speedKph} km/h`} />
        <Row label="Ultima poziție GPS (Europe/Bucharest)" value={bucharestDate(vehicle.positionAt)} />
        <Row label="Ultimul mesaj (Europe/Bucharest)" value={bucharestDate(vehicle.lastMessageAt)} />
        <Row label="Recepția mesajului (Europe/Bucharest)" value={bucharestDate(vehicle.lastMessageReceivedAt)} />
        <Row label="Latitudine / longitudine" value={vehicle.latitude === null || vehicle.longitude === null ? 'Nespecificat' : `${vehicle.latitude}, ${vehicle.longitude}`} />
        <Row label="Direcție" value={vehicle.courseDegrees === null ? 'Nespecificat' : `${vehicle.courseDegrees}°`} />
        <Row label="Altitudine" value={vehicle.altitudeMeters === null ? 'Nespecificat' : `${vehicle.altitudeMeters} m`} />
        <Row label="Sateliți" value={unspecified(vehicle.satellites)} />
        <Text style={detail.subheading}>Parametri tehnici ai trackerului</Text>
        {trackerEntries.length ? trackerEntries.map(([key, value]) => <Row key={key} label={key} value={typeof value === 'object' ? JSON.stringify(value, null, 2) : unspecified(value)} />) : <Text style={detail.muted}>Nespecificat</Text>}
      </>}
    </Section>
  </ScrollView>;
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return <View style={{ gap: 6 }}><Text style={detail.choiceLabel}>{label}</Text><View style={detail.choices}>{options.map(([key, text]) => <Pressable key={key} onPress={() => onChange(key)} style={[detail.choice, value === key && detail.choiceActive]}><Text style={detail.choiceText}>{text}</Text></Pressable>)}</View></View>;
}

function formatDistance(value: number | null | undefined) {
  if (value === null || value === undefined) return 'distanță nespecificată';
  return value >= 1000 ? `${(value / 1000).toLocaleString('ro-RO', { maximumFractionDigits: 1 })} km` : `${Math.round(value)} m`;
}
function formatDuration(value: number | null | undefined) {
  if (value === null || value === undefined) return 'durată nespecificată';
  const totalMinutes = Math.max(1, Math.round(value / 60));
  const hours = Math.floor(totalMinutes / 60); const minutes = totalMinutes % 60;
  return hours ? `${hours} h ${minutes ? `${minutes} min` : ''}`.trim() : `${minutes} min`;
}

const detail = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  warning: { flexDirection: 'row', gap: 10, backgroundColor: '#3b3212', padding: 12, borderRadius: 9 }, warningMark: { color: colors.yellow, fontSize: 24, fontWeight: '900' }, warningText: { color: colors.text, flex: 1 },
  attribution: { color: colors.muted, fontSize: 12 }, expand: { backgroundColor: colors.panel2, borderRadius: 8, padding: 12 }, expandText: { color: colors.text, fontWeight: '800' },
  subheading: { color: colors.text, fontWeight: '800', fontSize: 16, marginTop: 8 }, muted: { color: colors.muted },
  mapMeta: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  routeSummary: { backgroundColor: '#12345a', borderRadius: 9, padding: 12, gap: 4 }, routeSummaryText: { color: colors.text, fontWeight: '800' },
  choiceLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1, borderRadius: 8 }, choiceActive: { backgroundColor: colors.accent, borderColor: colors.accent }, choiceText: { color: colors.text }
});
