import { Ionicons } from '@expo/vector-icons';
import { upload } from '@vercel/blob/client';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppShell } from '@/components/app-shell';
import { LocationVerification } from '@/components/location-verification';
import { Button, colors, Field, Message, Section, styles as ui } from '@/components/ui';
import { API_BASE, ApiError, api, getAuthorizationHeaders } from '@/lib/api';
import { pickOrderDocument } from '@/lib/order-document-picker';
import { countryCodeFromName, romanianCountryName } from '@/lib/country';
import { BlobReference, ConfirmedLocation, ExtractionResult, LocationInput, MapConfig, Vehicle } from '@/types/vehicle';

type Form = Record<string, string>;
const empty: Form = {
  orderNumber: '', externalReference: '', orderDate: '', clientName: '', clientVat: '', clientAddress: '', clientContactName: '', clientContactEmail: '', clientContactPhone: '',
  pickupCompany: '', pickupAddress: '', pickupCity: '', pickupPostcode: '', pickupCountry: '', pickupCountryCode: '', pickupLocalDate: '', pickupLocalTime: '', pickupTimeZone: '', pickupContactName: '', pickupContactPhone: '', pickupReference: '', pickupInstructions: '', pickupGoogleMapsUrl: '',
  deliveryCompany: '', deliveryAddress: '', deliveryCity: '', deliveryPostcode: '', deliveryCountry: '', deliveryCountryCode: '', deliveryLocalDate: '', deliveryLocalTime: '', deliveryTimeZone: '', deliveryContactName: '', deliveryContactPhone: '', deliveryReference: '', deliveryInstructions: '', deliveryGoogleMapsUrl: '',
  cargoDescription: '', cargoQuantity: '', cargoPackageType: '', cargoDimensions: '', cargoWeightKg: '', cargoVolumeM3: '', cargoLoadingMeters: '', cargoPallets: '', cargoParcels: '', cargoDangerous: '', cargoStackable: '', cargoTemperatureC: '',
  priceAmount: '', currency: '', vatRate: '', vatAmount: '', totalAmount: '', paymentTerms: '', invoicingInstructions: '', operationalInstructions: '', contractualNotes: ''
};
const required = ['orderNumber', 'pickupLocalDate', 'deliveryLocalDate'];
const locationKeys = new Set(['Company', 'Address', 'City', 'Postcode', 'Country', 'CountryCode', 'GoogleMapsUrl']);
const numeric = new Set(['cargoQuantity', 'cargoWeightKg', 'cargoVolumeM3', 'cargoLoadingMeters', 'cargoPallets', 'cargoParcels', 'cargoTemperatureC', 'priceAmount', 'vatRate', 'vatAmount', 'totalAmount']);
const booleans = new Set(['cargoDangerous', 'cargoStackable']);
const groups = [
  { title: 'Identificare și client', fields: [['orderNumber', 'Număr comandă'], ['externalReference', 'Referință externă'], ['orderDate', 'Data comenzii'], ['clientName', 'Client'], ['clientVat', 'Cod fiscal / TVA'], ['clientAddress', 'Adresă client'], ['clientContactName', 'Persoană de contact'], ['clientContactEmail', 'E-mail'], ['clientContactPhone', 'Telefon client']] },
  { title: 'Ridicare', fields: [['pickupCompany', 'Companie'], ['pickupAddress', 'Adresă completă'], ['pickupCity', 'Localitate'], ['pickupPostcode', 'Cod poștal'], ['pickupCountry', 'Țară'], ['pickupGoogleMapsUrl', 'Link Google Maps (opțional)'], ['pickupLocalDate', 'Data locală'], ['pickupLocalTime', 'Ora locală'], ['pickupTimeZone', 'Fus orar'], ['pickupContactName', 'Contact'], ['pickupContactPhone', 'Telefon'], ['pickupReference', 'Referință'], ['pickupInstructions', 'Instrucțiuni']] },
  { title: 'Livrare', fields: [['deliveryCompany', 'Companie'], ['deliveryAddress', 'Adresă completă'], ['deliveryCity', 'Localitate'], ['deliveryPostcode', 'Cod poștal'], ['deliveryCountry', 'Țară'], ['deliveryGoogleMapsUrl', 'Link Google Maps (opțional)'], ['deliveryLocalDate', 'Data locală'], ['deliveryLocalTime', 'Ora locală'], ['deliveryTimeZone', 'Fus orar'], ['deliveryContactName', 'Contact'], ['deliveryContactPhone', 'Telefon'], ['deliveryReference', 'Referință'], ['deliveryInstructions', 'Instrucțiuni']] },
  { title: 'Marfă', fields: [['cargoDescription', 'Descriere'], ['cargoQuantity', 'Cantitate'], ['cargoPackageType', 'Tip ambalaj'], ['cargoDimensions', 'Dimensiuni'], ['cargoWeightKg', 'Greutate (kg)'], ['cargoVolumeM3', 'Volum (m³)'], ['cargoLoadingMeters', 'Metri liniari'], ['cargoPallets', 'Paleți'], ['cargoParcels', 'Colete'], ['cargoDangerous', 'ADR (true/false)'], ['cargoStackable', 'Stivuibil (true/false)'], ['cargoTemperatureC', 'Temperatură (°C)']] },
  { title: 'Tarif și condiții', fields: [['priceAmount', 'Preț'], ['currency', 'Monedă'], ['vatRate', 'TVA (%)'], ['vatAmount', 'Valoare TVA'], ['totalAmount', 'Total'], ['paymentTerms', 'Termen de plată'], ['invoicingInstructions', 'Instrucțiuni facturare'], ['operationalInstructions', 'Instrucțiuni operaționale'], ['contractualNotes', 'Note contractuale']] }
] as const;

