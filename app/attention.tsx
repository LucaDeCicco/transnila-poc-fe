import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppShell } from '@/components/app-shell';
import { EmptyState, FilterChip, SearchField } from '@/components/fleet-ui';
import { colors, Message, styles as ui } from '@/components/ui';
import { api } from '@/lib/api';
import { normalizeRegistration, vehicleIssues } from '@/lib/vehicle';
import { MapConfig, Vehicle } from '@/types/vehicle';

type ViewFilter = 'attention' | 'incomplete' | 'all';

export default function AttentionScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [config, setConfig] = useState<MapConfig | null>(null);
  const [filter, setFilter] = useState<ViewFilter>('attention');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const [list, mapConfig] = await Promise.all([api.list(), api.mapConfig()]); setVehicles(list); setConfig(mapConfig); }
    catch (e) { setError(e instanceof Error ? e.message : 'Problemele flotei nu pot fi încărcate.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return undefined; }, [load]));

  const rows = useMemo(() => vehicles.flatMap((vehicle) => vehicleIssues(vehicle, config?.stalePositionMinutes ?? 15).map((issue) => ({ vehicle, issue }))).filter(({ vehicle, issue }) => {
    if (search && !normalizeRegistration(vehicle.registrationNumber).includes(normalizeRegistration(search))) return false;
    return filter === 'all' || issue.severity === filter;
  }), [config?.stalePositionMinutes, filter, search, vehicles]);
  const counts = useMemo(() => vehicles.flatMap((vehicle) => vehicleIssues(vehicle, config?.stalePositionMinutes ?? 15)).reduce((result, issue) => ({ ...result, [issue.severity]: result[issue.severity] + 1 }), { attention: 0, incomplete: 0 }), [config?.stalePositionMinutes, vehicles]);

  return <AppShell active="attention" title="Necesită atenție" subtitle="Probleme operaționale și date incomplete">
    <ScrollView contentContainerStyle={[ui.content, page.content]}>
      {error && <Message error>{error}</Message>}
      <View style={page.explanation}><Ionicons name="information-circle-outline" size={23} color="#93c5fd" /><Text style={page.explanationText}>Aici sunt probleme de date sau sincronizare, nu defecțiuni mecanice ale vehiculelor.</Text></View>
      <SearchField value={search} onChange={setSearch} />
      <View style={page.filters}><FilterChip label="Necesită atenție" count={counts.attention} active={filter === 'attention'} onPress={() => setFilter('attention')} /><FilterChip label="Date incomplete" count={counts.incomplete} active={filter === 'incomplete'} onPress={() => setFilter('incomplete')} /><FilterChip label="Toate" count={counts.attention + counts.incomplete} active={filter === 'all'} onPress={() => setFilter('all')} /></View>
      {loading ? <ActivityIndicator size="large" color={colors.accent} /> : rows.length ? <View style={page.list}>{rows.map(({ vehicle, issue }) => <Pressable key={`${vehicle.id}-${issue.key}`} onPress={() => router.push(`/vehicles/${vehicle.id}?section=${issue.section}`)} style={({ pressed }) => [page.issue, pressed && { opacity: .7 }]}>
        <View style={[page.icon, { backgroundColor: issue.severity === 'attention' ? '#4a1d29' : '#473614' }]}><Ionicons name={issue.severity === 'attention' ? 'warning' : 'information-circle'} size={20} color={issue.severity === 'attention' ? colors.danger : colors.yellow} /></View>
        <View style={page.issueBody}><View style={page.issueHeader}><Text style={page.plate}>{vehicle.registrationNumber}</Text><Text style={[page.kind, { color: issue.severity === 'attention' ? colors.danger : colors.yellow }]}>{issue.severity === 'attention' ? 'ATENȚIE' : 'DATE INCOMPLETE'}</Text></View><Text style={page.issueTitle}>{issue.title}</Text><Text style={page.issueDetail}>{issue.detail}</Text></View>
        <View style={page.resolve}><Text style={page.resolveText}>Rezolvă</Text><Ionicons name="chevron-forward" size={18} color="#93c5fd" /></View>
      </Pressable>)}</View> : <EmptyState icon="checkmark-circle-outline" title="Totul este în regulă" detail={filter === 'attention' ? 'Nu există probleme operaționale active.' : 'Nu există informații lipsă în filtrul selectat.'} />}
    </ScrollView>
  </AppShell>;
}

const page = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 34 }, explanation: { borderRadius: 12, padding: 13, backgroundColor: '#10233d', borderColor: '#264d80', borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }, explanationText: { flex: 1, minWidth: 120, color: colors.text, lineHeight: 19 }, filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, list: { gap: 8 }, issue: { minHeight: 92, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 13, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }, icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, issueBody: { flex: 1, minWidth: 120 }, issueHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, plate: { color: colors.text, fontWeight: '900' }, kind: { fontSize: 9, fontWeight: '900' }, issueTitle: { color: colors.text, fontWeight: '800', marginTop: 5 }, issueDetail: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 }, resolve: { flexDirection: 'row', alignItems: 'center', gap: 3 }, resolveText: { color: '#93c5fd', fontWeight: '800', fontSize: 12 }
});
