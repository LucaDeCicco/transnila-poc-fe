import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppShell } from '@/components/app-shell';
import { StatusBadge } from '@/components/fleet-ui';
import { Button, colors, Field, Message, Row, Section, styles as ui } from '@/components/ui';
import { VehicleMap } from '@/components/vehicle-map';
import { api } from '@/lib/api';
import { availability as availabilityText, availabilityLabels, bucharestDate, unspecified } from '@/lib/format';
import { formatInternationalPhone } from '@/lib/phone';
import { positionAgeMinutes, vehicleIssues, vehicleLocation } from '@/lib/vehicle';
import { Availability, MapConfig, RoutingMode, Vehicle, VehicleHistory, VehicleHistoryEvent, VehicleRoute } from '@/types/vehicle';

type Tab = 'overview' | 'trip' | 'map' | 'history' | 'operations' | 'profile' | 'diagnostics';
type Editing = 'operations' | 'profile' | null;
type Form = { tachograph: 'null' | 'true' | 'false'; vehicleModel: string; vehicleDetails: string; availability: Availability | 'null'; destination: string; routingMode: RoutingMode };

const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'overview', label: 'Rezumat', icon: 'apps-outline' }, { key: 'trip', label: 'Cursa curentă', icon: 'document-text-outline' }, { key: 'map', label: 'Hartă și traseu', icon: 'map-outline' },
  { key: 'history', label: 'Istoric', icon: 'time-outline' },
  { key: 'operations', label: 'Operațiuni', icon: 'navigate-outline' }, { key: 'profile', label: 'Profil', icon: 'car-outline' },
  { key: 'diagnostics', label: 'Diagnostic', icon: 'pulse-outline' }
];
const routingModeLabels: Record<RoutingMode, string> = { DRIVE: 'Autoturism', LIGHT_TRUCK: 'Autoutilitară', MEDIUM_TRUCK: 'Camion mediu', TRUCK: 'Camion', HEAVY_TRUCK: 'Camion greu' };
const fromVehicle = (vehicle: Vehicle): Form => ({
  tachograph: vehicle.hasTachograph === null ? 'null' : String(vehicle.hasTachograph) as 'true' | 'false', vehicleModel: vehicle.vehicleModel ?? '',
  vehicleDetails: vehicle.vehicleDetails ?? '', availability: vehicle.availability ?? 'null', destination: vehicle.destination ?? '', routingMode: vehicle.routingMode
});