export default function NewTripScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ vehicleId?: string | string[]; offerId?: string | string[] }>();
  const requestedVehicleId = Array.isArray(params.vehicleId) ? params.vehicleId[0] : params.vehicleId;
  const requestedOfferId = Array.isArray(params.offerId) ? params.offerId[0] : params.offerId;
  const { width } = useWindowDimensions();
  const twoColumns = width >= 780;
  const [form, setForm] = useState<Form>(empty);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [blob, setBlob] = useState<BlobReference | null>(null);
  const [sourceOfferId, setSourceOfferId] = useState<string | null>(requestedOfferId ?? null);
  const [sourceOwnedBlob, setSourceOwnedBlob] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [yellow, setYellow] = useState<Set<string>>(new Set());
  const [red, setRed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null);
  const [pickupLocation, setPickupLocation] = useState<{ value: ConfirmedLocation | null; confirmed: boolean }>({ value: null, confirmed: false });
  const [deliveryLocation, setDeliveryLocation] = useState<{ value: ConfirmedLocation | null; confirmed: boolean }>({ value: null, confirmed: false });

  useEffect(() => {
    let active = true;
    api.list().then((rows) => {
      if (!active) return;
      setVehicles(rows);
      if (!requestedVehicleId) return;
      if (rows.some((vehicle) => vehicle.id === requestedVehicleId)) setVehicleId(requestedVehicleId);
      else setError('Vehiculul preselectat nu mai este disponibil. Alege un alt vehicul.');
    }).catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Vehiculele nu pot fi încărcate.'); });
    return () => { active = false; };
  }, [requestedVehicleId]);
  useEffect(() => { api.mapConfig().then(setMapConfig).catch(() => undefined); }, []);
  useEffect(() => {
    if (!requestedOfferId) return;
    let active = true; setLoading(true); setError(null);
    api.offerTripPrefill(requestedOfferId).then((result) => {
      if (!active) return;
      const next = { ...empty }; const uncertain = new Set<string>();
      Object.entries(result.fields).forEach(([key, field]) => { next[key] = field.value ?? ''; if (field.value === null || field.confidence < .75) uncertain.add(key); });
      for (const prefix of ['pickup', 'delivery'] as const) {
        next[`${prefix}CountryCode`] = next[`${prefix}CountryCode`]?.toUpperCase() || countryCodeFromName(next[`${prefix}Country`]) || '';
        next[`${prefix}Country`] = romanianCountryName(next[`${prefix}CountryCode`], next[`${prefix}Country`] || '');
      }
      setForm(next); setYellow(uncertain); setExtraction(result.extraction); setBlob(result.blob);
      setSourceOwnedBlob(Boolean(result.blob)); setSourceOfferId(result.offer.id);
    }).catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Oferta nu a putut fi încărcată.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requestedOfferId]);
  const selected = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const hasDelivery = ['Address', 'Company', 'City', 'Postcode', 'Country', 'CountryCode', 'GoogleMapsUrl']
    .some((suffix) => Boolean(form[`delivery${suffix}`]?.trim()));
  const requiredNow = requiredFields(form, hasDelivery);
  const validationIssues = tripValidationIssues(form, selected, pickupLocation, deliveryLocation, hasDelivery);
  const set = (key: string, value: string) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'pickupCountryCode') next.pickupCountry = romanianCountryName(value, next.pickupCountry);
      if (key === 'deliveryCountryCode') next.deliveryCountry = romanianCountryName(value, next.deliveryCountry);
      if (key === 'pickupCountry') {
        next.pickupCountryCode = countryCodeFromName(value) ?? '';
        if (next.pickupCountryCode) next.pickupCountry = romanianCountryName(next.pickupCountryCode, value);
      }
      if (key === 'deliveryCountry') {
        next.deliveryCountryCode = countryCodeFromName(value) ?? '';
        if (next.deliveryCountryCode) next.deliveryCountry = romanianCountryName(next.deliveryCountryCode, value);
      }
      return next;
    });
    setRed((current) => { const next = new Set(current); if (value.trim()) next.delete(key); return next; });
    const prefix = key.startsWith('pickup') ? 'pickup' : key.startsWith('delivery') ? 'delivery' : null;
    if (prefix && locationKeys.has(key.slice(prefix.length))) {
      if (prefix === 'pickup') setPickupLocation({ value: null, confirmed: false });
      else setDeliveryLocation({ value: null, confirmed: false });
    }
  };
  const selectVehicle = (id: string) => { setVehicleId(id); setConflict(false); setError(null); };
  const changeVehicle = () => { setVehicleId(''); setConflict(false); setError(null); };

  const chooseDocument = async (source: 'files' | 'camera' = 'files') => {
    setError(null);
    try {
      const asset = await pickOrderDocument(source);
      if (!asset) return;
      if (asset.size > 10 * 1024 * 1024) {
        return setError(`${asset.kind === 'IMAGE' ? 'Imaginea' : 'PDF-ul'} poate avea maximum 10 MB.`);
      }
      if (!API_BASE) return setError('Adresa backendului nu este configurată.');
      setLoading(true);
      if (blob && !sourceOwnedBlob) {
        await api.cancelTripUpload(blob.blobUrl).catch(() => undefined);
        setBlob(null);
        setExtraction(null);
      }
      setSourceOwnedBlob(false);
      const body = asset.file ?? await (await fetch(asset.uri)).blob();
      if (body.size > 10 * 1024 * 1024) {
        return setError(`${asset.kind === 'IMAGE' ? 'Imaginea' : 'PDF-ul'} poate avea maximum 10 MB.`);
      }
      const safeName = asset.name.replace(/[^a-zA-Z0-9._-]+/g, '-');
      const fallbackExtension = asset.type === 'application/pdf' ? 'pdf'
        : asset.type === 'image/jpeg' ? 'jpg'
          : asset.type.split('/')[1];
      const uploadName = safeName.includes('.') ? safeName : `${safeName}.${fallbackExtension}`;
      const uploaded = await upload(`orders/${uploadName}`, body, { access: 'private', handleUploadUrl: `${API_BASE}/trips/upload`, contentType: asset.type, headers: getAuthorizationHeaders() });
      const reference = { blobUrl: uploaded.url, pathname: uploaded.pathname, originalName: asset.name, contentType: uploaded.contentType, size: asset.size || body.size };
      setBlob(reference);
      const parsed = await api.extractTrip(reference); setExtraction(parsed);
      const next = { ...form }; const uncertain = new Set<string>();
      Object.entries(parsed.fields).forEach(([key, field]) => {
        next[key] = field.value ?? '';
        if (field.value === null || field.confidence < .75) uncertain.add(key);
      });
      for (const prefix of ['pickup', 'delivery'] as const) {
        next[`${prefix}CountryCode`] = next[`${prefix}CountryCode`]?.toUpperCase()
          || countryCodeFromName(next[`${prefix}Country`]) || '';
        next[`${prefix}Country`] = romanianCountryName(next[`${prefix}CountryCode`], next[`${prefix}Country`] ?? '');
      }
      setForm(next); setYellow(uncertain); setRed(new Set());
      setPickupLocation({ value: null, confirmed: false }); setDeliveryLocation({ value: null, confirmed: false });
    } catch (e) { setError(e instanceof Error ? e.message : 'Documentul nu a putut fi procesat.'); }
    finally { setLoading(false); }
  };

  const save = async (overwrite = false) => {
    setShowValidation(true); setError(null);
    const missing = new Set([...requiredNow].filter((key) => !form[key]?.trim()));
    if (validationIssues.length) { setRed(missing); return; }
    setSaving(true); setError(null); setConflict(false);
    try {
      const payload: Record<string, unknown> = { status: 'HEADING_TO_PICKUP', overwrite, sourceOfferId: sourceOfferId ?? undefined, pickupLocation: pickupLocation.value, deliveryLocation: hasDelivery ? deliveryLocation.value : undefined, extraction: extraction ?? undefined, additionalData: extraction?.additionalData ?? undefined, ...(blob ?? {}) };
      Object.entries(form).forEach(([key, value]) => {
        const clean = value.trim();
        if (!clean) return;
        payload[key] = numeric.has(key) ? Number(clean.replace(',', '.')) : booleans.has(key) ? clean.toLowerCase() === 'true' || clean.toLowerCase() === 'da' : clean;
      });
      await api.assignTrip(vehicleId, payload);
      router.replace(`/vehicles/${vehicleId}?section=trip`);
    } catch (e) {
      const code = e instanceof ApiError && typeof e.payload === 'object' && e.payload !== null && 'code' in e.payload
        ? (e.payload as { code?: unknown }).code : null;
      if (e instanceof ApiError && e.status === 409 && code === 'VEHICLE_HAS_TRIP') setConflict(true);
      else setError(e instanceof Error ? e.message : 'Cursa nu a putut fi salvată.');
    } finally { setSaving(false); }
  };
  const cancel = async () => { if (blob && !sourceOwnedBlob) await api.cancelTripUpload(blob.blobUrl).catch(() => undefined); router.back(); };
  const locationInput = (prefix: 'pickup' | 'delivery'): LocationInput => ({
    company: form[`${prefix}Company`] || null, address: form[`${prefix}Address`] || null,
    city: form[`${prefix}City`] || null, postcode: form[`${prefix}Postcode`] || '', country: form[`${prefix}Country`] || '',
    countryCode: form[`${prefix}CountryCode`] || null, googleMapsUrl: form[`${prefix}GoogleMapsUrl`] || null
  });
  return <AppShell active={sourceOfferId ? 'findWork' : 'operations'} title="Cursă nouă" subtitle={sourceOfferId ? 'Date precompletate din oferta Gmail — verifică înainte de salvare' : 'Completează manual sau importă datele dintr-un PDF ori dintr-o imagine'} back>
    <ScrollView contentContainerStyle={[ui.content, page.content]} keyboardShouldPersistTaps="handled">
      <Section title="Documentul original">
        <Text style={page.help}>Poți salva cursa fără document sau poți încărca un singur PDF ori o imagine de maximum 10 MB. Pe telefon poți alege și camera. Datele detectate sunt doar o propunere și rămân editabile.</Text>
        <View style={page.actions}><Button title={blob ? 'Înlocuiește documentul' : 'Încarcă PDF sau imagine'} onPress={() => void chooseDocument()} disabled={loading || saving} />{Platform.OS === 'web' && <Button secondary title="Fotografiază documentul" onPress={() => void chooseDocument('camera')} disabled={loading || saving} />}{loading && <View style={page.progress}><ActivityIndicator color={colors.accent} /><Text style={page.help}>Încărcare și analiză OpenAI…</Text></View>}</View>
        {blob && <View style={page.file}><Ionicons name={blob.contentType === 'application/pdf' ? 'document-text-outline' : 'image-outline'} color={colors.text} size={22} /><View style={{ flex: 1 }}><Text style={page.fileName}>{blob.originalName}</Text><Text style={page.help}>{(blob.size / 1024 / 1024).toFixed(2)} MB · păstrat privat</Text></View></View>}
        {extraction?.documentWarnings.map((warning) => <Message key={warning}>{warning}</Message>)}
      </Section>
      <Section title="Vehicul și status inițial">
        <Text style={page.help}>Cursa se salvează direct cu statusul „Către preluare cursă”. Adresa de livrare poate fi completată ulterior.</Text>
        {selected ? <View style={page.selectedVehicle}><View style={[page.vehicle, page.vehicleActive]}><Text style={page.vehiclePlate}>{selected.registrationNumber}</Text><Text style={page.help}>{selected.currentDriverId && selected.driverName ? selected.driverName : 'Șofer curent nespecificat'}{selected.currentTrip ? ' · are cursă' : ''}</Text></View><Button secondary title="Schimbă vehiculul" onPress={changeVehicle} /></View>
          : <View style={page.vehicleGrid}>{vehicles.map((vehicle) => <Pressable key={vehicle.id} onPress={() => selectVehicle(vehicle.id)} style={page.vehicle}><Text style={page.vehiclePlate}>{vehicle.registrationNumber}</Text><Text style={page.help}>{vehicle.currentDriverId && vehicle.driverName ? vehicle.driverName : 'Șofer curent nespecificat'}{vehicle.currentTrip ? ' · are cursă' : ''}</Text></Pressable>)}</View>}
      </Section>
      {groups.map((group) => <Section key={group.title} title={group.title}><View style={[page.fields, twoColumns && page.fieldsWide]}>{group.fields.map(([key, label]) => <MarkedField key={key} fieldKey={key} label={label} value={form[key]} required={requiredNow.has(key)} yellow={yellow.has(key)} red={red.has(key)} wide={twoColumns} onChange={(value) => set(key, value)} />)}</View>{group.title === 'Ridicare' && <LocationVerification label="Locația de ridicare" input={locationInput('pickup')} value={pickupLocation.value} confirmed={pickupLocation.confirmed} config={mapConfig} disabled={saving || loading} onResolved={(value) => setPickupLocation({ value, confirmed: false })} onConfirmed={() => setPickupLocation((current) => ({ ...current, confirmed: true }))} />}{group.title === 'Livrare' && (hasDelivery ? <LocationVerification label="Locația de livrare" input={locationInput('delivery')} value={deliveryLocation.value} confirmed={deliveryLocation.confirmed} config={mapConfig} disabled={saving || loading} onResolved={(value) => setDeliveryLocation({ value, confirmed: false })} onConfirmed={() => setDeliveryLocation((current) => ({ ...current, confirmed: true }))} /> : <Text style={page.help}>Destinația poate fi completată și confirmată ulterior din cursa curentă sau Operațiuni.</Text>)}</Section>)}
      {extraction?.additionalData?.length ? <Section title="Alte informații din document">{extraction.additionalData.map((item, index) => <View key={`${item.label}-${index}`} style={page.extra}><Text style={page.extraLabel}>{item.label}</Text><Text style={page.extraValue}>{item.value}</Text></View>)}</Section> : null}
      {conflict && <View style={page.conflict}><Text style={page.conflictTitle}>Vehiculul {selected?.registrationNumber} are deja o cursă.</Text><Text style={page.help}>Dacă suprascrii, cursa curentă și documentul ei original sunt șterse definitiv.</Text><View style={page.actions}><Button title="Suprascrie cursa" onPress={() => void save(true)} disabled={saving} /><Button secondary title="Alege alt vehicul" onPress={changeVehicle} /></View></View>}
      {showValidation && validationIssues.length > 0 && <View style={page.validation}><Text style={page.validationTitle}>Cursa nu poate fi salvată încă:</Text>{validationIssues.map((issue) => <Text key={issue} style={page.validationItem}>• {issue}</Text>)}</View>}
      {error && <Message error>{error}</Message>}
      <View style={page.footer}><Button title="Salvează și asignează" onPress={() => void save()} disabled={saving || loading} /><Button secondary title="Anulează" onPress={() => void cancel()} disabled={saving} /></View>
    </ScrollView>
  </AppShell>;
}

