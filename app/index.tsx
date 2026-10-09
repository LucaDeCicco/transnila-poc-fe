import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { availability, unspecified } from '@/lib/format';
import { AvailabilityMessageResponse, Vehicle } from '@/types/vehicle';
import { Button, colors, Message, styles as ui } from '@/components/ui';
import { AvailabilityMessageCard } from '@/components/availability-message-card';

export default function FleetScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState<AvailabilityMessageResponse | null>(null);
  const [messageLoading, setMessageLoading] = useState(true);
  const [messageRefreshing, setMessageRefreshing] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const activeRequest = useRef(false);
  const router = useRouter();
  const desktop = useWindowDimensions().width >= 760;

  const enter = useCallback(async () => {
    if (activeRequest.current) return;
    activeRequest.current = true; setLoading(true); setError(null);
    try {
      const saved = await api.list(); setVehicles(saved); setLoading(false);
      try {
        setAvailabilityMessage(await api.availabilityMessage()); setMessageError(null);
      } catch (e) {
        setMessageError(e instanceof Error ? e.message : 'Mesajul nu poate fi încărcat.');
      } finally { setMessageLoading(false); }
      const response = await api.autoFleet();
      if (response.performed && response.success === false) setError(response.error ?? 'Sincronizarea flotei a eșuat.');
      const [nextVehicles, nextMessage] = await Promise.all([api.list(), api.availabilityMessage()]);
      setVehicles(nextVehicles); setAvailabilityMessage(nextMessage); setMessageError(null);
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
      const [nextVehicles, nextMessage] = await Promise.all([api.list(), api.availabilityMessage()]);
      setVehicles(nextVehicles); setAvailabilityMessage(nextMessage); setMessageError(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Actualizarea a eșuat.'); }
    finally { setRefreshing(false); }
  };

  const refreshMessage = async () => {
    if (messageRefreshing) return;
    setMessageRefreshing(true); setMessageError(null);
    try {
      const response = await api.refreshAvailabilityMessage();
      setAvailabilityMessage(response);
      setVehicles(await api.list());
      if (response.refresh?.performed && response.refresh.success === false) {
        setMessageError(response.refresh.error ?? 'Sincronizarea flotei a eșuat; mesajul folosește ultimele date salvate.');
      }
    } catch (e) {
      setMessageError(e instanceof Error ? e.message : 'Mesajul nu a putut fi actualizat.');
    } finally { setMessageRefreshing(false); }
  };

  return <View style={ui.screen}><FlatList
    data={vehicles} keyExtractor={(item) => item.id} contentContainerStyle={[ui.content, vehicles.length === 0 && { flexGrow: 1 }]}
    ListHeaderComponent={<View style={list.header}>
      <View style={{ flex: 1 }}><Text style={ui.title}>Transnila-POC</Text><Text style={ui.subtitle}>Flota activă sincronizată cu Wialon</Text></View>
      <Button title="Actualizează flota" onPress={manual} disabled={refreshing} />
      {error && <View style={{ width: '100%' }}><Message error>{error}</Message></View>}
      {result && <View style={{ width: '100%' }}><Message>{result}</Message></View>}
      <View style={{ width: '100%' }}><AvailabilityMessageCard
        data={availabilityMessage} loading={messageLoading} refreshing={messageRefreshing}
        error={messageError} onRefresh={() => void refreshMessage()}
      /></View>
      {desktop && vehicles.length > 0 && <View style={list.tableHeader}><Text style={list.colPlate}>Număr</Text><Text style={list.col}>Șofer</Text><Text style={list.col}>Disponibilitate</Text><Text style={list.col}>Locație</Text><Text style={list.col}>Destinație</Text></View>}
    </View>}
    renderItem={({ item }) => <Pressable onPress={() => router.push(`/vehicles/${item.id}`)} style={({ pressed }) => [list.card, desktop && list.desktopRow, pressed && { opacity: .7 }]}>
      <View style={list.colPlate}><Text style={list.plate}>{item.registrationNumber}</Text>{item.hasWarning && <Text accessibilityLabel="Avertizare actualizare" style={list.warning}>!</Text>}</View>
      {desktop ? <><Text style={list.col}>{unspecified(item.driverName)}</Text><Text style={list.col}>{availability(item.availability)}</Text><Text style={list.col}>{[item.country, item.city].filter(Boolean).join(', ') || 'Nespecificat'}</Text><Text style={list.col}>{unspecified(item.destination)}</Text></> :
      <View style={{ gap: 5 }}><Text style={list.primary}>{unspecified(item.driverName)} · {availability(item.availability)}</Text><Text style={list.secondary}>{[item.country, item.city].filter(Boolean).join(', ') || 'Nespecificat'}</Text><Text style={list.secondary}>Destinație: {unspecified(item.destination)}</Text></View>}
    </Pressable>}
    ListEmptyComponent={loading ? <ActivityIndicator size="large" color={colors.accent} /> : <View style={list.empty}><Text style={ui.title}>Nu există mașini disponibile</Text><Text style={ui.subtitle}>{error ? 'Verifică backendul și încearcă din nou.' : 'Contul Wialon nu a furnizat încă date.'}</Text><Button title="Reîncearcă" onPress={() => void enter()} /></View>}
  /></View>;
}

const list = StyleSheet.create({
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 6 },
  card: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
  desktopRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 6, paddingVertical: 10 }, tableHeader: { width: '100%', flexDirection: 'row', paddingHorizontal: 14, marginTop: 10 },
  colPlate: { flex: 1.1, flexDirection: 'row', gap: 8, alignItems: 'center' }, col: { flex: 1.4, color: colors.text, paddingRight: 8 },
  plate: { color: colors.text, fontWeight: '900', fontSize: 18 }, warning: { color: colors.yellow, fontWeight: '900', fontSize: 22 },
  primary: { color: colors.text, fontSize: 15 }, secondary: { color: colors.muted }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }
});
