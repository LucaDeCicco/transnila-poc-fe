import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { AppShell } from '@/components/app-shell';
import { Button, colors, Message, styles as ui } from '@/components/ui';
import { api } from '@/lib/api';
import { OfferIntegrationStatus, OfferProcessingIssue, OfferStatus, OfferSyncProgress, OffersResponse, TransportOffer } from '@/types/vehicle';

const filters: { value: OfferStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Toate' }, { value: 'NEW', label: 'Oferte' },
  { value: 'NEEDS_REVIEW', label: 'Necesită verificare' }, { value: 'CONVERTED', label: 'Cursă creată' }
];

const MAX_SYNC_BATCHES = 100;
const MAX_SYNC_SESSION_MS = 10 * 60_000;
const MAX_STALLED_BATCHES = 2;

export default function FindWorkScreen() {
  const router = useRouter(); const { width } = useWindowDimensions(); const wide = width >= 780;
  const [offers, setOffers] = useState<TransportOffer[]>([]); const [filter, setFilter] = useState<OfferStatus | 'ALL'>('NEW');
  const [query, setQuery] = useState(''); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<OfferSyncProgress | null>(null);
  const [integration, setIntegration] = useState<OfferIntegrationStatus | null>(null);
  const [processingIssues, setProcessingIssues] = useState<OfferProcessingIssue[]>([]);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const syncRunning = useRef(false); const syncGeneration = useRef(0);
  const load = useCallback(async (): Promise<OffersResponse | null> => {
    try {
      const result = await api.offers();
      setOffers(result.offers); setLastSyncAt(result.lastSyncAt); setSyncProgress(result.sync || null);
      setIntegration(result.integration); setProcessingIssues(result.processingIssues || []); setError(result.sync?.error || null);
      return result;
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Ofertele nu au putut fi încărcate.'); }
    finally { setLoading(false); }
    return null;
  }, []);
  const drain = useCallback(async () => {
    if (syncRunning.current) return;
    syncRunning.current = true;
    const generation = ++syncGeneration.current;
    const startedAt = Date.now();
    let batches = 0; let stalled = 0; let previousSignature = '';
    setRefreshing(true); setError(null); setSyncNotice(null);
    try {
      while (generation === syncGeneration.current && batches < MAX_SYNC_BATCHES && Date.now() - startedAt < MAX_SYNC_SESSION_MS) {
        const result = await api.refreshOffers();
        if (generation !== syncGeneration.current) break;
        batches += 1; setSyncProgress(result); if (result.integration) setIntegration(result.integration);
        if (result.integration && !result.integration.gmailConfigured) break;
        if (result.integration && !result.integration.offerExtractionConfigured) break;
        if ((result.collected || 0) > 0 || (result.processed || 0) > 0 || (result.createdOffers || 0) > 0) await load();
        if (!result.hasMore) { setSyncNotice(batches > 1 ? `Inbox actualizat complet în ${batches} loturi.` : null); break; }
        const queue = result.queue;
        const signature = `${result.collectionHasMore}:${queue?.pending || 0}:${queue?.processing || 0}:${result.collected || 0}:${result.processed || 0}`;
        stalled = signature === previousSignature && !(result.collected || result.processed) ? stalled + 1 : 0;
        previousSignature = signature;
        if (stalled >= MAX_STALLED_BATCHES) {
          setSyncNotice('Procesarea nu a mai avansat. Emailurile rămân salvate în coadă și vor fi reluate la următoarea sincronizare.');
          break;
        }
        await pause(250);
      }
      if (generation === syncGeneration.current && batches >= MAX_SYNC_BATCHES) {
        setSyncNotice('A fost atinsă limita de siguranță a sesiunii. Emailurile rămase sunt salvate și poți continua procesarea.');
      } else if (generation === syncGeneration.current && Date.now() - startedAt >= MAX_SYNC_SESSION_MS) {
        setSyncNotice('Sesiunea de sincronizare a atins limita de timp. Emailurile rămase sunt salvate și poți continua procesarea.');
      }
      if (generation === syncGeneration.current) await load();
    } catch (e) {
      if (generation === syncGeneration.current) setError(e instanceof Error ? e.message : 'Gmail nu a putut fi sincronizat. Emailurile deja colectate rămân în siguranță.');
    } finally {
      if (generation === syncGeneration.current) setRefreshing(false);
      syncRunning.current = false;
    }
  }, [load]);
  useFocusEffect(useCallback(() => {
    let active = true;
    void load().then((result) => {
      const configured = result?.integration.gmailConfigured && result.integration.offerExtractionConfigured;
      if (active && configured) void drain();
    });
    return () => { active = false; syncGeneration.current += 1; syncRunning.current = false; };
  }, [drain, load]));
  const visible = useMemo(() => offers.filter((offer) => {
    if (filter !== 'ALL' && offer.status !== filter) return false;
    const text = [offer.title, offer.clientName, offer.pickupCity, offer.pickupPostcode, offer.deliveryCity, offer.deliveryPostcode, offer.senderEmail, offer.message.subject].filter(Boolean).join(' ').toLowerCase();
    return !query.trim() || text.includes(query.trim().toLowerCase());
  }), [offers, filter, query]);
  return <AppShell active="findWork" title="Găsește curse" subtitle={lastSyncAt ? `Gmail sincronizat: ${new Date(lastSyncAt).toLocaleString('ro-RO')}` : 'Oferte detectate automat din Gmail'}
    action={<Pressable onPress={() => void drain()} disabled={refreshing || !integration?.gmailConfigured || !integration?.offerExtractionConfigured} style={[page.refresh, (refreshing || !integration?.gmailConfigured || !integration?.offerExtractionConfigured) && page.refreshDisabled]}>{refreshing ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="refresh" size={19} color="#fff" />}<Text style={page.refreshText}>{refreshing ? 'Se procesează…' : wide ? 'Sincronizează Gmail' : 'Refresh'}</Text></Pressable>}>
    <ScrollView contentContainerStyle={[ui.content, page.content]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void drain()} tintColor={colors.accent} />}>
      <View style={page.intro}><View style={page.introIcon}><Ionicons name="mail-open-outline" color="#9dc7ff" size={26} /></View><View style={{ flex: 1 }}><Text style={page.introTitle}>Inbox transformat în oferte comparabile</Text><Text style={page.help}>Nicio ofertă nu creează și nu asignează automat o cursă. Verifică datele înainte de salvare.</Text></View></View>
      {integration && integration.status !== 'READY' && <IntegrationNotice integration={integration} />}
      {(refreshing || syncProgress?.hasMore) && <View style={page.progress}><ActivityIndicator color={colors.accent} size="small" /><View style={{ flex: 1 }}><Text style={page.progressTitle}>{refreshing ? 'Se colectează și se analizează emailurile…' : 'Mai sunt emailuri în coada de procesare'}</Text><Text style={page.help}>{syncDescription(syncProgress)}</Text></View>{!refreshing && <Button secondary title="Continuă" onPress={() => void drain()} />}</View>}
      {syncNotice && <View style={page.notice}><Text style={page.noticeText}>{syncNotice}</Text></View>}
      {processingIssues.length > 0 && <View style={page.issueBox}>
        <View style={page.issueHeader}><Ionicons name="warning-outline" size={21} color="#f1c64f" /><View style={{ flex: 1 }}><Text style={page.issueTitle}>{processingIssues.length} {processingIssues.length === 1 ? 'email nu a putut' : 'emailuri nu au putut'} fi analizate</Text><Text style={page.help}>Acestea nu sunt considerate automat oferte și nu apar la „Necesită verificare”.</Text></View></View>
        {processingIssues.map((issue) => <Pressable key={issue.id} onPress={() => void openEmail(issue.emailWebUrl)} style={page.issueRow}>
          <View style={{ flex: 1 }}><Text numberOfLines={1} style={page.issueSubject}>{issue.subject || 'Email fără subiect'}</Text><Text style={page.issueReason}>{issue.reason} · Vezi emailul original</Text></View><Ionicons name="open-outline" size={18} color="#9dc7ff" />
        </Pressable>)}
      </View>}
      <View style={page.search}><Ionicons name="search-outline" size={19} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Caută rută, client sau expeditor…" placeholderTextColor={colors.muted} style={page.input} /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={page.filters}>{filters.map((item) => {
        const count = item.value === 'ALL' ? offers.length : offers.filter((offer) => offer.status === item.value).length;
        return <Pressable key={item.value} onPress={() => setFilter(item.value)} style={[page.filter, filter === item.value && page.filterActive]}><Text style={[page.filterText, filter === item.value && page.filterTextActive]}>{item.label} · {count}</Text></Pressable>;
      })}</ScrollView>
      {error && <Message error>{error}</Message>}
      {loading ? <View style={page.loading}><ActivityIndicator color={colors.accent} /><Text style={page.help}>Se citesc ofertele salvate…</Text></View>
        : visible.length ? <View style={[page.grid, wide && page.gridWide]}>{visible.map((offer) => <OfferCard key={offer.id} offer={offer} wide={wide}
          onEmail={() => void openEmail(offer.emailWebUrl)} onTrip={() => router.push(`/trips/new?offerId=${offer.id}`)} onVehicle={() => offer.convertedTrip && router.push(`/vehicles/${offer.convertedTrip.vehicleId}?section=trip`)} />)}</View>
          : <View style={page.empty}><Ionicons name="file-tray-outline" size={35} color={colors.muted} /><Text style={page.emptyTitle}>Nu există oferte în această categorie</Text><Text style={page.help}>Sincronizează Gmail sau schimbă filtrul.</Text></View>}
    </ScrollView>
  </AppShell>;
}

