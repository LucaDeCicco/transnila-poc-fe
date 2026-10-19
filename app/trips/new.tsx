import { Ionicons } from '@expo/vector-icons';
import { upload } from '@vercel/blob/client';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppShell } from '@/components/app-shell';
import { Button, colors, Field, Message, Section, styles as ui } from '@/components/ui';
import { API_BASE, ApiError, api } from '@/lib/api';
import { pickPdf } from '@/lib/pdf-picker';
import { BlobReference, ExtractionResult, Vehicle } from '@/types/vehicle';

type Form = Record<string, string>;
const empty: Form = {
  orderNumber: '', externalReference: '', orderDate: '', clientName: '', clientVat: '', clientAddress: '', clientContactName: '', clientContactEmail: '', clientContactPhone: '',
  pickupCompany: '', pickupAddress: '', pickupCity: '', pickupPostcode: '', pickupCountry: '', pickupCountryCode: '', pickupLocalDate: '', pickupLocalTime: '', pickupTimeZone: '', pickupContactName: '', pickupContactPhone: '', pickupReference: '', pickupInstructions: '',
  deliveryCompany: '', deliveryAddress: '', deliveryCity: '', deliveryPostcode: '', deliveryCountry: '', deliveryCountryCode: '', deliveryLocalDate: '', deliveryLocalTime: '', deliveryTimeZone: '', deliveryContactName: '', deliveryContactPhone: '', deliveryReference: '', deliveryInstructions: '',
  cargoDescription: '', cargoQuantity: '', cargoPackageType: '', cargoDimensions: '', cargoWeightKg: '', cargoVolumeM3: '', cargoLoadingMeters: '', cargoPallets: '', cargoParcels: '', cargoDangerous: '', cargoStackable: '', cargoTemperatureC: '',
  priceAmount: '', currency: '', vatRate: '', vatAmount: '', totalAmount: '', paymentTerms: '', invoicingInstructions: '', operationalInstructions: '', contractualNotes: ''
};
const required = ['orderNumber', 'clientName', 'pickupAddress', 'pickupLocalDate', 'pickupLocalTime', 'deliveryAddress', 'deliveryLocalDate', 'deliveryLocalTime', 'priceAmount', 'currency'];
const numeric = new Set(['cargoQuantity', 'cargoWeightKg', 'cargoVolumeM3', 'cargoLoadingMeters', 'cargoPallets', 'cargoParcels', 'cargoTemperatureC', 'priceAmount', 'vatRate', 'vatAmount', 'totalAmount']);
const booleans = new Set(['cargoDangerous', 'cargoStackable']);
const groups = [
  { title: 'Identificare și client', fields: [['orderNumber', 'Număr comandă'], ['externalReference', 'Referință externă'], ['orderDate', 'Data comenzii'], ['clientName', 'Client'], ['clientVat', 'Cod fiscal / TVA'], ['clientAddress', 'Adresă client'], ['clientContactName', 'Persoană de contact'], ['clientContactEmail', 'E-mail'], ['clientContactPhone', 'Telefon client']] },
  { title: 'Ridicare', fields: [['pickupCompany', 'Companie'], ['pickupAddress', 'Adresă completă'], ['pickupCity', 'Localitate'], ['pickupPostcode', 'Cod poștal'], ['pickupCountry', 'Țară'], ['pickupCountryCode', 'Cod țară'], ['pickupLocalDate', 'Data locală'], ['pickupLocalTime', 'Ora locală'], ['pickupTimeZone', 'Fus orar'], ['pickupContactName', 'Contact'], ['pickupContactPhone', 'Telefon'], ['pickupReference', 'Referință'], ['pickupInstructions', 'Instrucțiuni']] },
  { title: 'Livrare', fields: [['deliveryCompany', 'Companie'], ['deliveryAddress', 'Adresă completă'], ['deliveryCity', 'Localitate'], ['deliveryPostcode', 'Cod poștal'], ['deliveryCountry', 'Țară'], ['deliveryCountryCode', 'Cod țară'], ['deliveryLocalDate', 'Data locală'], ['deliveryLocalTime', 'Ora locală'], ['deliveryTimeZone', 'Fus orar'], ['deliveryContactName', 'Contact'], ['deliveryContactPhone', 'Telefon'], ['deliveryReference', 'Referință'], ['deliveryInstructions', 'Instrucțiuni']] },
  { title: 'Marfă', fields: [['cargoDescription', 'Descriere'], ['cargoQuantity', 'Cantitate'], ['cargoPackageType', 'Tip ambalaj'], ['cargoDimensions', 'Dimensiuni'], ['cargoWeightKg', 'Greutate (kg)'], ['cargoVolumeM3', 'Volum (m³)'], ['cargoLoadingMeters', 'Metri liniari'], ['cargoPallets', 'Paleți'], ['cargoParcels', 'Colete'], ['cargoDangerous', 'ADR (true/false)'], ['cargoStackable', 'Stivuibil (true/false)'], ['cargoTemperatureC', 'Temperatură (°C)']] },
  { title: 'Tarif și condiții', fields: [['priceAmount', 'Preț'], ['currency', 'Monedă'], ['vatRate', 'TVA (%)'], ['vatAmount', 'Valoare TVA'], ['totalAmount', 'Total'], ['paymentTerms', 'Termen de plată'], ['invoicingInstructions', 'Instrucțiuni facturare'], ['operationalInstructions', 'Instrucțiuni operaționale'], ['contractualNotes', 'Note contractuale']] }
] as const;