export default function VehicleScreen() {
  const params = useLocalSearchParams<{ id: string; section?: string }>();
  const id = params.id;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [tab, setTab] = useState<Tab>(validTab(params.section) ?? 'overview');
  const [editing, setEditing] = useState<Editing>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmTripRemoval, setConfirmTripRemoval] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null);
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [route, setRoute] = useState<VehicleRoute | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapRefreshing, setMapRefreshing] = useState(false);
  const [lastMapUpdatedAt, setLastMapUpdatedAt] = useState<string | null>(null);
  const [historyDate, setHistoryDate] = useState(todayInBucharest());
  const [history, setHistory] = useState<VehicleHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const requestActive = useRef(false);
  const mapRequestActive = useRef(false);
  const editingRef = useRef<Editing>(null);
  const historyRequest = useRef(0);

  useEffect(() => { const requested = validTab(params.section); if (requested) setTab(requested); }, [params.section]);
  const updateVehicle = useCallback((next: Vehicle) => { setVehicle(next); setForm((current) => editingRef.current ? current : fromVehicle(next)); }, []);
  const enter = useCallback(async () => {
    if (!id || requestActive.current) return;
    requestActive.current = true; setLoading(true); setError(null);
    try {
      const saved = await api.get(id); updateVehicle(saved); setLoading(false);
      const refreshed = await api.autoVehicle(id); updateVehicle(refreshed.vehicle ?? await api.get(id));
      if (refreshed.performed && refreshed.success === false) setError(refreshed.error ?? 'Actualizarea locației a eșuat.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Vehiculul nu poate fi încărcat.'); }
    finally { requestActive.current = false; setLoading(false); }
  }, [id, updateVehicle]);
  useFocusEffect(useCallback(() => { void enter(); return undefined; }, [enter]));

  const refreshMap = useCallback(async () => {
    if (!id || mapRequestActive.current) return;
    mapRequestActive.current = true; setMapRefreshing(true);
    try {
      const live = await api.liveFleet(); setFleet(live.vehicles); setLastMapUpdatedAt(live.lastSuccessAt);
      setMapError(live.success === false ? live.error ?? 'Actualizarea pozițiilor a eșuat.' : null);
      const current = live.vehicles.find((item) => item.id === id); if (current) updateVehicle(current);
      setRoute(await api.vehicleRoute(id));
    } catch (e) { setMapError(e instanceof Error ? e.message : 'Harta nu poate fi actualizată.'); }
    finally { mapRequestActive.current = false; setMapRefreshing(false); }
  }, [id, updateVehicle]);

  useFocusEffect(useCallback(() => {
    if (tab !== 'map') return undefined;
    let disposed = false; let timer: ReturnType<typeof setInterval> | undefined;
    api.mapConfig().then((config) => { if (disposed) return; setMapConfig(config); void refreshMap(); timer = setInterval(() => void refreshMap(), Math.max(1, config.refreshIntervalSeconds) * 1000); })
      .catch((e: unknown) => { if (!disposed) setMapError(e instanceof Error ? e.message : 'Configurația hărții nu poate fi încărcată.'); });
    return () => { disposed = true; if (timer) clearInterval(timer); };
  }, [refreshMap, tab]));

  const loadHistory = useCallback(async (date: string) => {
    if (!id) return;
    const requestId = ++historyRequest.current;
    setHistoryLoading(true); setHistoryError(null);
    try {
      const result = await api.vehicleHistory(id, date);
      if (requestId === historyRequest.current) setHistory(result);
    } catch (e) {
      if (requestId === historyRequest.current) { setHistory(null); setHistoryError(e instanceof Error ? e.message : 'Istoricul nu poate fi încărcat.'); }
    } finally {
      if (requestId === historyRequest.current) setHistoryLoading(false);
    }
  }, [id]);

  useEffect(() => { if (tab === 'history') void loadHistory(historyDate); }, [historyDate, loadHistory, tab]);

  const startEditing = (section: Exclude<Editing, null>) => { if (!vehicle) return; setForm(fromVehicle(vehicle)); setConfirmTripRemoval(false); editingRef.current = section; setEditing(section); setMessage(null); setError(null); setTab(section); };
  const cancelEditing = () => { if (vehicle) setForm(fromVehicle(vehicle)); editingRef.current = null; setEditing(null); setConfirmTripRemoval(false); setError(null); };
  const save = async () => {
    if (!vehicle || !form || !editing || saving) return;
    if (editing === 'operations' && vehicle.currentTrip && form.availability === 'AVAILABLE' && !confirmTripRemoval) {
      setConfirmTripRemoval(true); setError('Trecerea pe Disponibil va șterge definitiv cursa curentă și documentul original. Apasă din nou „Confirmă și salvează”.'); return;
    }
    setSaving(true); setError(null); setMessage(null);
    try {
      let payload: object;
      if (editing === 'operations') payload = { availability: form.availability === 'null' ? null : form.availability, destination: form.destination, routingMode: form.routingMode };
      else {
        payload = { hasTachograph: form.tachograph === 'null' ? null : form.tachograph === 'true', vehicleModel: form.vehicleModel, vehicleDetails: form.vehicleDetails };
      }
      const next = await api.patch(vehicle.id, payload); updateVehicle(next); editingRef.current = null; setEditing(null); setMessage(editing === 'operations' ? 'Datele operaționale au fost salvate.' : 'Profilul vehiculului a fost salvat.');
      if (tab === 'map') void refreshMap();
    } catch (e) { setError(e instanceof Error ? e.message : 'Salvarea a eșuat.'); }
    finally { setSaving(false); }
  };
  const manualRefresh = async () => {
    if (!vehicle || refreshing) return;
    setRefreshing(true); setError(null); setMessage(null);
    try {
      const result = await api.manualVehicle(vehicle.id); if (result.vehicle) updateVehicle(result.vehicle);
      if (!result.performed) setMessage(result.nextAllowedAt ? `Actualizarea este disponibilă ${bucharestDate(result.nextAllowedAt)}.` : 'Actualizarea nu este disponibilă acum.');
      else if (!result.success) setError(result.error ?? 'Actualizarea a eșuat.'); else setMessage('Locația și adresa au fost actualizate.');
      if (tab === 'map') void refreshMap();
    } catch (e) { setError(e instanceof Error ? e.message : 'Actualizarea a eșuat.'); }
    finally { setRefreshing(false); }
  };

  if (loading && !vehicle) return <AppShell active="vehicles" title="Vehicul" back><View style={detail.center}><ActivityIndicator size="large" color={colors.accent} /></View></AppShell>;
  if (!vehicle || !form) return <AppShell active="vehicles" title="Vehicul" back><View style={detail.center}><Message error>{error ?? 'Vehiculul nu a fost găsit.'}</Message><Button title="Reîncearcă" onPress={() => void enter()} /></View></AppShell>;
  const issues = vehicleIssues(vehicle, mapConfig?.stalePositionMinutes ?? 15);
  const attention = issues.filter((issue) => issue.severity === 'attention');
  const age = positionAgeMinutes(vehicle);
  const editAction = (tab === 'operations' || tab === 'profile') && !editing ? <Button title="Editează" onPress={() => startEditing(tab)} /> : undefined;

  return <AppShell active="vehicles" title={vehicle.registrationNumber} subtitle={`${vehicle.isActive ? 'Activ în Wialon' : 'Inactiv în Wialon'} · poziție ${age === null ? 'nespecificată' : `acum ${age} min`}`} back action={editAction}>
    <View style={detail.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={detail.tabScroller} contentContainerStyle={detail.tabs}>{tabs.map((item) => <Pressable key={item.key} onPress={() => { setTab(item.key); if (editing && item.key !== editing) cancelEditing(); }} style={[detail.tab, tab === item.key && detail.tabActive]}><Ionicons name={item.icon} size={18} color={tab === item.key ? '#fff' : colors.muted} /><Text style={[detail.tabText, tab === item.key && detail.tabTextActive]}>{item.label}</Text>{item.key === 'diagnostics' && attention.length > 0 && <View style={detail.tabCount}><Text style={detail.tabCountText}>{attention.length}</Text></View>}</Pressable>)}</ScrollView>
      <ScrollView style={detail.scroll} contentContainerStyle={[ui.content, detail.content]} keyboardShouldPersistTaps="handled">
        {error && <Message error>{error}</Message>}{message && <Message>{message}</Message>}
        {tab === 'overview' && <Overview vehicle={vehicle} issues={issues} wide={wide} onTab={setTab} onEdit={startEditing} onRefresh={() => void manualRefresh()} refreshing={refreshing} />}
        {tab === 'trip' && <TripTab vehicle={vehicle} onCreate={() => router.push({ pathname: '/trips/new', params: { vehicleId: vehicle.id } })} onSaved={updateVehicle} />}
        {tab === 'map' && <MapTab vehicle={vehicle} config={mapConfig} fleet={fleet} route={route} error={mapError} refreshing={mapRefreshing} lastUpdatedAt={lastMapUpdatedAt} onRefresh={() => void refreshMap()} onOpenVehicle={(vehicleId) => router.push(`/vehicles/${vehicleId}`)} />}
        {tab === 'history' && <HistoryTab history={history} date={historyDate} loading={historyLoading} error={historyError} onDate={setHistoryDate} onRetry={() => void loadHistory(historyDate)} />}
        {tab === 'operations' && <OperationsTab vehicle={vehicle} form={form} editing={editing === 'operations'} setForm={setForm} />}
        {tab === 'profile' && <DriverProfileTab vehicle={vehicle} form={form} editing={editing === 'profile'} setForm={setForm} />}
        {tab === 'diagnostics' && <DiagnosticsTab vehicle={vehicle} issues={issues} onRefresh={() => void manualRefresh()} refreshing={refreshing} />}
        {editing && <View style={detail.stickyActions}><Button title={confirmTripRemoval ? 'Confirmă și salvează' : 'Salvează modificările'} onPress={() => void save()} disabled={saving} /><Button secondary title="Anulează" onPress={cancelEditing} /></View>}
      </ScrollView>
    </View>
  </AppShell>;
}

