import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppShell } from '@/components/app-shell';
import { Button, colors, Message, Section, styles as ui } from '@/components/ui';
import { api } from '@/lib/api';
import { bucharestDate } from '@/lib/format';
import { AvailabilityMessageResponse } from '@/types/vehicle';

export default function AvailabilityScreen() {
  const [data, setData] = useState<AvailabilityMessageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.availabilityMessage()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Mesajul nu poate fi încărcat.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return undefined; }, [load]));

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true); setCopied(false); setError(null);
    try {
      const next = await api.refreshAvailabilityMessage();
      setData(next);
      if (next.refresh?.performed && next.refresh.success === false) setError(next.refresh.error ?? 'Sincronizarea a eșuat; mesajul folosește ultimele date salvate.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Mesajul nu a putut fi actualizat.'); }
    finally { setRefreshing(false); }
  };
  const copy = async () => {
    if (!data) return;
    await Clipboard.setStringAsync(data.message); setCopied(true);
  };

  const included = data?.vehicles?.filter((item) => item.included) ?? [];
  const excluded = data?.vehicles?.filter((item) => !item.included) ?? [];
  return <AppShell active="availability" title="Mesaj disponibilitate" subtitle="Pregătit pentru grupurile WhatsApp">
    <ScrollView contentContainerStyle={[ui.content, page.content]}>
      {error && <Message error>{error}</Message>}{copied && <Message>Mesajul a fost copiat. Îl poți lipi direct în WhatsApp.</Message>}
      {loading && !data ? <ActivityIndicator size="large" color={colors.accent} /> : data && <>
        <View style={page.summary}>
          <Summary icon="checkmark-circle" color={colors.success} value={data.includedVehicles} label="vehicule incluse" />
          <Summary icon="alert-circle" color={excluded.length ? colors.yellow : colors.muted} value={data.incompleteVehicles} label="vehicule excluse" />
          <View style={page.generated}><Text style={page.metaLabel}>Generat</Text><Text style={page.metaValue}>{bucharestDate(data.generatedAt)}</Text></View>
        </View>
        <Section title="Mesaj pentru WhatsApp">
          <Text style={ui.subtitle}>Locația folosită este destinația identificată; dacă aceasta lipsește sau nu este validă, folosim locația curentă.</Text>
          <View style={page.preview}><Text selectable style={page.message}>{data.message}</Text></View>
          <View style={ui.actions}><Button title={copied ? 'Copiat' : 'Copiază pentru WhatsApp'} onPress={() => void copy()} /><Button secondary title="Actualizează datele și mesajul" onPress={() => void refresh()} disabled={refreshing} /></View>
        </Section>
        <Section title={`Vehicule incluse (${included.length})`}>
          {included.length ? included.map((item) => <View key={item.id} style={page.vehicleLine}>
            <View style={[page.lineIcon, { backgroundColor: '#123b30' }]}><Ionicons name="checkmark" size={18} color={colors.success} /></View>
            <View style={{ flex: 1, minWidth: 0 }}><Text style={page.vehiclePlate}>{item.registrationNumber}</Text><Text style={page.vehicleMeta}>{item.vehicleModel ?? 'Model nespecificat'} · {item.location ?? 'Locație nespecificată'}</Text><Text style={page.source}>{item.locationSource === 'destination' ? 'Folosește destinația' : 'Folosește locația curentă'}</Text></View>
            <Button secondary title="Vezi" onPress={() => router.push(`/vehicles/${item.id}`)} />
          </View>) : <Text style={ui.subtitle}>Nu există vehicule disponibile care pot fi incluse.</Text>}
        </Section>
        {excluded.length > 0 && <Section title={`Vehicule excluse (${excluded.length})`}>
          <Text style={ui.subtitle}>Aceste vehicule sunt disponibile, dar nu au suficiente date pentru mesaj.</Text>
          {excluded.map((item) => <View key={item.id} style={page.vehicleLine}>
            <View style={[page.lineIcon, { backgroundColor: '#473614' }]}><Ionicons name="warning" size={18} color={colors.yellow} /></View>
            <View style={{ flex: 1, minWidth: 0 }}><Text style={page.vehiclePlate}>{item.registrationNumber}</Text><Text style={page.vehicleMeta}>{item.reason}</Text></View>
            <Button secondary title="Rezolvă" onPress={() => router.push(`/vehicles/${item.id}?section=${item.vehicleModel ? 'diagnostics' : 'profile'}`)} />
          </View>)}
        </Section>}
      </>}
    </ScrollView>
  </AppShell>;
}

function Summary({ icon, color, value, label }: { icon: keyof typeof Ionicons.glyphMap; color: string; value: number; label: string }) {
  return <View style={page.summaryItem}><Ionicons name={icon} size={22} color={color} /><View><Text style={page.summaryValue}>{value}</Text><Text style={page.summaryLabel}>{label}</Text></View></View>;
}

const page = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 34 }, summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, summaryItem: { minWidth: 160, flex: 1, padding: 14, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, flexDirection: 'row', alignItems: 'center', gap: 11 }, summaryValue: { color: colors.text, fontSize: 20, fontWeight: '900' }, summaryLabel: { color: colors.muted, fontSize: 11, marginTop: 1 }, generated: { minWidth: 220, flex: 1, padding: 14, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, justifyContent: 'center' }, metaLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }, metaValue: { color: colors.text, fontWeight: '800', marginTop: 4 },
  preview: { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16 }, message: { color: colors.text, fontSize: 15, lineHeight: 23 },
  vehicleLine: { minHeight: 66, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 11, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 10 }, lineIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, vehiclePlate: { color: colors.text, fontWeight: '900' }, vehicleMeta: { color: colors.muted, fontSize: 12, marginTop: 2 }, source: { color: '#93c5fd', fontSize: 11, fontWeight: '700', marginTop: 3 }
});
