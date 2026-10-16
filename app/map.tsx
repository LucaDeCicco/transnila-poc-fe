import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppShell } from '@/components/app-shell';
import { FilterChip, SearchField, StatusBadge } from '@/components/fleet-ui';
import { Button, colors, Message, styles as ui } from '@/components/ui';
import { VehicleMap } from '@/components/vehicle-map';
import { api } from '@/lib/api';
import { bucharestDate, unspecified } from '@/lib/format';
import { normalizeRegistration, vehicleIssues, vehicleLocation } from '@/lib/vehicle';
import { Availability, MapConfig, Vehicle, VehicleRoute } from '@/types/vehicle';

type MapFilter = 'ALL' | Availability | 'ATTENTION';

export default function FleetMapScreen() {
  const [config, setConfig] = useState<MapConfig | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<VehicleRoute | null>(null);
  const [filter, setFilter] = useState<MapFilter>('ALL');
  const [search, setSearch] = useState('');
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const desktop = width >= 1050;
  const mapHeight = desktop ? Math.max(500, height - 205) : Math.max(450, Math.min(620, height - 195));

  const refreshFleet = useCallback(async () => {
    if (active.current) return;
    active.current = true; setRefreshing(true);
    try {
      const live = await api.liveFleet();
      setVehicles(live.vehicles); setLastSuccessAt(live.lastSuccessAt);
      setError(live.success === false ? live.error ?? 'Pozițiile nu au putut fi actualizate.' : null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Harta nu poate fi actualizată.'); }
    finally { active.current = false; setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    let disposed = false; let timer: ReturnType<typeof setInterval> | undefined;
    setLoading(true);
    api.mapConfig().then((value) => {
      if (disposed) return;
      setConfig(value); void refreshFleet();
      timer = setInterval(() => void refreshFleet(), Math.max(1, value.refreshIntervalSeconds) * 1000);
    }).catch((e: unknown) => { if (!disposed) { setError(e instanceof Error ? e.message : 'Configurația hărții nu poate fi încărcată.'); setLoading(false); } });
    return () => { disposed = true; if (timer) clearInterval(timer); };
  }, [refreshFleet]));

  useEffect(() => {
    let disposed = false;
    if (!selectedId) { setRoute(null); return; }
    api.vehicleRoute(selectedId).then((value) => { if (!disposed) setRoute(value); }).catch((e: unknown) => { if (!disposed) setRoute({ status: 'unavailable', warning: e instanceof Error ? e.message : 'Traseul nu poate fi calculat.' }); });
    return () => { disposed = true; };
  }, [selectedId]);

  const filtered = useMemo(() => vehicles.filter((vehicle) => {
    if (search && !normalizeRegistration(vehicle.registrationNumber).includes(normalizeRegistration(search))) return false;
    if (filter === 'ATTENTION') return vehicleIssues(vehicle, config?.stalePositionMinutes ?? 15).some((issue) => issue.severity === 'attention');
    return filter === 'ALL' || vehicle.availability === filter;
  }), [config?.stalePositionMinutes, filter, search, vehicles]);
  const selected = vehicles.find((vehicle) => vehicle.id === selectedId) ?? null;
  useEffect(() => { if (selectedId && !filtered.some((vehicle) => vehicle.id === selectedId)) setSelectedId(null); }, [filtered, selectedId]);
  const counts = { available: vehicles.filter((item) => item.availability === 'AVAILABLE').length, pickup: vehicles.filter((item) => item.availability === 'HEADING_TO_PICKUP').length, trip: vehicles.filter((item) => item.availability === 'ON_TRIP').length };

  return <AppShell active="map" title="Hartă flotă" subtitle={`${filtered.length} vehicule afișate · actualizare la ${config?.refreshIntervalSeconds ?? 60} secunde`}>
    <View style={[ui.content, page.content]}>
      {error && <Message error>{error}</Message>}
      <View style={page.toolbar}><SearchField value={search} onChange={setSearch} /><Button secondary title={refreshing ? 'Se actualizează…' : 'Actualizează'} onPress={() => void refreshFleet()} disabled={refreshing} /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={page.filters}>
        <FilterChip label="Toate" count={vehicles.length} active={filter === 'ALL'} onPress={() => setFilter('ALL')} />
        <FilterChip label="Disponibile" count={counts.available} active={filter === 'AVAILABLE'} onPress={() => setFilter('AVAILABLE')} />
        <FilterChip label="Către preluare" count={counts.pickup} active={filter === 'HEADING_TO_PICKUP'} onPress={() => setFilter('HEADING_TO_PICKUP')} />
        <FilterChip label="În cursă" count={counts.trip} active={filter === 'ON_TRIP'} onPress={() => setFilter('ON_TRIP')} />
        <FilterChip label="Necesită atenție" active={filter === 'ATTENTION'} onPress={() => setFilter('ATTENTION')} />
      </ScrollView>
      <View style={[page.workspace, desktop && page.workspaceDesktop]}>
        <View style={[page.mapWrap, { minHeight: mapHeight }]}>
          {config && filtered.some((item) => item.latitude !== null && item.longitude !== null) ? <VehicleMap config={config} vehicles={filtered} selectedVehicleId={selectedId} route={route} onVehiclePress={setSelectedId} height={mapHeight} fitFleet={!selectedId} /> : loading ? <View style={[page.center, { height: mapHeight }]}><ActivityIndicator size="large" color={colors.accent} /></View> : <View style={[page.center, { height: mapHeight }]}><Ionicons name="location-outline" size={34} color={colors.muted} /><Text style={page.muted}>Niciun vehicul din filtru nu are coordonate GPS.</Text></View>}
          {!desktop && selected && <View style={page.mobilePanel}><VehiclePanel vehicle={selected} route={route} lastSuccessAt={lastSuccessAt} onClose={() => setSelectedId(null)} onOpen={() => router.push(`/vehicles/${selected.id}`)} /></View>}
        </View>
        {desktop && <View style={page.sidePanel}>{selected ? <VehiclePanel vehicle={selected} route={route} lastSuccessAt={lastSuccessAt} onClose={() => setSelectedId(null)} onOpen={() => router.push(`/vehicles/${selected.id}`)} /> : <View style={page.selectPrompt}><Ionicons name="locate-outline" size={34} color={colors.muted} /><Text style={page.promptTitle}>Selectează un vehicul</Text><Text style={page.muted}>Apasă pe un marcaj pentru locație, destinație și traseu.</Text><Text style={page.sync}>Ultima sincronizare: {bucharestDate(lastSuccessAt)}</Text></View>}</View>}
      </View>
      <View style={page.legend}><Legend color={colors.success} label="Disponibil" /><Legend color={colors.orange} label="Către preluare" /><Legend color="#60a5fa" label="În cursă" /><Legend color="#94a3b8" label="Nespecificat" /><Text style={page.legendNote}>Marcajele estompate au poziții vechi.</Text></View>
    </View>
  </AppShell>;
}

function VehiclePanel({ vehicle, route, lastSuccessAt, onClose, onOpen }: { vehicle: Vehicle; route: VehicleRoute | null; lastSuccessAt: string | null; onClose: () => void; onOpen: () => void }) {
  const phone = vehicle.driverPhoneE164;
  return <ScrollView contentContainerStyle={page.panelContent}>
    <View style={page.panelHeader}><View><Text style={page.panelPlate}>{vehicle.registrationNumber}</Text><Text style={page.muted}>{vehicle.vehicleModel ?? 'Model nespecificat'}</Text></View><Pressable onPress={onClose} style={page.close}><Ionicons name="close" size={21} color={colors.text} /></Pressable></View>
    <StatusBadge value={vehicle.availability} />
    <PanelRow icon="person-outline" label="Șofer" value={unspecified(vehicle.driverName)} />
    <PanelRow icon="location-outline" label="Locație" value={vehicleLocation(vehicle) || 'Nespecificat'} />
    <PanelRow icon="time-outline" label="Poziție GPS" value={bucharestDate(vehicle.positionAt)} />
    <PanelRow icon="flag-outline" label="Destinație" value={unspecified(vehicle.destination)} />
    {route?.status === 'ready' && <View style={page.route}><Ionicons name="navigate" size={19} color="#93c5fd" /><View style={{ flex: 1 }}><Text style={page.routeTitle}>{formatDistance(route.distanceMeters)} · {formatDuration(route.durationSeconds)}</Text><Text style={page.routeText}>{route.destination?.formattedAddress}</Text></View></View>}
    {route?.warning && <Message error>{route.warning}</Message>}
    <Text style={page.sync}>Sincronizare flotă: {bucharestDate(lastSuccessAt)}</Text>
    <View style={page.panelActions}><Button title="Vezi vehiculul" onPress={onOpen} />{phone && <><Button secondary title="Sună" onPress={() => void Linking.openURL(`tel:${phone}`)} /><Button secondary title="WhatsApp" onPress={() => void Linking.openURL(`https://wa.me/${phone.replace(/\D/g, '')}`)} /></>}</View>
  </ScrollView>;
}

function PanelRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) { return <View style={page.panelRow}><Ionicons name={icon} size={18} color={colors.muted} /><View style={{ flex: 1 }}><Text style={page.rowLabel}>{label}</Text><Text style={page.rowValue}>{value}</Text></View></View>; }
function Legend({ color, label }: { color: string; label: string }) { return <View style={page.legendItem}><View style={[page.legendDot, { backgroundColor: color }]} /><Text style={page.legendText}>{label}</Text></View>; }
function formatDistance(value: number | null | undefined) { return value === null || value === undefined ? 'Distanță nespecificată' : `${(value / 1000).toLocaleString('ro-RO', { maximumFractionDigits: 1 })} km`; }
function formatDuration(value: number | null | undefined) { if (value === null || value === undefined) return 'Durată nespecificată'; const minutes = Math.max(1, Math.round(value / 60)); return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`; }

const page = StyleSheet.create({
  content: { maxWidth: 1600, paddingTop: 14, paddingBottom: 16 }, toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, filters: { gap: 7, paddingRight: 10 }, workspace: { position: 'relative', gap: 10 }, workspaceDesktop: { flexDirection: 'row' }, mapWrap: { flex: 1, minWidth: 0, position: 'relative', backgroundColor: colors.panel, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }, sidePanel: { width: 330, borderRadius: 14, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }, mobilePanel: { position: 'absolute', left: 9, right: 9, bottom: 9, maxHeight: '69%', borderRadius: 16, backgroundColor: 'rgba(19,27,40,.97)', borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 10 }, muted: { color: colors.muted, lineHeight: 19 }, selectPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 }, promptTitle: { color: colors.text, fontSize: 17, fontWeight: '900' }, sync: { color: colors.muted, fontSize: 11, marginTop: 3 },
  panelContent: { padding: 16, gap: 12 }, panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, panelPlate: { color: colors.text, fontSize: 23, fontWeight: '900' }, close: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panel2 }, panelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }, rowLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }, rowValue: { color: colors.text, marginTop: 2, lineHeight: 19 }, route: { padding: 11, borderRadius: 10, backgroundColor: '#102f51', flexDirection: 'row', gap: 9 }, routeTitle: { color: colors.text, fontWeight: '900' }, routeText: { color: colors.muted, fontSize: 11, marginTop: 3 }, panelActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 }, legendDot: { width: 9, height: 9, borderRadius: 5 }, legendText: { color: colors.muted, fontSize: 11, fontWeight: '700' }, legendNote: { color: colors.muted, fontSize: 11, marginLeft: 'auto' }
});