function Overview({ vehicle, issues, wide, onTab, onEdit, onRefresh, refreshing }: { vehicle: Vehicle; issues: ReturnType<typeof vehicleIssues>; wide: boolean; onTab: (tab: Tab) => void; onEdit: (section: 'operations' | 'profile') => void; onRefresh: () => void; refreshing: boolean }) {
  return <>
    <View style={detail.hero}><View style={detail.heroTop}><View><Text style={detail.heroPlate}>{vehicle.registrationNumber}</Text><Text style={detail.muted}>{vehicle.vehicleModel ?? 'Model nespecificat'} · {vehicle.driverName ?? 'Șofer nespecificat'}</Text></View><StatusBadge value={vehicle.availability} /></View>
      <View style={detail.quickActions}><Button title="Status și destinație" onPress={() => onEdit('operations')} /><Button secondary title="Profil" onPress={() => onEdit('profile')} /><Button secondary title="Actualizează poziția" onPress={onRefresh} disabled={refreshing} /></View>
    </View>
    <View style={[detail.overviewGrid, wide && detail.overviewGridWide]}>
      <View style={detail.overviewColumn}><Section title="Operațiuni"><SummaryRow icon="location-outline" label="Locație actuală" value={vehicleLocation(vehicle) || 'Nespecificat'} /><SummaryRow icon="flag-outline" label="Destinație" value={unspecified(vehicle.destination)} /><SummaryRow icon="time-outline" label="Ultima poziție GPS" value={bucharestDate(vehicle.positionAt)} /><SummaryRow icon="speedometer-outline" label="Viteză" value={vehicle.speedKph === null ? 'Nespecificat' : `${vehicle.speedKph} km/h`} /><Pressable onPress={() => onTab('map')} style={detail.inlineLink}><Text style={detail.inlineLinkText}>Deschide harta și traseul</Text><Ionicons name="arrow-forward" size={18} color="#93c5fd" /></Pressable></Section></View>
      <View style={detail.overviewColumn}><Section title="Contact și profil"><SummaryRow icon="person-outline" label="Șofer" value={unspecified(vehicle.driverName)} /><SummaryRow icon="call-outline" label="Telefon" value={formatInternationalPhone(vehicle.driverPhoneE164)} /><SummaryRow icon="timer-outline" label="Tahograf" value={vehicle.hasTachograph === null ? 'Nespecificat' : vehicle.hasTachograph ? 'Da' : 'Nu'} /><SummaryRow icon="git-branch-outline" label="Profil rutare" value={routingModeLabels[vehicle.routingMode]} />{vehicle.driverPhoneE164 && <View style={detail.quickActions}><Button secondary title="Sună" onPress={() => void Linking.openURL(`tel:${vehicle.driverPhoneE164}`)} /><Button secondary title="WhatsApp" onPress={() => void Linking.openURL(`https://wa.me/${vehicle.driverPhoneE164!.replace(/\D/g, '')}`)} /></View>}</Section></View>
    </View>
    <Section title={`Starea datelor (${issues.length})`}>{issues.length ? issues.slice(0, 5).map((issue) => <Pressable key={issue.key} onPress={() => onTab(issue.section === 'diagnostics' ? 'diagnostics' : issue.section)} style={detail.issue}><Ionicons name={issue.severity === 'attention' ? 'warning' : 'information-circle'} size={19} color={issue.severity === 'attention' ? colors.yellow : '#93c5fd'} /><View style={{ flex: 1 }}><Text style={detail.issueTitle}>{issue.title}</Text><Text style={detail.issueText}>{issue.detail}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted} /></Pressable>) : <View style={detail.ok}><Ionicons name="checkmark-circle" size={22} color={colors.success} /><Text style={detail.okText}>Nu există probleme active sau date incomplete.</Text></View>}{issues.length > 5 && <Pressable onPress={() => onTab('diagnostics')}><Text style={detail.inlineLinkText}>Vezi toate cele {issues.length} atenționări</Text></Pressable>}</Section>
  </>;
}