function IntegrationNotice({ integration }: { integration: OfferIntegrationStatus }) {
  const missingGmail = integration.status === 'GMAIL_NOT_CONFIGURED';
  const missingAi = integration.status === 'AI_NOT_CONFIGURED';
  const degradedGmail = integration.status === 'DEGRADED' && integration.degradedService === 'GMAIL';
  const title = missingGmail ? 'Conectarea Gmail nu este configurată'
    : missingAi ? 'Analiza automată nu este configurată'
      : degradedGmail ? 'Conexiunea Gmail este temporar indisponibilă'
        : integration.degradedService === 'AI' ? 'Analiza automată este temporar indisponibilă'
          : 'Integrarea funcționează în mod degradat';
  const message = missingGmail
    ? 'Configurează GMAIL_USER și GMAIL_APP_PASSWORD în backend pentru a importa ofertele. Ofertele deja salvate rămân vizibile.'
    : missingAi
      ? 'Gmail este configurat, dar trebuie setată OPENAI_OFFER_EXTRACTION_API_KEY pentru analizarea emailurilor. Ofertele deja salvate rămân vizibile.'
      : degradedGmail
        ? 'Inboxul nu a putut fi sincronizat. Poți reîncerca; emailurile deja colectate și ofertele salvate rămân în siguranță.'
        : integration.degradedService === 'AI'
          ? 'Emailurile nu pot fi analizate momentan. Poți reîncerca; cele deja colectate rămân salvate în coadă.'
          : 'O componentă externă nu este disponibilă momentan. Poți reîncerca; datele deja salvate rămân în siguranță.';
  return <View style={[page.configBox, integration.status === 'DEGRADED' && page.configBoxWarning]}><Ionicons name={integration.status === 'DEGRADED' ? 'warning-outline' : 'information-circle-outline'} size={24} color={integration.status === 'DEGRADED' ? '#f1c64f' : '#9dc7ff'} /><View style={{ flex: 1 }}><Text style={page.configTitle}>{title}</Text><Text style={page.help}>{message}</Text></View></View>;
}

