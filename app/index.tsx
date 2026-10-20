import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppShell } from '@/components/app-shell';
import { EmptyState, FilterChip, MetricCard, SearchField, StatusBadge } from '@/components/fleet-ui';
import { QuickEditVehicle } from '@/components/quick-edit-vehicle';
import { Button, colors, Message, styles as ui } from '@/components/ui';
import { api } from '@/lib/api';
import { bucharestDate, unspecified } from '@/lib/format';
import { normalizeRegistration, positionAgeMinutes, statusTone, tachograph, vehicleIssues, vehicleLocation } from '@/lib/vehicle';
import { Availability, AvailabilityMessageResponse, MapConfig, Vehicle } from '@/types/vehicle';

type StatusFilter = 'ALL' | Availability | 'AVAILABLE_SOON' | 'UNSPECIFIED' | 'ATTENTION';

export default function OperationsScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [messageSummary, setMessageSummary] = useState<AvailabilityMessageResponse | null>(null);
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [modelFilter, setModelFilter] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [tachographFilter, setTachographFilter] = useState<'all' | 'yes' | 'no' | 'unknown'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const activeRequest = useRef(false);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = width >= 1120;
  const showHeaderAction = width >= 620;
  const staleMinutes = mapConfig?.stalePositionMinutes ?? 15;

  const load = useCallback(async () => {
    if (activeRequest.current) return;
    activeRequest.current = true; setLoading(true); setError(null);
    try {
      const [saved, status, config] = await Promise.all([api.list(), api.fleetRefreshStatus(), api.mapConfig()]);
      setVehicles(saved); setLastSuccessAt(status.lastSuccessAt); setMapConfig(config); setLoading(false);
      api.availabilityMessage().then(setMessageSummary).catch(() => undefined);
      const refreshed = await api.autoFleet();
      if (refreshed.performed && refreshed.success === false) setError(refreshed.error ?? 'Sincronizarea flotei a eșuat.');
      if (refreshed.performed) {
        const [next, nextStatus] = await Promise.all([api.list(), api.fleetRefreshStatus()]);
        setVehicles(next); setLastSuccessAt(nextStatus.lastSuccessAt);
        api.availabilityMessage().then(setMessageSummary).catch(() => undefined);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Datele flotei nu pot fi încărcate.'); }
    finally { activeRequest.current = false; setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return undefined; }, [load]));

  const manualRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true); setResult(null); setError(null);
    try {
      const response = await api.manualFleet();
      if (!response.performed) setResult(response.nextAllowedAt ? `Următoarea actualizare manuală este disponibilă ${bucharestDate(response.nextAllowedAt)}.` : 'Nicio mașină nu este eligibilă acum.');
      else if (!response.success) setError(response.error ?? 'Actualizarea flotei a eșuat.');
      else setResult(`Flotă actualizată: ${response.updated ?? 0}; omise: ${response.skipped?.length ?? 0}; erori: ${response.failed?.length ?? 0}.`);
      const [next, status] = await Promise.all([api.list(), api.fleetRefreshStatus()]);
      setVehicles(next); setLastSuccessAt(status.lastSuccessAt);
      api.availabilityMessage().then(setMessageSummary).catch(() => undefined);
    } catch (e) { setError(e instanceof Error ? e.message : 'Actualizarea a eșuat.'); }
    finally { setRefreshing(false); }
  };

  const metrics = useMemo(() => ({
    all: vehicles.length,
    available: vehicles.filter((item) => item.availability === 'AVAILABLE').length,
    availableSoon: vehicles.filter((item) => item.isAvailableSoon).length,
    pickup: vehicles.filter((item) => item.availability === 'HEADING_TO_PICKUP').length,
    trip: vehicles.filter((item) => item.availability === 'ON_TRIP').length,
    attention: vehicles.filter((item) => vehicleIssues(item, staleMinutes).some((issue) => issue.severity === 'attention')).length
  }), [staleMinutes, vehicles]);
  const models = useMemo(() => [...new Set(vehicles.map((item) => item.vehicleModel?.trim()).filter((value): value is string => Boolean(value)))].sort(), [vehicles]);
  const countries = useMemo(() => [...new Set(vehicles.map((item) => item.country?.trim()).filter((value): value is string => Boolean(value)))].sort(), [vehicles]);
  const filtered = useMemo(() => vehicles.filter((vehicle) => {
    if (search && !normalizeRegistration(vehicle.registrationNumber).includes(normalizeRegistration(search))) return false;
    if (statusFilter === 'ATTENTION' && !vehicleIssues(vehicle, staleMinutes).some((issue) => issue.severity === 'attention')) return false;
    if (statusFilter === 'UNSPECIFIED' && vehicle.availability !== null) return false;
    if (statusFilter === 'AVAILABLE' && vehicle.availability !== 'AVAILABLE' && !vehicle.isAvailableSoon) return false;
    if (statusFilter === 'AVAILABLE_SOON' && !vehicle.isAvailableSoon) return false;
    if (statusFilter !== 'ALL' && statusFilter !== 'ATTENTION' && statusFilter !== 'UNSPECIFIED' && statusFilter !== 'AVAILABLE' && statusFilter !== 'AVAILABLE_SOON' && vehicle.availability !== statusFilter) return false;
    if (modelFilter && vehicle.vehicleModel?.toLocaleLowerCase('ro-RO') !== modelFilter.toLocaleLowerCase('ro-RO')) return false;
    if (countryFilter && vehicle.country !== countryFilter) return false;
    if (tachographFilter === 'yes' && vehicle.hasTachograph !== true) return false;
    if (tachographFilter === 'no' && vehicle.hasTachograph !== false) return false;
    if (tachographFilter === 'unknown' && vehicle.hasTachograph !== null) return false;
    return true;
  }), [countryFilter, modelFilter, search, staleMinutes, statusFilter, tachographFilter, vehicles]);
  const hasAdvancedFilters = Boolean(modelFilter || countryFilter || tachographFilter !== 'all');
  const resetFilters = () => { setStatusFilter('ALL'); setModelFilter(null); setCountryFilter(null); setTachographFilter('all'); setSearch(''); };
  const updateVehicle = (updated: Vehicle) => setVehicles((current) => current.map((item) => item.id === updated.id ? updated : item));

  const header = <View style={screen.header}>
    {!showHeaderAction && <Button title="Actualizează flota" onPress={() => void manualRefresh()} disabled={refreshing} />}
    <View style={screen.syncLine}><View><Text style={screen.syncLabel}>Ultima actualizare Wialon</Text><Text style={screen.syncValue}>{bucharestDate(lastSuccessAt)}</Text></View><View style={[screen.liveDot, { backgroundColor: error ? colors.danger : colors.success }]} /></View>
    {error && <Message error>{error}</Message>}{result && <Message>{result}</Message>}
    <View style={screen.metrics}>
      <MetricCard label="Vehicule active" value={metrics.all} tone={colors.accent} active={statusFilter === 'ALL'} onPress={() => setStatusFilter('ALL')} icon={<Ionicons name="car-sport-outline" size={20} color={colors.accent} />} />
      <MetricCard label="Disponibile" value={metrics.available} tone={colors.success} active={statusFilter === 'AVAILABLE'} onPress={() => setStatusFilter('AVAILABLE')} icon={<Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />} />
      <MetricCard label="Disponibile în curând" value={metrics.availableSoon} tone={colors.yellow} active={statusFilter === 'AVAILABLE_SOON'} onPress={() => setStatusFilter('AVAILABLE_SOON')} icon={<Ionicons name="warning-outline" size={20} color={colors.yellow} />} />
      <MetricCard label="Către preluare" value={metrics.pickup} tone={colors.orange} active={statusFilter === 'HEADING_TO_PICKUP'} onPress={() => setStatusFilter('HEADING_TO_PICKUP')} icon={<Ionicons name="navigate-outline" size={20} color={colors.orange} />} />
      <MetricCard label="În cursă" value={metrics.trip} tone="#60a5fa" active={statusFilter === 'ON_TRIP'} onPress={() => setStatusFilter('ON_TRIP')} icon={<Ionicons name="trail-sign-outline" size={20} color="#60a5fa" />} />
      <MetricCard label="Necesită atenție" value={metrics.attention} tone={colors.danger} active={statusFilter === 'ATTENTION'} onPress={() => setStatusFilter('ATTENTION')} icon={<Ionicons name="warning-outline" size={20} color={colors.danger} />} />
    </View>
    <Pressable onPress={() => router.push('/availability')} style={({ pressed }) => [screen.messageSummary, pressed && { opacity: .75 }]}>
      <View style={screen.messageIcon}><Ionicons name="chatbubble-ellipses-outline" size={22} color="#bfdbfe" /></View>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={screen.messageTitle}>Mesaj disponibilitate</Text><Text style={screen.messageText}>{messageSummary ? `${messageSummary.includedVehicles} vehicule incluse · generat ${bucharestDate(messageSummary.generatedAt)}` : 'Deschide mesajul pregătit pentru WhatsApp'}</Text></View>
      <Ionicons name="chevron-forward" size={22} color={colors.muted} />
    </Pressable>
    <View style={screen.tools}><SearchField value={search} onChange={setSearch} /><Pressable onPress={() => setShowFilters((value) => !value)} style={[screen.filterButton, (showFilters || hasAdvancedFilters) && screen.filterButtonActive]}><Ionicons name="options-outline" size={20} color={colors.text} /><Text style={screen.filterButtonText}>Filtre{hasAdvancedFilters ? ' active' : ''}</Text></Pressable></View>
    <View style={screen.chips}>
      <FilterChip label="Toate" active={statusFilter === 'ALL'} count={metrics.all} onPress={() => setStatusFilter('ALL')} />
      <FilterChip label="Disponibile" active={statusFilter === 'AVAILABLE'} count={metrics.available + metrics.availableSoon} onPress={() => setStatusFilter('AVAILABLE')} />
      <FilterChip label="În curând" active={statusFilter === 'AVAILABLE_SOON'} count={metrics.availableSoon} onPress={() => setStatusFilter('AVAILABLE_SOON')} />
      <FilterChip label="Către preluare" active={statusFilter === 'HEADING_TO_PICKUP'} count={metrics.pickup} onPress={() => setStatusFilter('HEADING_TO_PICKUP')} />
      <FilterChip label="În cursă" active={statusFilter === 'ON_TRIP'} count={metrics.trip} onPress={() => setStatusFilter('ON_TRIP')} />
      <FilterChip label="Nespecificat" active={statusFilter === 'UNSPECIFIED'} onPress={() => setStatusFilter('UNSPECIFIED')} />
    </View>
    {showFilters && <View style={screen.advancedFilters}>
      <FilterGroup label="Model"><FilterChip label="Toate" active={!modelFilter} onPress={() => setModelFilter(null)} />{models.map((model) => <FilterChip key={model} label={model} active={modelFilter === model} onPress={() => setModelFilter(modelFilter === model ? null : model)} />)}</FilterGroup>
      <FilterGroup label="Țară"><FilterChip label="Toate" active={!countryFilter} onPress={() => setCountryFilter(null)} />{countries.map((country) => <FilterChip key={country} label={country} active={countryFilter === country} onPress={() => setCountryFilter(countryFilter === country ? null : country)} />)}</FilterGroup>
      <FilterGroup label="Tahograf">{([['all', 'Toate'], ['yes', 'Da'], ['no', 'Nu'], ['unknown', 'Nespecificat']] as const).map(([key, label]) => <FilterChip key={key} label={label} active={tachographFilter === key} onPress={() => setTachographFilter(key)} />)}</FilterGroup>
      {hasAdvancedFilters && <Pressable onPress={resetFilters}><Text style={screen.reset}>Resetează toate filtrele</Text></Pressable>}
    </View>}
    <View style={screen.listHeading}><View><Text style={screen.sectionTitle}>Flota activă</Text><Text style={screen.sectionSubtitle}>{filtered.length} din {vehicles.length} vehicule</Text></View></View>
    {desktop && filtered.length > 0 && <View style={screen.tableHeader}><Text style={screen.colPlate}>Vehicul</Text><Text style={screen.colDriver}>Șofer</Text><Text style={screen.colStatus}>Status</Text><Text style={screen.colTacho}>Tahograf</Text><Text style={screen.colLocation}>Locație</Text><Text style={screen.colDestination}>Destinație</Text><Text style={screen.colUpdated}>Poziție</Text><View style={screen.colAction} /></View>}
  </View>;

  return <AppShell active="operations" title="Operațiuni" subtitle="Situația curentă a flotei" action={showHeaderAction ? <Button title="Actualizează" onPress={() => void manualRefresh()} disabled={refreshing} /> : undefined}>
    <FlatList data={filtered} keyExtractor={(item) => item.id} contentContainerStyle={[ui.content, screen.content, filtered.length === 0 && { flexGrow: 1 }]} ListHeaderComponent={header}
      renderItem={({ item }) => <VehicleRow vehicle={item} desktop={desktop} staleMinutes={staleMinutes} onOpen={() => router.push(`/vehicles/${item.id}`)} onEdit={() => setEditing(item)} />}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      ListEmptyComponent={loading ? <ActivityIndicator size="large" color={colors.accent} /> : <EmptyState icon="search-outline" title="Niciun vehicul găsit" detail="Modifică termenul de căutare sau resetează filtrele aplicate." action={<Button secondary title="Resetează filtrele" onPress={resetFilters} />} />}
    />
    <QuickEditVehicle vehicle={editing} visible={Boolean(editing)} onClose={() => setEditing(null)} onSave={updateVehicle} />
  </AppShell>;
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={screen.filterGroup}><Text style={screen.filterLabel}>{label}</Text><View style={screen.chips}>{children}</View></View>;
}