function MapTab({ vehicle, config, fleet, route, error, refreshing, lastUpdatedAt, onRefresh, onOpenVehicle }: { vehicle: Vehicle; config: MapConfig | null; fleet: Vehicle[]; route: VehicleRoute | null; error: string | null; refreshing: boolean; lastUpdatedAt: string | null; onRefresh: () => void; onOpenVehicle: (id: string) => void }) {
  return <Section title="Hartă live și traseu"><View style={detail.mapMeta}><Text style={detail.muted}>Pozițiile se actualizează la {config?.refreshIntervalSeconds ?? 60} secunde.</Text><Text style={detail.muted}>Ultima sincronizare: {bucharestDate(lastUpdatedAt)}</Text></View>{error && <Message error>{error}</Message>}{route?.warning && <Message error>{route.warning}</Message>}{route?.status === 'ready' && <View style={detail.routeSummary}><Ionicons name="navigate" size={21} color="#93c5fd" /><View style={{ flex: 1 }}><Text style={detail.routeTitle}>{formatDistance(route.distanceMeters)} · {formatDuration(route.durationSeconds)}</Text><Text style={detail.muted}>Destinație identificată: {route.destination?.formattedAddress}</Text></View></View>}{config ? <VehicleMap config={config} vehicles={fleet.length ? fleet : [vehicle]} selectedVehicleId={vehicle.id} route={route} onVehiclePress={onOpenVehicle} height={460} /> : !error && <ActivityIndicator color={colors.accent} />}<View style={detail.quickActions}><Button secondary title={refreshing ? 'Se actualizează…' : 'Actualizează harta'} onPress={onRefresh} disabled={refreshing} /><Button secondary title="Deschide în Google Maps" disabled={vehicle.latitude === null || vehicle.longitude === null} onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${vehicle.latitude},${vehicle.longitude}`)} /></View><Text style={detail.attribution}>{config?.attribution ?? vehicle.attribution}</Text></Section>;
}

function HistoryTab({ history, date, loading, error, onDate, onRetry }: { history: VehicleHistory | null; date: string; loading: boolean; error: string | null; onDate: (date: string) => void; onRetry: () => void }) {
  const today = todayInBucharest();
  const offsets = date === today ? [-3, -2, -1, 0] : [-2, -1, 0, 1];
  const days = offsets.map((offset) => addDateDays(date, offset));
  return <Section title="Istoric activitate">
    <View style={detail.historyHeader}>
      <View><Text style={detail.historyTitle}>Deplasări și parcări</Text><Text style={detail.muted}>Date furnizate direct de Wialon.</Text></View>
      {date !== today && <Button secondary title="Astăzi" onPress={() => onDate(today)} />}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={detail.dayPicker}>{days.map((day) => {
      const selected = day === date; const future = day > today;
      return <Pressable key={day} disabled={future} onPress={() => onDate(day)} style={[detail.day, selected && detail.daySelected, future && detail.dayDisabled]}>
        <Text style={[detail.dayWeekday, selected && detail.dayTextSelected]}>{dateLabel(day, 'weekday')}</Text>
        <Text style={[detail.dayNumber, selected && detail.dayTextSelected]}>{dateLabel(day, 'date')}</Text>
      </Pressable>;
    })}</ScrollView>
    {loading && <View style={detail.historyState}><ActivityIndicator color={colors.accent} /><Text style={detail.muted}>Se încarcă istoricul…</Text></View>}
    {!loading && error && <View style={detail.historyState}><Message error>{error}</Message><Button secondary title="Reîncearcă" onPress={onRetry} /></View>}
    {!loading && !error && history?.events.length === 0 && <View style={detail.historyState}><Ionicons name="information-circle-outline" size={25} color={colors.muted} /><Text style={detail.okText}>Nu există deplasări sau parcări pentru ziua selectată.</Text></View>}
    {!loading && !error && history && history.events.length > 0 && <View style={detail.timeline}>{history.events.map((event, index) => <HistoryEventRow key={`${event.type}-${event.startedAt}-${index}`} event={event} timeZone={history.timeZone} last={index === history.events.length - 1} />)}</View>}
  </Section>;
}

function HistoryEventRow({ event, timeZone, last }: { event: VehicleHistoryEvent; timeZone: string; last: boolean }) {
  const trip = event.type === 'TRIP';
  return <View style={detail.historyEvent}>
    <Text style={detail.eventTime}>{eventTime(event.startedAt, timeZone)}</Text>
    <View style={detail.markerColumn}>
      <View style={[detail.eventMarker, trip ? detail.tripMarker : detail.parkingMarker]}>{trip ? <Ionicons name="car" size={17} color="#86efac" /> : <Text style={detail.parkingLetter}>P</Text>}</View>
      {!last && <View style={detail.timelineLine} />}
    </View>
    <View style={detail.eventBody}>
      <View style={detail.eventMetrics}>
        <HistoryMetric icon="time-outline" value={historyDuration(event.durationSeconds)} />
        {trip ? <><HistoryMetric icon="analytics-outline" value={event.distanceKm === null ? '—' : `${event.distanceKm.toLocaleString('ro-RO', { maximumFractionDigits: 2 })} km`} /><HistoryMetric icon="speedometer-outline" value={event.maxSpeedKph === null ? '—' : `${event.maxSpeedKph.toLocaleString('ro-RO')} km/h`} /></> : event.engineOnSeconds > 0 ? <HistoryMetric icon="key-outline" value={historyEngineDuration(event.engineOnSeconds)} /> : null}
      </View>
      <Text style={detail.eventAddress}>{trip ? event.endAddress ?? event.startAddress ?? 'Adresă nespecificată' : event.address ?? 'Adresă nespecificată'}</Text>
    </View>
  </View>;
}

function HistoryMetric({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  return <View style={detail.historyMetric}><Ionicons name={icon} size={17} color="#60a5fa" /><Text style={detail.historyMetricText}>{value}</Text></View>;
}

function TripTab({ vehicle, onCreate, onSaved }: { vehicle: Vehicle; onCreate: () => void; onSaved: (vehicle: Vehicle) => void }) {
  const trip = vehicle.currentTrip;
  const [editingAddresses, setEditingAddresses] = useState(false);
  const [pickupAddress, setPickupAddress] = useState(trip?.pickupAddress ?? '');
  const [deliveryAddress, setDeliveryAddress] = useState(trip?.deliveryAddress ?? '');
  const [savingAddresses, setSavingAddresses] = useState(false);
  const [addressMessage, setAddressMessage] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

  useEffect(() => {
    setPickupAddress(trip?.pickupAddress ?? '');
    setDeliveryAddress(trip?.deliveryAddress ?? '');
    setEditingAddresses(false);
    setAddressMessage(null);
    setAddressError(null);
  }, [trip?.id, trip?.pickupAddress, trip?.deliveryAddress]);

  const saveAddresses = async () => {
    if (!trip || savingAddresses) return;
    if (!pickupAddress.trim()) return setAddressError('Adresa de ridicare este obligatorie.');
    setSavingAddresses(true); setAddressError(null); setAddressMessage(null);
    try {
      const updated = await api.updateTripAddresses(vehicle.id, {
        pickupAddress: pickupAddress.trim(), deliveryAddress: deliveryAddress.trim() || null
      });
      onSaved(updated); setEditingAddresses(false); setAddressMessage('Adresele cursei au fost salvate.');
    } catch (e) { setAddressError(e instanceof Error ? e.message : 'Adresele cursei nu au putut fi salvate.'); }
    finally { setSavingAddresses(false); }
  };

  if (!trip) return <Section title="Cursa curentă"><View style={detail.ok}><Ionicons name="information-circle-outline" size={22} color={colors.muted} /><Text style={detail.okText}>Vehiculul nu are o cursă structurată asignată.</Text></View><View style={detail.quickActions}><Button title="Adaugă o cursă" onPress={onCreate} /></View></Section>;
  return <>
    <Section title={`Comanda ${trip.orderNumber}`}><Row label="Referință externă" value={unspecified(trip.externalReference)} /><Row label="Data comenzii" value={unspecified(trip.orderDate)} /><Row label="Client" value={trip.clientName} /><Row label="Cod fiscal / TVA" value={unspecified(trip.clientVat)} /><Row label="Adresă client" value={unspecified(trip.clientAddress)} /><Row label="Contact client" value={[trip.clientContactName, trip.clientContactPhone, trip.clientContactEmail].filter(Boolean).join(' · ') || 'Nespecificat'} /><View style={detail.quickActions}><Button secondary title={editingAddresses ? 'Închide editarea adreselor' : 'Editează adresele'} onPress={() => { setEditingAddresses(!editingAddresses); setAddressError(null); setAddressMessage(null); }} /></View></Section>
    {editingAddresses && <Section title="Adresele cursei"><Field label="Adresă ridicare" value={pickupAddress} onChangeText={setPickupAddress} maxLength={1000} placeholder="Adresa de ridicare este obligatorie" /><Field label="Adresă livrare (opțională)" value={deliveryAddress} onChangeText={setDeliveryAddress} maxLength={1000} placeholder="Poate fi completată ulterior" /><Text style={detail.hint}>Dacă modifici adresa etapei active, destinația operațională și traseul vehiculului se actualizează automat.</Text>{addressError && <Message error>{addressError}</Message>}<View style={detail.quickActions}><Button title="Salvează adresele" onPress={() => void saveAddresses()} disabled={savingAddresses} /><Button secondary title="Anulează" onPress={() => { setPickupAddress(trip.pickupAddress); setDeliveryAddress(trip.deliveryAddress ?? ''); setEditingAddresses(false); setAddressError(null); }} /></View></Section>}
    {!editingAddresses && addressMessage && <Message>{addressMessage}</Message>}
    <View style={[detail.overviewGrid, detail.overviewGridWide]}><View style={detail.overviewColumn}><Section title="Ridicare"><Row label="Companie" value={unspecified(trip.pickupCompany)} /><Row label="Adresă" value={trip.pickupAddress} /><Row label="Data și ora locală" value={`${trip.pickupLocalDate} · ${trip.pickupLocalTime}${trip.pickupTimeZone ? ` · ${trip.pickupTimeZone}` : ''}`} /><Row label="Contact" value={[trip.pickupContactName, trip.pickupContactPhone].filter(Boolean).join(' · ') || 'Nespecificat'} /><Row label="Referință" value={unspecified(trip.pickupReference)} /><Row label="Instrucțiuni" value={unspecified(trip.pickupInstructions)} /></Section></View>
      <View style={detail.overviewColumn}><Section title="Livrare"><Row label="Companie" value={unspecified(trip.deliveryCompany)} /><Row label="Adresă" value={unspecified(trip.deliveryAddress)} />{!trip.deliveryAddress && <Message>Destinația de livrare nu a fost încă stabilită.</Message>}<Row label="Data și ora locală" value={`${trip.deliveryLocalDate} · ${trip.deliveryLocalTime}${trip.deliveryTimeZone ? ` · ${trip.deliveryTimeZone}` : ''}`} /><Row label="Contact" value={[trip.deliveryContactName, trip.deliveryContactPhone].filter(Boolean).join(' · ') || 'Nespecificat'} /><Row label="Referință" value={unspecified(trip.deliveryReference)} /><Row label="Instrucțiuni" value={unspecified(trip.deliveryInstructions)} /></Section></View></View>
    <Section title="Marfă"><Row label="Descriere" value={unspecified(trip.cargoDescription)} /><Row label="Cantitate / ambalaj" value={[trip.cargoQuantity, trip.cargoPackageType].filter((v) => v !== null).join(' · ') || 'Nespecificat'} /><Row label="Dimensiuni" value={unspecified(trip.cargoDimensions)} /><Row label="Greutate" value={trip.cargoWeightKg === null ? 'Nespecificat' : `${trip.cargoWeightKg} kg`} /><Row label="Volum / metri liniari" value={[trip.cargoVolumeM3 === null ? null : `${trip.cargoVolumeM3} m³`, trip.cargoLoadingMeters === null ? null : `${trip.cargoLoadingMeters} m`].filter(Boolean).join(' · ') || 'Nespecificat'} /><Row label="Paleți / colete" value={[trip.cargoPallets === null ? null : `${trip.cargoPallets} paleți`, trip.cargoParcels === null ? null : `${trip.cargoParcels} colete`].filter(Boolean).join(' · ') || 'Nespecificat'} /><Row label="ADR" value={trip.cargoDangerous === null ? 'Nespecificat' : trip.cargoDangerous ? 'Da' : 'Nu'} /><Row label="Stivuibil" value={trip.cargoStackable === null ? 'Nespecificat' : trip.cargoStackable ? 'Da' : 'Nu'} /></Section>
    <Section title="Tarif și condiții"><Row label="Preț" value={`${trip.priceAmount.toLocaleString('ro-RO')} ${trip.currency}`} /><Row label="TVA" value={trip.vatRate === null ? 'Nespecificat' : `${trip.vatRate}%`} /><Row label="Total" value={trip.totalAmount === null ? 'Nespecificat' : `${trip.totalAmount.toLocaleString('ro-RO')} ${trip.currency}`} /><Row label="Plată" value={unspecified(trip.paymentTerms)} /><Row label="Facturare" value={unspecified(trip.invoicingInstructions)} /><Row label="Instrucțiuni operaționale" value={unspecified(trip.operationalInstructions)} /><Row label="Note contractuale" value={unspecified(trip.contractualNotes)} /></Section>
    <Section title="Asignare și document"><Row label="Vehicul la asignare" value={trip.assignedRegistrationNumber} /><Row label="Șofer la asignare" value={unspecified(trip.assignedDriverName)} /><Row label="Telefon la asignare" value={unspecified(trip.assignedDriverPhone)} /><Row label="Document original" value={trip.sourceDocumentOriginalName ?? 'Nu a fost atașat'} />{trip.sourceDocumentUrl && <View style={detail.quickActions}><Button title="Vezi documentul original" onPress={() => void Linking.openURL(api.tripDocumentUrl(vehicle.id))} /></View>}</Section>
  </>;
}

function OperationsTab({ vehicle, form, editing, setForm }: { vehicle: Vehicle; form: Form; editing: boolean; setForm: (form: Form) => void }) {
  const tripDestinationLabel = form.availability === 'HEADING_TO_PICKUP' ? 'adresa de ridicare' : form.availability === 'ON_TRIP' ? 'adresa de livrare' : null;
  const changeAvailability = (value: string) => {
    const availability = value as Form['availability'];
    let destination = form.destination;
    if (vehicle.currentTrip) {
      if (availability === 'HEADING_TO_PICKUP') destination = vehicle.currentTrip.pickupAddress;
      if (availability === 'ON_TRIP') destination = vehicle.currentTrip.deliveryAddress ?? '';
      if (availability === 'AVAILABLE') destination = '';
    }
    setForm({ ...form, availability, destination });
  };
  return <Section title="Disponibilitate și destinație">{editing ? <><Choice label="Disponibilitate" value={form.availability} options={[['null', 'Nespecificat'], ...Object.entries(availabilityLabels)]} onChange={changeAvailability} /><Field label="Destinație" value={form.destination} onChangeText={(destination) => setForm({ ...form, destination })} maxLength={1000} placeholder="Ex.: DE 60549 Frankfurt" /><Choice label="Profil de rutare" value={form.routingMode} options={Object.entries(routingModeLabels)} onChange={(routingMode) => setForm({ ...form, routingMode: routingMode as RoutingMode })} /><Text style={detail.hint}>{vehicle.currentTrip && tripDestinationLabel ? `Modificarea destinației actualizează și ${tripDestinationLabel} din cursa curentă. ` : ''}După salvare, destinația va fi identificată când este folosită de hartă sau mesaj.</Text></> : <><Row label="Disponibilitate" value={availabilityText(vehicle.availability)} /><Row label="Destinație introdusă" value={unspecified(vehicle.destination)} />{vehicle.currentTrip && vehicle.availability === 'ON_TRIP' && !vehicle.destination && <Message>Destinația de livrare nu a fost încă stabilită.</Message>}<Row label="Destinație identificată" value={unspecified(vehicle.destinationFormattedAddress)} /><Row label="Cod poștal destinație" value={unspecified(vehicle.destinationPostcode)} /><Row label="Profil de rutare" value={routingModeLabels[vehicle.routingMode]} />{vehicle.destinationGeocodingError && <Message error>{vehicle.destinationGeocodingError}</Message>}</>}</Section>;
}

function DriverProfileTab({ vehicle, form, editing, setForm }: { vehicle: Vehicle; form: Form; editing: boolean; setForm: (form: Form) => void }) {
  const router = useRouter();
  return <Section title="Profilul vehiculului">
    <Row label="Număr de înmatriculare" value={vehicle.registrationNumber} />
    <Row label="Stare Wialon" value={vehicle.isActive ? 'Activ' : 'Inactiv'} />
    {editing ? <>
      <Choice label="Tahograf" value={form.tachograph} options={[["null", "Nespecificat"], ["true", "Da"], ["false", "Nu"]]} onChange={(tachograph) => setForm({ ...form, tachograph: tachograph as Form['tachograph'] })} />
      <Field label="Model" value={form.vehicleModel} onChangeText={(vehicleModel) => setForm({ ...form, vehicleModel })} maxLength={120} />
      <Field label="Detalii vehicul" multiline value={form.vehicleDetails} onChangeText={(vehicleDetails) => setForm({ ...form, vehicleDetails })} maxLength={4000} />
    </> : <>
      <Row label="Șoferi asignați" value={vehicle.drivers?.map((driver) => `${driver.name}${driver.isCurrent ? ' (conduce acum)' : ''}`).join(' / ') || 'Nespecificat'} />
      <Row label="Telefon șofer curent" value={formatInternationalPhone(vehicle.driverPhoneE164)} />
      <Row label="Tahograf" value={vehicle.hasTachograph === null ? 'Nespecificat' : vehicle.hasTachograph ? 'Da' : 'Nu'} />
      <Row label="Model" value={unspecified(vehicle.vehicleModel)} />
      <Row label="Detalii vehicul" value={unspecified(vehicle.vehicleDetails)} />
      <View style={detail.quickActions}>
        <Button secondary title="Gestionează șoferii" onPress={() => router.push('/drivers')} />
        {vehicle.driverPhoneE164 && <><Button title="Sună" onPress={() => void Linking.openURL(`tel:${vehicle.driverPhoneE164}`)} /><Button secondary title="Deschide WhatsApp" onPress={() => void Linking.openURL(`https://wa.me/${vehicle.driverPhoneE164!.replace(/\D/g, '')}`)} /></>}
      </View>
    </>}
  </Section>;
}

