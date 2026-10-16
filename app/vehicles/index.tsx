import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppShell } from '@/components/app-shell';
import { EmptyState, FilterChip, SearchField, StatusBadge } from '@/components/fleet-ui';
import { colors, Message, styles as ui } from '@/components/ui';
import { api } from '@/lib/api';
import { unspecified } from '@/lib/format';
import { normalizeRegistration, tachograph, vehicleIssues } from '@/lib/vehicle';
import { MapConfig, Vehicle } from '@/types/vehicle';

type RegistryFilter = 'all' | 'active' | 'inactive' | 'incomplete' | 'errors';

export default function VehiclesScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [config, setConfig] = useState<MapConfig | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RegistryFilter>('all');
  const [model, setModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = width >= 1050;
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const [list, mapConfig] = await Promise.all([api.list(false), api.mapConfig()]); setVehicles(list); setConfig(mapConfig); }
    catch (e) { setError(e instanceof Error ? e.message : 'Registrul vehiculelor nu poate fi încărcat.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return undefined; }, [load]));
  const models = useMemo(() => [...new Set(vehicles.map((item) => item.vehicleModel).filter((value): value is string => Boolean(value)))].sort(), [vehicles]);
  const filtered = useMemo(() => vehicles.filter((vehicle) => {
    if (search && !normalizeRegistration(vehicle.registrationNumber).includes(normalizeRegistration(search))) return false;
    if (model && vehicle.vehicleModel?.toLocaleLowerCase('ro-RO') !== model.toLocaleLowerCase('ro-RO')) return false;
    const issues = vehicleIssues(vehicle, config?.stalePositionMinutes ?? 15);
    if (filter === 'active' && !vehicle.isActive) return false;
    if (filter === 'inactive' && vehicle.isActive) return false;
    if (filter === 'incomplete' && !issues.some((issue) => issue.severity === 'incomplete')) return false;
    if (filter === 'errors' && !issues.some((issue) => issue.severity === 'attention')) return false;
    return true;
  }), [config?.stalePositionMinutes, filter, model, search, vehicles]);
  const counts = { active: vehicles.filter((item) => item.isActive).length, inactive: vehicles.filter((item) => !item.isActive).length };

  return <AppShell active="vehicles" title="Vehicule" subtitle="Registrul administrativ al flotei">
    <FlatList data={filtered} keyExtractor={(item) => item.id} contentContainerStyle={[ui.content, page.content, filtered.length === 0 && { flexGrow: 1 }]}
      ListHeaderComponent={<View style={page.header}>
        {error && <Message error>{error}</Message>}
        <View style={page.toolbar}><SearchField value={search} onChange={setSearch} /><View style={page.count}><Text style={page.countValue}>{filtered.length}</Text><Text style={page.countLabel}>afișate</Text></View></View>
        <View style={page.filters}><FilterChip label="Toate" count={vehicles.length} active={filter === 'all'} onPress={() => setFilter('all')} /><FilterChip label="Active" count={counts.active} active={filter === 'active'} onPress={() => setFilter('active')} /><FilterChip label="Inactive" count={counts.inactive} active={filter === 'inactive'} onPress={() => setFilter('inactive')} /><FilterChip label="Date incomplete" active={filter === 'incomplete'} onPress={() => setFilter('incomplete')} /><FilterChip label="Cu probleme" active={filter === 'errors'} onPress={() => setFilter('errors')} /></View>
        {models.length > 0 && <View style={page.modelFilters}><Text style={page.filterLabel}>Model</Text><View style={page.filters}><FilterChip label="Toate" active={!model} onPress={() => setModel(null)} />{models.map((item) => <FilterChip key={item} label={item} active={model === item} onPress={() => setModel(model === item ? null : item)} />)}</View></View>}
        {desktop && filtered.length > 0 && <View style={page.tableHeader}><Text style={page.colPlate}>Vehicul</Text><Text style={page.col}>Model</Text><Text style={page.col}>Șofer</Text><Text style={page.colPhone}>Telefon</Text><Text style={page.colSmall}>Tahograf</Text><Text style={page.colStatus}>Status</Text><Text style={page.colSmall}>Wialon</Text><View style={page.colArrow} /></View>}
      </View>}
      renderItem={({ item }) => <RegistryRow vehicle={item} desktop={desktop} staleMinutes={config?.stalePositionMinutes ?? 15} onPress={() => router.push(`/vehicles/${item.id}`)} />}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      ListEmptyComponent={loading ? <ActivityIndicator size="large" color={colors.accent} /> : <EmptyState icon="car-outline" title="Niciun vehicul găsit" detail="Modifică filtrele sau termenul de căutare." />}
    />
  </AppShell>;
}

function RegistryRow({ vehicle, desktop, staleMinutes, onPress }: { vehicle: Vehicle; desktop: boolean; staleMinutes: number; onPress: () => void }) {
  const issues = vehicleIssues(vehicle, staleMinutes);
  const attention = issues.filter((item) => item.severity === 'attention').length;
  const incomplete = issues.filter((item) => item.severity === 'incomplete').length;
  return <Pressable onPress={onPress} style={({ pressed }) => [page.row, !vehicle.isActive && page.inactiveRow, desktop && page.desktopRow, pressed && { opacity: .7 }]}>
    {desktop ? <>
      <View style={page.colPlate}><Text style={page.plate}>{vehicle.registrationNumber}</Text><Text style={[page.activeLabel, { color: vehicle.isActive ? colors.success : colors.muted }]}>{vehicle.isActive ? 'ACTIV' : 'INACTIV'}</Text></View>
      <Text numberOfLines={2} style={page.col}>{unspecified(vehicle.vehicleModel)}</Text><Text numberOfLines={2} style={page.col}>{unspecified(vehicle.driverName)}</Text><Text numberOfLines={1} style={page.colPhone}>{vehicle.driverPhoneE164 ?? 'Nespecificat'}</Text><Text style={page.colSmall}>{tachograph(vehicle.hasTachograph)}</Text><View style={page.colStatus}><StatusBadge value={vehicle.availability} compact /></View>
      <View style={page.colSmall}>{attention ? <View style={page.problem}><Ionicons name="warning" size={15} color={colors.yellow} /><Text style={page.problemText}>{attention}</Text></View> : <Ionicons name="checkmark-circle" size={19} color={colors.success} />}{incomplete > 0 && <Text style={page.incomplete}>{incomplete} lipsă</Text>}</View><View style={page.colArrow}><Ionicons name="chevron-forward" size={20} color={colors.muted} /></View>
    </> : <>
      <View style={page.mobileTop}><View><View style={page.plateLine}><Text style={page.plate}>{vehicle.registrationNumber}</Text><Text style={[page.activePill, { backgroundColor: vehicle.isActive ? '#123b30' : colors.panel2, color: vehicle.isActive ? colors.success : colors.muted }]}>{vehicle.isActive ? 'Activ' : 'Inactiv'}</Text></View><Text style={page.meta}>{unspecified(vehicle.vehicleModel)}</Text></View><Ionicons name="chevron-forward" size={21} color={colors.muted} /></View>
      <StatusBadge value={vehicle.availability} compact />
      <View style={page.mobileGrid}><MobileLine label="Șofer" value={unspecified(vehicle.driverName)} /><MobileLine label="Telefon" value={vehicle.driverPhoneE164 ?? 'Nespecificat'} /><MobileLine label="Tahograf" value={tachograph(vehicle.hasTachograph)} /></View>
      {(attention > 0 || incomplete > 0) && <View style={page.quality}><Ionicons name={attention ? 'warning' : 'information-circle'} size={17} color={attention ? colors.yellow : '#93c5fd'} /><Text style={page.qualityText}>{attention ? `${attention} probleme necesită atenție` : `${incomplete} informații incomplete`}</Text></View>}
    </>}
  </Pressable>;
}
function MobileLine({ label, value }: { label: string; value: string }) { return <View style={page.mobileLine}><Text style={page.mobileLabel}>{label}</Text><Text style={page.mobileValue}>{value}</Text></View>; }

const page = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 34 }, header: { gap: 14, marginBottom: 2 }, toolbar: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' }, count: { minWidth: 90, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 }, countValue: { color: colors.text, fontSize: 18, fontWeight: '900' }, countLabel: { color: colors.muted, fontSize: 10 }, filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, modelFilters: { gap: 7 }, filterLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }, row: { borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 14, gap: 11 }, inactiveRow: { opacity: .68 }, desktopRow: { minHeight: 74, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 0, paddingVertical: 10 },
  colPlate: { flex: 1.05, minWidth: 0, paddingRight: 8, color: colors.muted, fontSize: 11, fontWeight: '800' }, col: { flex: 1, minWidth: 0, paddingRight: 8, color: colors.text, fontSize: 13 }, colPhone: { flex: 1.1, minWidth: 0, paddingRight: 8, color: colors.text, fontSize: 13 }, colSmall: { flex: .7, minWidth: 0, paddingRight: 8, color: colors.text, fontSize: 12 }, colStatus: { flex: 1.2, minWidth: 0, paddingRight: 8, color: colors.muted, fontSize: 11, fontWeight: '800' }, colArrow: { width: 28, alignItems: 'flex-end' },
  plate: { color: colors.text, fontSize: 16, fontWeight: '900' }, activeLabel: { fontSize: 9, fontWeight: '900', marginTop: 3 }, problem: { flexDirection: 'row', alignItems: 'center', gap: 4 }, problemText: { color: colors.yellow, fontWeight: '900' }, incomplete: { color: colors.muted, fontSize: 9, marginTop: 2 },
  mobileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, plateLine: { flexDirection: 'row', alignItems: 'center', gap: 8 }, activePill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '900' }, meta: { color: colors.muted, fontSize: 12, marginTop: 3 }, mobileGrid: { gap: 5 }, mobileLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, mobileLabel: { color: colors.muted, fontSize: 12 }, mobileValue: { color: colors.text, fontSize: 12, textAlign: 'right', flex: 1 }, quality: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9, flexDirection: 'row', alignItems: 'center', gap: 7 }, qualityText: { color: colors.muted, fontSize: 11, fontWeight: '700' }
});