export default function NewTripScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const twoColumns = width >= 780;
  const [form, setForm] = useState<Form>(empty);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [blob, setBlob] = useState<BlobReference | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [yellow, setYellow] = useState<Set<string>>(new Set());
  const [red, setRed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  useEffect(() => { api.list().then(setVehicles).catch((e) => setError(e instanceof Error ? e.message : 'Vehiculele nu pot fi încărcate.')); }, []);
  const selected = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const set = (key: string, value: string) => { setForm((current) => ({ ...current, [key]: value })); setRed((current) => { const next = new Set(current); if (value.trim()) next.delete(key); return next; }); };

  const choosePdf = async () => {
    setError(null);
    const asset = await pickPdf();
    if (!asset) return;
    if (asset.size > 10 * 1024 * 1024) return setError('PDF-ul poate avea maximum 10 MB.');
    if (!API_BASE) return setError('Adresa backendului nu este configurată.');
    setLoading(true);
    try {
      if (blob) await api.cancelTripUpload(blob.blobUrl).catch(() => undefined);
      const body = asset.file ?? await (await fetch(asset.uri)).blob();
      const safeName = asset.name.replace(/[^a-zA-Z0-9._-]+/g, '-');
      const uploaded = await upload(`orders/${safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`}`, body, { access: 'private', handleUploadUrl: `${API_BASE}/trips/upload`, contentType: 'application/pdf' });
      const reference = { blobUrl: uploaded.url, pathname: uploaded.pathname, originalName: asset.name, contentType: uploaded.contentType, size: asset.size || body.size };
      setBlob(reference);
      const parsed = await api.extractTrip(reference); setExtraction(parsed);
      const next = { ...form }; const uncertain = new Set<string>();
      Object.entries(parsed.fields).forEach(([key, field]) => {
        next[key] = field.value ?? '';
        if (field.value === null || field.confidence < .75) uncertain.add(key);
      });
      setForm(next); setYellow(uncertain); setRed(new Set());
    } catch (e) { setError(e instanceof Error ? e.message : 'PDF-ul nu a putut fi procesat.'); }
    finally { setLoading(false); }
  };

  const save = async (overwrite = false) => {
    const missing = new Set(required.filter((key) => !form[key]?.trim()));
    if (!vehicleId) setError('Selectează vehiculul care va efectua cursa.');
    if (missing.size || !vehicleId) { setRed(missing); return; }
    setSaving(true); setError(null); setConflict(false);
    try {
      const payload: Record<string, unknown> = { status: 'HEADING_TO_PICKUP', overwrite, extraction: extraction ?? undefined, additionalData: extraction?.additionalData ?? undefined, ...(blob ?? {}) };
      Object.entries(form).forEach(([key, value]) => {
        const clean = value.trim();
        if (!clean) return;
        payload[key] = numeric.has(key) ? Number(clean.replace(',', '.')) : booleans.has(key) ? clean.toLowerCase() === 'true' || clean.toLowerCase() === 'da' : clean;
      });
      await api.assignTrip(vehicleId, payload);
      router.replace(`/vehicles/${vehicleId}?section=trip`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setConflict(true);
      else setError(e instanceof Error ? e.message : 'Cursa nu a putut fi salvată.');
    } finally { setSaving(false); }
  };
  const cancel = async () => { if (blob) await api.cancelTripUpload(blob.blobUrl).catch(() => undefined); router.back(); };

  return <AppShell active="operations" title="Cursă nouă" subtitle="Completează manual sau importă datele dintr-un PDF" back>
    <ScrollView contentContainerStyle={[ui.content, page.content]} keyboardShouldPersistTaps="handled">
      {error && <Message error>{error}</Message>}
      <Section title="Documentul original">
        <Text style={page.help}>Poți salva cursa fără PDF sau poți încărca un PDF de maximum 10 MB. Datele detectate sunt doar o propunere și rămân editabile.</Text>
        <View style={page.actions}><Button title={blob ? 'Înlocuiește PDF-ul' : 'Încarcă și citește PDF'} onPress={() => void choosePdf()} disabled={loading || saving} />{loading && <View style={page.progress}><ActivityIndicator color={colors.accent} /><Text style={page.help}>Încărcare și analiză OpenAI…</Text></View>}</View>
        {blob && <View style={page.file}><Ionicons name="document-text-outline" color={colors.text} size={22} /><View style={{ flex: 1 }}><Text style={page.fileName}>{blob.originalName}</Text><Text style={page.help}>{(blob.size / 1024 / 1024).toFixed(2)} MB · păstrat privat</Text></View></View>}
        {extraction?.documentWarnings.map((warning) => <Message key={warning}>{warning}</Message>)}
      </Section>
      <Section title="Vehicul și status inițial">
        <Text style={page.help}>Cursa se salvează direct cu statusul „Către preluare cursă”.</Text>
        <View style={page.vehicleGrid}>{vehicles.map((vehicle) => <Pressable key={vehicle.id} onPress={() => setVehicleId(vehicle.id)} style={[page.vehicle, vehicleId === vehicle.id && page.vehicleActive]}><Text style={page.vehiclePlate}>{vehicle.registrationNumber}</Text><Text style={page.help}>{vehicle.driverName ?? 'Șofer nespecificat'}{vehicle.currentTrip ? ' · are cursă' : ''}</Text></Pressable>)}</View>
      </Section>
      {groups.map((group) => <Section key={group.title} title={group.title}><View style={[page.fields, twoColumns && page.fieldsWide]}>{group.fields.map(([key, label]) => <MarkedField key={key} fieldKey={key} label={label} value={form[key]} required={required.includes(key)} yellow={yellow.has(key)} red={red.has(key)} wide={twoColumns} onChange={(value) => set(key, value)} />)}</View></Section>)}
      {extraction?.additionalData?.length ? <Section title="Alte informații din document">{extraction.additionalData.map((item, index) => <View key={`${item.label}-${index}`} style={page.extra}><Text style={page.extraLabel}>{item.label}</Text><Text style={page.extraValue}>{item.value}</Text></View>)}</Section> : null}
      {conflict && <View style={page.conflict}><Text style={page.conflictTitle}>Vehiculul {selected?.registrationNumber} are deja o cursă.</Text><Text style={page.help}>Dacă suprascrii, cursa curentă și PDF-ul ei sunt șterse definitiv.</Text><View style={page.actions}><Button title="Suprascrie cursa" onPress={() => void save(true)} disabled={saving} /><Button secondary title="Alege alt vehicul" onPress={() => setConflict(false)} /></View></View>}
      <View style={page.footer}><Button title="Salvează și asignează" onPress={() => void save()} disabled={saving || loading} /><Button secondary title="Anulează" onPress={() => void cancel()} disabled={saving} /></View>
    </ScrollView>
  </AppShell>;
}

function MarkedField({ fieldKey, label, value, required: isRequired, yellow, red, wide, onChange }: { fieldKey: string; label: string; value: string; required: boolean; yellow: boolean; red: boolean; wide: boolean; onChange: (value: string) => void }) {
  const multiline = /Instructions|Notes|Address$|Description/.test(fieldKey);
  return <View style={[page.fieldWrap, wide && page.fieldWide]}><View style={page.fieldLabel}><Text style={page.fieldLabelText}>{label}{isRequired ? ' *' : ''}</Text>{red ? <Text style={page.red}>! OBLIGATORIU</Text> : yellow ? <Text style={page.yellow}>! VERIFICĂ</Text> : null}</View><Field label="" value={value} onChangeText={onChange} multiline={multiline} style={[red && page.inputRed, yellow && !red && page.inputYellow]} /></View>;
}

const page = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 40 }, help: { color: colors.muted, fontSize: 12, lineHeight: 18 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }, progress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  file: { flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel2, padding: 12, borderRadius: 10 }, fileName: { color: colors.text, fontWeight: '800' },
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, vehicle: { minWidth: 180, flexGrow: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg }, vehicleActive: { borderColor: colors.accent, backgroundColor: '#16345b' }, vehiclePlate: { color: colors.text, fontWeight: '900' },
  fields: { gap: 12 }, fieldsWide: { flexDirection: 'row', flexWrap: 'wrap' }, fieldWrap: { width: '100%', gap: 3 }, fieldWide: { width: '48.8%', flexGrow: 1 }, fieldLabel: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, fieldLabelText: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }, yellow: { color: colors.yellow, fontSize: 10, fontWeight: '900' }, red: { color: colors.danger, fontSize: 10, fontWeight: '900' }, inputYellow: { borderColor: colors.yellow }, inputRed: { borderColor: colors.danger, borderWidth: 2 },
  extra: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9 }, extraLabel: { color: colors.muted, fontSize: 11, fontWeight: '800' }, extraValue: { color: colors.text, marginTop: 3 },
  conflict: { padding: 16, gap: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.orange, backgroundColor: '#3b2a0d' }, conflictTitle: { color: colors.text, fontSize: 17, fontWeight: '900' }, footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }
});