function DiagnosticsTab({ vehicle, issues, onRefresh, refreshing }: { vehicle: Vehicle; issues: ReturnType<typeof vehicleIssues>; onRefresh: () => void; refreshing: boolean }) {
  const trackerEntries = Object.entries(vehicle.trackerParams ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return <><Section title="Probleme și completitudine">{issues.length ? issues.map((issue) => <View key={issue.key} style={detail.issue}><Ionicons name={issue.severity === 'attention' ? 'warning' : 'information-circle'} size={19} color={issue.severity === 'attention' ? colors.yellow : '#93c5fd'} /><View style={{ flex: 1 }}><Text style={detail.issueTitle}>{issue.title}</Text><Text style={detail.issueText}>{issue.detail}</Text></View></View>) : <View style={detail.ok}><Ionicons name="checkmark-circle" size={22} color={colors.success} /><Text style={detail.okText}>Fără probleme active.</Text></View>}</Section><Section title="Locație și sincronizare"><Row label="Țară" value={unspecified(vehicle.country)} /><Row label="Cod țară" value={unspecified(vehicle.countryCode)} /><Row label="Localitate" value={unspecified(vehicle.city)} /><Row label="Regiune / județ" value={unspecified(vehicle.region)} /><Row label="District / suburbie" value={unspecified(vehicle.district)} /><Row label="Stradă și număr" value={[vehicle.street, vehicle.houseNumber].filter(Boolean).join(' ') || 'Nespecificat'} /><Row label="Cod poștal" value={unspecified(vehicle.postcode)} /><Row label="Adresă completă" value={unspecified(vehicle.formattedAddress)} /><Row label="Ultima geocodare" value={bucharestDate(vehicle.lastGeocodedAt)} /><Row label="Ultimul succes Wialon" value={bucharestDate(vehicle.lastWialonSuccessAt)} /><View style={detail.quickActions}><Button title="Actualizează locația" onPress={onRefresh} disabled={refreshing} /></View><Text style={detail.attribution}>{vehicle.attribution}</Text></Section><Section title="GPS și tracker"><Row label="Viteză" value={vehicle.speedKph === null ? 'Nespecificat' : `${vehicle.speedKph} km/h`} /><Row label="Ultima poziție GPS" value={bucharestDate(vehicle.positionAt)} /><Row label="Ultimul mesaj" value={bucharestDate(vehicle.lastMessageAt)} /><Row label="Recepția mesajului" value={bucharestDate(vehicle.lastMessageReceivedAt)} /><Row label="Latitudine / longitudine" value={vehicle.latitude === null || vehicle.longitude === null ? 'Nespecificat' : `${vehicle.latitude}, ${vehicle.longitude}`} /><Row label="Direcție" value={vehicle.courseDegrees === null ? 'Nespecificat' : `${vehicle.courseDegrees}°`} /><Row label="Altitudine" value={vehicle.altitudeMeters === null ? 'Nespecificat' : `${vehicle.altitudeMeters} m`} /><Row label="Sateliți" value={unspecified(vehicle.satellites)} />{trackerEntries.length > 0 && <><Text style={detail.subheading}>Parametri tehnici</Text>{trackerEntries.map(([key, value]) => <Row key={key} label={key} value={typeof value === 'object' ? JSON.stringify(value, null, 2) : unspecified(value)} />)}</>}</Section></>;
}

function SummaryRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) { return <View style={detail.summaryRow}><View style={detail.summaryIcon}><Ionicons name={icon} size={18} color="#93c5fd" /></View><View style={{ flex: 1 }}><Text style={detail.summaryLabel}>{label}</Text><Text style={detail.summaryValue}>{value}</Text></View></View>; }
function Choice({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) { return <View style={{ gap: 7 }}><Text style={detail.choiceLabel}>{label}</Text><View style={detail.choices}>{options.map(([key, text]) => <Pressable key={key} onPress={() => onChange(key)} style={[detail.choice, value === key && detail.choiceActive]}><Text style={detail.choiceText}>{text}</Text></Pressable>)}</View></View>; }
function validTab(value?: string): Tab | null { return tabs.some((item) => item.key === value) ? value as Tab : null; }
function todayInBucharest() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function addDateDays(value: string, days: number) { const [year, month, day] = value.split('-').map(Number); return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10); }
function dateLabel(value: string, part: 'weekday' | 'date') { const date = new Date(`${value}T12:00:00Z`); return part === 'weekday' ? new Intl.DateTimeFormat('ro-RO', { weekday: 'short', timeZone: 'UTC' }).format(date) : new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date); }
function eventTime(value: string, timeZone: string) { return new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(new Date(value)); }
function historyDuration(seconds: number) { const minutes = Math.max(seconds > 0 ? 1 : 0, Math.floor(seconds / 60)); return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`; }
function historyEngineDuration(seconds: number) { return seconds < 60 ? `${seconds} s` : historyDuration(seconds); }
function formatDistance(value: number | null | undefined) { return value === null || value === undefined ? 'Distanță nespecificată' : `${(value / 1000).toLocaleString('ro-RO', { maximumFractionDigits: 1 })} km`; }
function formatDuration(value: number | null | undefined) { if (value === null || value === undefined) return 'Durată nespecificată'; const minutes = Math.max(1, Math.round(value / 60)); return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`; }