function OfferCard({ offer, wide, onEmail, onTrip, onVehicle }: { offer: TransportOffer; wide: boolean; onEmail: () => void; onTrip: () => void; onVehicle: () => void }) {
  const pickup = location(offer.pickupPostcode, offer.pickupCity, offer.pickupCountry);
  const delivery = location(offer.deliveryPostcode, offer.deliveryCity, offer.deliveryCountry);
  const review = offer.status === 'NEEDS_REVIEW';
  return <View style={[page.card, wide && page.cardWide, review && page.cardReview]}>
    <View style={page.cardTop}><View style={{ flex: 1 }}><Text style={page.cardTitle}>{offer.title || offer.message.subject || 'Ofertă fără titlu'}</Text><Text style={page.sender}>{offer.senderName || offer.senderEmail || 'Expeditor necunoscut'} · {new Date(offer.receivedAt).toLocaleString('ro-RO')}</Text></View><View style={[page.badge, review ? page.badgeReview : offer.status === 'CONVERTED' ? page.badgeConverted : page.badgeNew]}><Text style={page.badgeText}>{review ? 'VERIFICĂ' : offer.status === 'CONVERTED' ? 'CURSĂ CREATĂ' : 'OFERTĂ'}</Text></View></View>
    <View style={page.route}><View style={page.routePoint}><View style={[page.dot, { backgroundColor: '#3ad6a0' }]} /><View style={{ flex: 1 }}><Text style={page.routeLabel}>RIDICARE</Text><Text style={page.routeText}>{pickup || 'Nespecificată'}</Text><Text style={page.routeDate}>{dateTime(offer.pickupLocalDate, offer.pickupLocalTime)}</Text></View></View><View style={page.line} /><View style={page.routePoint}><View style={[page.dot, { backgroundColor: colors.accent }]} /><View style={{ flex: 1 }}><Text style={page.routeLabel}>LIVRARE</Text><Text style={page.routeText}>{delivery || 'Nespecificată'}</Text><Text style={page.routeDate}>{dateTime(offer.deliveryLocalDate, offer.deliveryLocalTime)}</Text></View></View></View>
    <View style={page.meta}><Text style={page.metaText}>{offer.cargoDescription || 'Marfă nespecificată'}{offer.cargoWeightKg != null ? ` · ${offer.cargoWeightKg} kg` : ''}{offer.cargoPallets != null ? ` · ${offer.cargoPallets} paleți` : ''}</Text>{offer.priceAmount != null && <Text style={page.price}>{offer.priceAmount} {offer.currency || ''}</Text>}</View>
    {review && <Text style={page.reviewReason}>{offer.message.classificationReason || 'Datele trebuie verificate manual înainte de creare.'}</Text>}
    {offer.attachment && <View style={page.attachment}><Ionicons name="attach" size={16} color={colors.muted} /><Text numberOfLines={1} style={page.attachmentText}>{offer.attachment.filename}</Text></View>}
    <View style={page.actions}><Button secondary title="Vezi emailul original" onPress={onEmail} />{offer.status === 'CONVERTED' ? <Button title="Vezi cursa" onPress={onVehicle} /> : <Button title="Creează cursă" onPress={onTrip} />}</View>
  </View>;
}