function VehicleRow({ vehicle, desktop, staleMinutes, onOpen, onEdit }: { vehicle: Vehicle; desktop: boolean; staleMinutes: number; onOpen: () => void; onEdit: () => void }) {
  const tone = vehicle.isAvailableSoon ? { ...statusTone(vehicle.availability), accent: colors.yellow } : statusTone(vehicle.availability);
  const issues = vehicleIssues(vehicle, staleMinutes);
  const attention = issues.filter((issue) => issue.severity === 'attention').length;
  const age = positionAgeMinutes(vehicle);
  const ageText = age === null ? 'Fără poziție' : age < 1 ? 'Acum' : age < 60 ? `${age} min` : `${Math.floor(age / 60)} h ${age % 60} min`;
  return <Pressable onPress={onOpen} style={({ pressed }) => [screen.vehicle, { borderLeftColor: tone.accent }, desktop && screen.vehicleDesktop, pressed && { opacity: .75 }]}>
    {desktop ? <>
      <View style={screen.colPlate}><View style={screen.plateLine}><Text style={screen.plate}>{vehicle.registrationNumber}</Text>{attention > 0 && <Ionicons name="warning" size={16} color={colors.yellow} />}</View><Text numberOfLines={1} style={screen.mini}>{vehicle.vehicleModel ?? 'Model nespecificat'}</Text></View>
      <Text numberOfLines={2} style={screen.colDriver}>{unspecified(vehicle.driverName)}</Text>
      <View style={[screen.colStatus, screen.statusStack]}><StatusBadge value={vehicle.availability} compact />{vehicle.isAvailableSoon && <AvailableSoonBadge vehicle={vehicle} />}</View>
      <Text style={screen.colTacho}>{tachograph(vehicle.hasTachograph)}</Text>
      <Text numberOfLines={2} style={screen.colLocation}>{vehicleLocation(vehicle) || 'Nespecificat'}</Text>
      <Text numberOfLines={2} style={screen.colDestination}>{unspecified(vehicle.destination)}</Text>
      <View style={screen.colUpdated}><Text style={[screen.age, attention > 0 && { color: colors.yellow }]}>{ageText}</Text></View>
      <View style={screen.colAction}><Pressable accessibilityLabel={`Actualizează ${vehicle.registrationNumber}`} onPress={(event) => { event.stopPropagation(); onEdit(); }} style={screen.rowAction}><Ionicons name="create-outline" size={19} color={colors.text} /></Pressable></View>
    </> : <>
      <View style={screen.mobileTop}><View style={{ flex: 1, minWidth: 0 }}><View style={screen.plateLine}><Text style={screen.plate}>{vehicle.registrationNumber}</Text>{attention > 0 && <Ionicons name="warning" size={17} color={colors.yellow} />}</View><Text style={screen.mini}>{vehicle.vehicleModel ?? 'Model nespecificat'} · {unspecified(vehicle.driverName)}</Text></View><View style={screen.statusStack}><StatusBadge value={vehicle.availability} compact />{vehicle.isAvailableSoon && <AvailableSoonBadge vehicle={vehicle} />}</View></View>
      <View style={screen.mobileGrid}><MobileDatum icon="location-outline" value={vehicleLocation(vehicle) || 'Locație nespecificată'} /><MobileDatum icon="flag-outline" value={`Destinație: ${unspecified(vehicle.destination)}`} /><MobileDatum icon="speedometer-outline" value={`Tahograf: ${tachograph(vehicle.hasTachograph)}`} /><MobileDatum icon="time-outline" value={`Poziție: ${ageText}`} warning={attention > 0} /></View>
      <View style={screen.mobileActions}><Pressable onPress={(event) => { event.stopPropagation(); onEdit(); }} style={screen.quickAction}><Ionicons name="create-outline" size={18} color={colors.text} /><Text style={screen.quickActionText}>Status și destinație</Text></Pressable><Text style={screen.openText}>Vezi detalii →</Text></View>
    </>}
  </Pressable>;
}