function requiredFields(form: Form, hasDelivery: boolean) {
  const fields = new Set(required);
  if (form.priceAmount.trim()) fields.add('currency');
  if (!form.pickupGoogleMapsUrl.trim()) { fields.add('pickupPostcode'); fields.add('pickupCountry'); }
  if (hasDelivery && !form.deliveryGoogleMapsUrl.trim()) { fields.add('deliveryPostcode'); fields.add('deliveryCountry'); }
  return fields;
}

function tripValidationIssues(form: Form, selected: Vehicle | undefined,
  pickup: { value: ConfirmedLocation | null; confirmed: boolean },
  delivery: { value: ConfirmedLocation | null; confirmed: boolean }, hasDelivery: boolean) {
  const labels: Record<string, string> = {
    orderNumber: 'numărul comenzii', pickupPostcode: 'codul poștal pentru ridicare',
    pickupCountry: 'țara pentru ridicare', pickupLocalDate: 'data ridicării',
    deliveryPostcode: 'codul poștal pentru livrare', deliveryCountry: 'țara pentru livrare',
    deliveryLocalDate: 'data livrării', currency: 'moneda'
  };
  const issues: string[] = [];
  if (!selected) issues.push('Selectează vehiculul care va efectua cursa.');
  else if (!selected.currentDriverId) issues.push('Vehiculul selectat nu are un șofer curent asignat.');
  for (const key of requiredFields(form, hasDelivery)) {
    if (!form[key]?.trim()) issues.push(`Completează ${labels[key]}.`);
  }
  if (form.priceAmount.trim() && (!Number.isFinite(Number(form.priceAmount.replace(',', '.'))) || Number(form.priceAmount.replace(',', '.')) < 0)) {
    issues.push('Prețul trebuie să fie un număr valid, mai mare sau egal cu zero.');
  }
  if (!pickup.value || !pickup.confirmed) issues.push('Verifică și confirmă locația de ridicare.');
  if (hasDelivery && (!delivery.value || !delivery.confirmed)) issues.push('Verifică și confirmă locația de livrare.');
  return issues;
}