function location(postcode: string | null, city: string | null, country: string | null) { return [postcode, city, country].filter(Boolean).join(' '); }
function dateTime(date: string | null, time: string | null) { return [date, time].filter(Boolean).join(' · ') || 'Dată nespecificată'; }

const page = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 36, gap: 14 }, refresh: { minHeight: 42, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', gap: 7 }, refreshDisabled: { opacity: 0.8 }, refreshText: { color: '#fff', fontWeight: '900' },
  intro: { padding: 15, borderRadius: 14, backgroundColor: '#132a49', borderWidth: 1, borderColor: '#28568f', flexDirection: 'row', gap: 12, alignItems: 'center' }, introIcon: { width: 48, height: 48, borderRadius: 13, backgroundColor: '#1e416e', alignItems: 'center', justifyContent: 'center' }, introTitle: { color: colors.text, fontWeight: '900', fontSize: 17 }, help: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  search: { minHeight: 48, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, flexDirection: 'row', alignItems: 'center', gap: 9 }, input: { flex: 1, minWidth: 0, color: colors.text, paddingVertical: 10 }, filters: { gap: 8 }, filter: { minHeight: 39, paddingHorizontal: 13, borderRadius: 20, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', backgroundColor: colors.panel }, filterActive: { backgroundColor: '#204b80', borderColor: colors.accent }, filterText: { color: colors.muted, fontWeight: '800', fontSize: 12 }, filterTextActive: { color: '#fff' },
  grid: { gap: 12 }, gridWide: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' }, card: { padding: 16, gap: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel }, cardWide: { width: '48.8%', flexGrow: 1, maxWidth: '100%' }, cardReview: { borderColor: '#8b6817' }, cardTop: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' }, cardTitle: { color: colors.text, fontWeight: '900', fontSize: 17 }, sender: { color: colors.muted, fontSize: 11, marginTop: 4 }, badge: { borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5 }, badgeNew: { backgroundColor: '#126449' }, badgeReview: { backgroundColor: '#7a5607' }, badgeConverted: { backgroundColor: '#284b76' }, badgeText: { color: '#fff', fontWeight: '900', fontSize: 9 },
  route: { padding: 12, borderRadius: 11, backgroundColor: colors.bg }, routePoint: { flexDirection: 'row', gap: 10 }, dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 }, line: { width: 2, height: 20, backgroundColor: colors.border, marginLeft: 4, marginVertical: 3 }, routeLabel: { color: colors.muted, fontWeight: '900', fontSize: 9 }, routeText: { color: colors.text, fontWeight: '800', marginTop: 2 }, routeDate: { color: colors.muted, fontSize: 11, marginTop: 2 },
  meta: { flexDirection: 'row', gap: 10, justifyContent: 'space-between' }, metaText: { flex: 1, color: colors.muted, fontSize: 12 }, price: { color: colors.text, fontWeight: '900' }, reviewReason: { color: '#f1c64f', fontSize: 12, lineHeight: 17 }, attachment: { flexDirection: 'row', gap: 6, alignItems: 'center' }, attachmentText: { color: colors.muted, fontSize: 11, flex: 1 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  progress: { padding: 13, borderRadius: 12, borderWidth: 1, borderColor: '#28568f', backgroundColor: '#10233c', flexDirection: 'row', alignItems: 'center', gap: 11 }, progressTitle: { color: colors.text, fontWeight: '900', fontSize: 13 }, notice: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#765d20', backgroundColor: '#332b16' }, noticeText: { color: '#f1c64f', fontSize: 12, lineHeight: 18 },
  configBox: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#28568f', backgroundColor: '#10233c', flexDirection: 'row', gap: 11, alignItems: 'flex-start' }, configBoxWarning: { borderColor: '#765d20', backgroundColor: '#332b16' }, configTitle: { color: colors.text, fontWeight: '900', fontSize: 14, marginBottom: 3 },
  issueBox: { padding: 14, gap: 10, borderRadius: 12, borderWidth: 1, borderColor: '#765d20', backgroundColor: '#211d14' }, issueHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, issueTitle: { color: colors.text, fontWeight: '900', fontSize: 14 }, issueRow: { minHeight: 48, padding: 10, borderRadius: 9, borderWidth: 1, borderColor: '#56471f', backgroundColor: '#2b2517', flexDirection: 'row', alignItems: 'center', gap: 8 }, issueSubject: { color: colors.text, fontWeight: '800', fontSize: 12 }, issueReason: { color: '#d6b957', fontSize: 10, marginTop: 3 },
  loading: { padding: 36, alignItems: 'center', gap: 10 }, empty: { padding: 42, alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel }, emptyTitle: { color: colors.text, fontWeight: '900', fontSize: 16 }
});

function syncDescription(progress: OfferSyncProgress | null) {
  const pending = progress?.queue?.pending ?? progress?.pending ?? 0;
  const processing = progress?.queue?.processing ?? progress?.processing ?? 0;
  const parts = [`${pending} în așteptare`, `${processing} în procesare`];
  if (progress?.collectionHasMore) parts.push('mai sunt emailuri de colectat');
  return parts.join(' · ');
}

function pause(milliseconds: number) { return new Promise<void>((resolve) => setTimeout(resolve, milliseconds)); }

async function openEmail(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  await Linking.openURL(url);
}