function AvailableSoonBadge({ vehicle }: { vehicle: Vehicle }) {
  const distance = vehicle.availableSoonRoadDistanceMeters === null
    ? null : Math.round(vehicle.availableSoonRoadDistanceMeters / 1000);
  return <View style={screen.availableSoonBadge}><Ionicons name="warning" size={13} color="#1f1600" /><Text style={screen.availableSoonText}>Disponibilă în curând{distance === null ? '' : ` · ${distance} km`}</Text></View>;
}

function MobileDatum({ icon, value, warning }: { icon: keyof typeof Ionicons.glyphMap; value: string; warning?: boolean }) {
  return <View style={screen.mobileDatum}><Ionicons name={icon} size={16} color={warning ? colors.yellow : colors.muted} /><Text numberOfLines={2} style={[screen.mobileDatumText, warning && { color: colors.yellow }]}>{value}</Text></View>;
}

const screen = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 30 }, header: { gap: 15, marginBottom: 4 },
  syncLine: { minHeight: 54, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, syncLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }, syncValue: { color: colors.text, fontWeight: '800', marginTop: 2 }, liveDot: { width: 10, height: 10, borderRadius: 5 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  messageSummary: { minHeight: 72, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#264d80', backgroundColor: '#10233d', flexDirection: 'row', alignItems: 'center', gap: 12 }, messageIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#1d416f', alignItems: 'center', justifyContent: 'center' }, messageTitle: { color: colors.text, fontWeight: '900' }, messageText: { color: colors.muted, fontSize: 12, marginTop: 3 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, filterButton: { minHeight: 48, borderRadius: 11, borderColor: colors.border, borderWidth: 1, backgroundColor: colors.panel, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14 }, filterButtonActive: { borderColor: colors.accent, backgroundColor: '#16345b' }, filterButtonText: { color: colors.text, fontWeight: '800', fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, advancedFilters: { padding: 14, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 14, gap: 15 }, filterGroup: { gap: 7 }, filterLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }, reset: { color: '#93c5fd', fontWeight: '800', fontSize: 13 },
  listHeading: { marginTop: 4, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '900' }, sectionSubtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 5 }, vehicle: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 5, borderRadius: 13, padding: 14, gap: 12 }, vehicleDesktop: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 0, borderRadius: 9, paddingVertical: 10 },
  colPlate: { flex: 1.15, minWidth: 0, paddingRight: 8, color: colors.muted, fontSize: 11, fontWeight: '800' }, colDriver: { flex: 1, minWidth: 0, paddingRight: 8, color: colors.text, fontSize: 13 }, colStatus: { flex: 1.25, minWidth: 0, paddingRight: 8, color: colors.muted, fontSize: 11, fontWeight: '800' }, colTacho: { flex: .7, minWidth: 0, paddingRight: 8, color: colors.text, fontSize: 13 }, colLocation: { flex: 1.35, minWidth: 0, paddingRight: 8, color: colors.text, fontSize: 13 }, colDestination: { flex: 1.3, minWidth: 0, paddingRight: 8, color: colors.text, fontSize: 13 }, colUpdated: { flex: .72, minWidth: 0, paddingRight: 8, color: colors.muted, fontSize: 11, fontWeight: '800' }, colAction: { width: 42, alignItems: 'flex-end' },
  plateLine: { flexDirection: 'row', alignItems: 'center', gap: 7 }, plate: { color: colors.text, fontWeight: '900', fontSize: 16 }, mini: { color: colors.muted, fontSize: 11, marginTop: 3 }, age: { color: colors.muted, fontWeight: '800', fontSize: 12 }, rowAction: { width: 38, height: 38, borderRadius: 9, backgroundColor: colors.panel2, alignItems: 'center', justifyContent: 'center' },
  statusStack: { alignItems: 'flex-start', gap: 5 }, availableSoonBadge: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.yellow }, availableSoonText: { color: '#1f1600', fontWeight: '900', fontSize: 10 },
  mobileTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 10 }, mobileGrid: { gap: 7 }, mobileDatum: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, mobileDatumText: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 13, lineHeight: 18 }, mobileActions: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, quickAction: { minHeight: 40, borderRadius: 9, backgroundColor: colors.panel2, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7 }, quickActionText: { color: colors.text, fontWeight: '800', fontSize: 12 }, openText: { color: '#93c5fd', fontWeight: '800', fontSize: 12 }
});