function MarkedField({ fieldKey, label, value, required: isRequired, yellow, red, wide, onChange }: { fieldKey: string; label: string; value: string; required: boolean; yellow: boolean; red: boolean; wide: boolean; onChange: (value: string) => void }) {
  const multiline = /Instructions|Notes|Address$|Description/.test(fieldKey);
  return <View style={[page.fieldWrap, wide && page.fieldWide]}><View style={page.fieldLabel}><Text style={page.fieldLabelText}>{label}{isRequired ? ' *' : ''}</Text>{red ? <Text style={page.red}>! OBLIGATORIU</Text> : yellow ? <Text style={page.yellow}>! VERIFICĂ</Text> : null}</View><Field label="" value={value} onChangeText={onChange} multiline={multiline} style={[red && page.inputRed, yellow && !red && page.inputYellow]} /></View>;
}

const page = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 40 }, help: { color: colors.muted, fontSize: 12, lineHeight: 18 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }, progress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  file: { flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel2, padding: 12, borderRadius: 10 }, fileName: { color: colors.text, fontWeight: '800' },
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, selectedVehicle: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'stretch' }, vehicle: { minWidth: 180, flexGrow: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg }, vehicleActive: { borderColor: colors.accent, backgroundColor: '#16345b' }, vehiclePlate: { color: colors.text, fontWeight: '900' },
  fields: { gap: 12 }, fieldsWide: { flexDirection: 'row', flexWrap: 'wrap' }, fieldWrap: { width: '100%', gap: 3 }, fieldWide: { width: '48.8%', flexGrow: 1 }, fieldLabel: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, fieldLabelText: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }, yellow: { color: colors.yellow, fontSize: 10, fontWeight: '900' }, red: { color: colors.danger, fontSize: 10, fontWeight: '900' }, inputYellow: { borderColor: colors.yellow }, inputRed: { borderColor: colors.danger, borderWidth: 2 },
  extra: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9 }, extraLabel: { color: colors.muted, fontSize: 11, fontWeight: '800' }, extraValue: { color: colors.text, marginTop: 3 },
  conflict: { padding: 16, gap: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.orange, backgroundColor: '#3b2a0d' }, conflictTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  validation: { padding: 16, gap: 7, borderRadius: 12, backgroundColor: '#4a1d29' }, validationTitle: { color: colors.text, fontWeight: '900', fontSize: 16 }, validationItem: { color: colors.text, lineHeight: 20 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }
});
