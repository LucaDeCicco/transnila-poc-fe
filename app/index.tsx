import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { availability, bucharestDate, unspecified } from '@/lib/format';
import { Availability, AvailabilityMessageResponse, Vehicle } from '@/types/vehicle';
import { Button, colors, Message, styles as ui } from '@/components/ui';
import { AvailabilityMessageCard } from '@/components/availability-message-card';

export default function FleetScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState<AvailabilityMessageResponse | null>(null);
  const [messageLoading, setMessageLoading] = useState(true);
  const [messageRefreshing, setMessageRefreshing] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [lastFleetSuccessAt, setLastFleetSuccessAt] = useState<string | null>(null);
  const activeRequest = useRef(false);
  const router = useRouter();
  const desktop = useWindowDimensions().width >= 1000;
  const normalizedSearch = normalizeRegistrationNumber(search);
  const filteredVehicles = normalizedSearch
    ? vehicles.filter((vehicle) => normalizeRegistrationNumber(vehicle.registrationNumber).includes(normalizedSearch))
    : vehicles;

  const enter = useCallback(async () => {
    if (activeRequest.current) return;
    activeRequest.current = true; setLoading(true); setError(null);
    try {
      const [saved, status] = await Promise.all([api.list(), api.fleetRefreshStatus()]);
      setVehicles(saved); setLastFleetSuccessAt(status.lastSuccessAt); setLoading(false);
      try {
        setAvailabilityMessage(await api.availabilityMessage()); setMessageError(null);
      } catch (e) {
        setMessageError(e instanceof Error ? e.message : 'Mesajul nu poate fi încărcat.');
      } finally { setMessageLoading(false); }
      const response = await api.autoFleet();
      if (response.performed && response.success === false) setError(response.error ?? 'Sincronizarea flotei a eșuat.');
      const [nextVehicles, nextMessage, nextStatus] = await Promise.all([api.list(), api.availabilityMessage(), api.fleetRefreshStatus()]);
      setVehicles(nextVehicles); setAvailabilityMessage(nextMessage); setLastFleetSuccessAt(nextStatus.lastSuccessAt); setMessageError(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Datele nu pot fi încărcate.'); }
    finally { setLoading(false); setMessageLoading(false); activeRequest.current = false; }
  }, []);
  useFocusEffect(useCallback(() => { void enter(); return undefined; }, [enter]));

  const manual = async () => {
    if (refreshing) return; setRefreshing(true); setResult(null); setError(null);
    try {
      const response = await api.manualFleet();
      if (!response.performed) setResult(response.nextAllowedAt ? `Actualizarea este disponibilă după ${new Date(response.nextAllowedAt).toLocaleString('ro-RO')}.` : 'Nicio mașină nu este eligibilă acum.');
      else if (!response.success) setError(response.error ?? 'Actualizarea flotei a eșuat.');
      else setResult(`Flotă actualizată: ${response.updated ?? 0}; omise: ${response.skipped?.length ?? 0}; erori: ${response.failed?.length ?? 0}.`);
      const [nextVehicles, nextMessage, nextStatus] = await Promise.all([api.list(), api.availabilityMessage(), api.fleetRefreshStatus()]);
      setVehicles(nextVehicles); setAvailabilityMessage(nextMessage); setLastFleetSuccessAt(nextStatus.lastSuccessAt); setMessageError(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Actualizarea a eșuat.'); }
    finally { setRefreshing(false); }
  };

  const refreshMessage = async () => {
    if (messageRefreshing) return;
    setMessageRefreshing(true); setMessageError(null);
    try {
      const response = await api.refreshAvailabilityMessage();
      setAvailabilityMessage(response);
      const [nextVehicles, nextStatus] = await Promise.all([api.list(), api.fleetRefreshStatus()]);
      setVehicles(nextVehicles); setLastFleetSuccessAt(nextStatus.lastSuccessAt);
      if (response.refresh?.performed && response.refresh.success === false) {
        setMessageError(response.refresh.error ?? 'Sincronizarea flotei a eșuat; mesajul folosește ultimele date salvate.');
      }
    } catch (e) {
      setMessageError(e instanceof Error ? e.message : 'Mesajul nu a putut fi actualizat.');
    } finally { setMessageRefreshing(false); }
  };

  return <View style={ui.screen}><FlatList
    data={filteredVehicles} keyExtractor={(item) => item.id} contentContainerStyle={[ui.content, filteredVehicles.length === 0 && { flexGrow: 1 }]}
    ListHeaderComponent={<View style={list.header}>
      <View style={{ flex: 1 }}><Text style={ui.title}>Transnila-POC</Text><Text style={ui.subtitle}>Flota activă sincronizată cu Wialon</Text></View>
      <View style={list.lastUpdate}><Text style={list.lastUpdateLabel}>Ultima actualizare locații</Text><Text style={list.lastUpdateValue}>{bucharestDate(lastFleetSuccessAt)}</Text></View>
      <Button title="Actualizează flota" onPress={manual} disabled={refreshing} />
      {error && <View style={{ width: '100%' }}><Message error>{error}</Message></View>}
      {result && <View style={{ width: '100%' }}><Message>{result}</Message></View>}
      <View style={{ width: '100%' }}><AvailabilityMessageCard
        data={availabilityMessage} loading={messageLoading} refreshing={messageRefreshing}
        error={messageError} onRefresh={() => void refreshMessage()}
      /></View>
      <View style={list.searchContainer}>
        <TextInput
          accessibilityLabel="Caută după numărul de înmatriculare"
          autoCapitalize="characters"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={setSearch}
          placeholder="Caută după numărul de înmatriculare..."
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          style={list.searchInput}
          value={search}
        />
        {search.length > 0 && <Pressable accessibilityLabel="Șterge căutarea" hitSlop={10} onPress={() => setSearch('')} style={({ pressed }) => [list.clearSearch, pressed && { opacity: .65 }]}>
          <Text style={list.clearSearchText}>×</Text>
        </Pressable>}
      </View>
      {desktop && filteredVehicles.length > 0 && <View style={list.tableHeader}><Text style={list.colPlate}>Număr</Text><Text style={list.col}>Șofer</Text><Text style={list.colTachograph}>Tahograf</Text><Text style={list.col}>Disponibilitate</Text><Text style={list.col}>Locație</Text><Text style={list.col}>Destinație</Text></View>}
    </View>}
    renderItem={({ item }) => <Pressable onPress={() => router.push(`/vehicles/${item.id}`)} style={({ pressed }) => [list.card, { borderLeftColor: statusTone(item.availability).accent, backgroundColor: statusTone(item.availability).surface }, desktop && list.desktopRow, pressed && { opacity: .7 }]}>
      <View style={list.colPlate}><Text style={list.plate}>{item.registrationNumber}</Text>{item.hasWarning && <Text accessibilityLabel="Avertizare actualizare" style={list.warning}>!</Text>}</View>
      {desktop ? <><Text style={list.col}>{unspecified(item.driverName)}</Text><Text style={list.colTachograph}>{tachograph(item.hasTachograph)}</Text><View style={list.col}><StatusBadge value={item.availability} /></View><Text style={list.col}>{[item.country, item.city].filter(Boolean).join(', ') || 'Nespecificat'}</Text><Text style={list.col}>{unspecified(item.destination)}</Text></> :
      <View style={{ gap: 7 }}><View style={list.mobileSummary}><Text style={list.primary}>{unspecified(item.driverName)}</Text><StatusBadge value={item.availability} /></View><Text style={list.secondary}>Tahograf: {tachograph(item.hasTachograph)}</Text><Text style={list.secondary}>{[item.country, item.city].filter(Boolean).join(', ') || 'Nespecificat'}</Text><Text style={list.secondary}>Destinație: {unspecified(item.destination)}</Text></View>}
    </Pressable>}
    ListEmptyComponent={loading ? <ActivityIndicator size="large" color={colors.accent} /> : normalizedSearch && vehicles.length > 0
      ? <View style={list.empty}><Text style={ui.title}>Niciun rezultat</Text><Text style={ui.subtitle}>Nu am găsit niciun număr de înmatriculare pentru „{search.trim()}”.</Text><Button title="Șterge căutarea" onPress={() => setSearch('')} /></View>
      : <View style={list.empty}><Text style={ui.title}>Nu există mașini disponibile</Text><Text style={ui.subtitle}>{error ? 'Verifică backendul și încearcă din nou.' : 'Contul Wialon nu a furnizat încă date.'}</Text><Button title="Reîncearcă" onPress={() => void enter()} /></View>}
  /></View>;
}

function normalizeRegistrationNumber(value: string | null | undefined) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

const statusColors: Record<Availability, { accent: string; surface: string; badge: string }> = {
  AVAILABLE: { accent: '#34d399', surface: '#10251f', badge: '#145c46' },
  HEADING_TO_PICKUP: { accent: '#f59e0b', surface: '#282014', badge: '#714a0b' },
  ON_TRIP: { accent: '#60a5fa', surface: '#122238', badge: '#1e4f87' }
};
const unspecifiedStatus = { accent: colors.muted, surface: colors.panel, badge: colors.panel2 };
const statusTone = (value: Availability | null) => value ? statusColors[value] : unspecifiedStatus;
const tachograph = (value: boolean | null) => value === null ? 'Nespecificat' : value ? 'Da' : 'Nu';

function StatusBadge({ value }: { value: Availability | null }) {
  const tone = statusTone(value);
  return <View style={[list.statusBadge, { backgroundColor: tone.badge }]}><View style={[list.statusDot, { backgroundColor: tone.accent }]} /><Text style={list.statusText}>{availability(value)}</Text></View>;
}

const list = StyleSheet.create({
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 6 },
  lastUpdate: { alignItems: 'flex-end', minWidth: 190 },
  lastUpdateLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  lastUpdateValue: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 2 },
  searchContainer: { width: '100%', position: 'relative', justifyContent: 'center', marginTop: 2 },
  searchInput: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.panel, color: colors.text, fontSize: 16, paddingHorizontal: 14, paddingRight: 48 },
  clearSearch: { position: 'absolute', right: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  clearSearchText: { color: colors.muted, fontSize: 28, lineHeight: 30 },
  card: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderLeftWidth: 5, borderRadius: 12, padding: 14, gap: 8 },
  desktopRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 6, paddingVertical: 10 }, tableHeader: { width: '100%', flexDirection: 'row', paddingHorizontal: 14, marginTop: 10 },
  colPlate: { flex: 1.1, flexDirection: 'row', gap: 8, alignItems: 'center' }, col: { flex: 1.25, color: colors.text, paddingRight: 8 }, colTachograph: { flex: 1.35, color: colors.text, paddingRight: 8 },
  plate: { color: colors.text, fontWeight: '900', fontSize: 18 }, warning: { color: colors.yellow, fontWeight: '900', fontSize: 22 },
  primary: { color: colors.text, fontSize: 15 }, secondary: { color: colors.muted },
  mobileSummary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statusBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 }, statusText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }
});