const detail = StyleSheet.create({
  root: { flex: 1, minHeight: 0 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14 }, tabScroller: { flexGrow: 0, backgroundColor: '#101722', borderBottomWidth: 1, borderBottomColor: colors.border }, tabs: { paddingHorizontal: 14, paddingVertical: 8, gap: 6 }, tab: { minHeight: 42, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 }, tabActive: { backgroundColor: '#1e3a63' }, tabText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, tabTextActive: { color: '#fff' }, tabCount: { minWidth: 19, height: 19, borderRadius: 10, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }, tabCountText: { color: '#fff', fontSize: 10, fontWeight: '900' }, scroll: { flex: 1 }, content: { paddingTop: 16, paddingBottom: 34 },
  hero: { borderRadius: 15, padding: 17, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, gap: 15 }, heroTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, heroPlate: { color: colors.text, fontSize: 27, fontWeight: '900' }, muted: { color: colors.muted, lineHeight: 19 }, quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  overviewGrid: { gap: 14 }, overviewGridWide: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }, overviewColumn: { flex: 1, minWidth: 280 }, summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }, summaryIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#102f51', alignItems: 'center', justifyContent: 'center' }, summaryLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }, summaryValue: { color: colors.text, marginTop: 2, lineHeight: 19 }, inlineLink: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.panel2, borderRadius: 9, paddingHorizontal: 12 }, inlineLinkText: { color: '#93c5fd', fontWeight: '800', fontSize: 13 },
  issue: { minHeight: 54, flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }, issueTitle: { color: colors.text, fontWeight: '800' }, issueText: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 }, ok: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9 }, okText: { color: colors.text, fontWeight: '700' },
  mapMeta: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }, routeSummary: { backgroundColor: '#102f51', borderRadius: 10, padding: 12, flexDirection: 'row', gap: 10 }, routeTitle: { color: colors.text, fontWeight: '900', marginBottom: 3 }, attribution: { color: colors.muted, fontSize: 11 }, hint: { color: colors.muted, fontSize: 12, lineHeight: 18 }, stickyActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: '#101722' },
  historyHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, historyTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  dayPicker: { gap: 9, paddingVertical: 4 }, day: { minWidth: 94, minHeight: 64, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: colors.muted, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }, daySelected: { backgroundColor: '#1454a3', borderColor: colors.accent }, dayDisabled: { opacity: .35 }, dayWeekday: { color: colors.muted, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' }, dayNumber: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 2 }, dayTextSelected: { color: '#fff' },
  historyState: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 12 }, timeline: { paddingTop: 4 }, historyEvent: { flexDirection: 'row', alignItems: 'stretch', minHeight: 86 }, eventTime: { width: 52, paddingTop: 8, color: colors.text, fontWeight: '900', fontSize: 15 }, markerColumn: { width: 38, alignItems: 'center' }, eventMarker: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center', zIndex: 2 }, tripMarker: { borderColor: '#22c55e' }, parkingMarker: { borderColor: '#3b82f6' }, parkingLetter: { color: '#60a5fa', fontWeight: '900', fontSize: 17 }, timelineLine: { width: 2, flex: 1, backgroundColor: colors.border }, eventBody: { flex: 1, minWidth: 0, paddingTop: 6, paddingBottom: 18, paddingLeft: 8, borderBottomWidth: 1, borderBottomColor: colors.border }, eventMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, historyMetric: { flexDirection: 'row', alignItems: 'center', gap: 4 }, historyMetricText: { color: colors.text, fontSize: 14, fontWeight: '800' }, eventAddress: { color: colors.muted, marginTop: 7, lineHeight: 18 },
  choiceLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { minHeight: 42, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1, borderRadius: 9 }, choiceActive: { backgroundColor: colors.accent, borderColor: colors.accent }, choiceText: { color: colors.text, fontWeight: '700' }, subheading: { color: colors.text, fontWeight: '900', fontSize: 16, marginTop: 8 }
});
