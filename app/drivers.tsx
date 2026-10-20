import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppShell } from '@/components/app-shell';
import { CountryPhoneField } from '@/components/country-phone-field';
import { Button, colors, Field, Message, styles as ui } from '@/components/ui';
import { api } from '@/lib/api';
import { formatInternationalPhone } from '@/lib/phone';
import { Driver, Vehicle } from '@/types/vehicle';

type DriverForm = { name: string; phoneCountryIso: string; phoneNumber: string; notes: string };
const emptyForm: DriverForm = { name: '', phoneCountryIso: 'RO', phoneNumber: '', notes: '' };

export default function DriversScreen() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Driver | 'new' | null>(null);
  const [assigning, setAssigning] = useState<Driver | null>(null);
  const [form, setForm] = useState<DriverForm>(emptyForm);
  const { width } = useWindowDimensions();

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [nextDrivers, nextVehicles] = await Promise.all([api.drivers(false), api.list(false)]);
      setDrivers(nextDrivers); setVehicles(nextVehicles);
    } catch (e) { setError(e instanceof Error ? e.message : 'Șoferii nu pot fi încărcați.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return undefined; }, [load]));

  const openForm = (driver?: Driver) => {
    setEditing(driver ?? 'new');
    setForm(driver ? {
      name: driver.name, phoneCountryIso: driver.phoneCountryIso ?? 'RO',
      phoneNumber: driver.phoneNumber ?? '', notes: driver.notes ?? ''
    } : emptyForm);
  };
  const save = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true); setError(null);
    try {
      const payload = { ...form, phoneCountryIso: form.phoneNumber.trim() ? form.phoneCountryIso : null, phoneNumber: form.phoneNumber.trim() || null };
      if (editing === 'new') await api.createDriver(payload);
      else if (editing) await api.updateDriver(editing.id, payload);
      setEditing(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Șoferul nu a putut fi salvat.'); }
    finally { setSaving(false); }
  };
  const toggleVehicle = async (vehicle: Vehicle) => {
    if (!assigning || saving) return;
    const currentIds = vehicle.drivers?.map((driver) => driver.id) ?? [];
    const assigned = currentIds.includes(assigning.id);
    if (!assigned && currentIds.length >= 2) {
      setError(`${vehicle.registrationNumber} are deja doi șoferi. Elimină unul înainte.`); return;
    }
    const driverIds = assigned ? currentIds.filter((id) => id !== assigning.id) : [...currentIds, assigning.id];
    const currentDriverId = assigned
      ? (vehicle.currentDriverId === assigning.id ? driverIds[0] ?? null : vehicle.currentDriverId)
      : vehicle.currentDriverId ?? assigning.id;
    setSaving(true); setError(null);
    try { await api.assignDrivers(vehicle.id, { driverIds, currentDriverId }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Asignarea nu a putut fi actualizată.'); }
    finally { setSaving(false); }
  };
  const toggleActive = async (driver: Driver) => {
    if (saving) return;
    setSaving(true); setError(null);
    try { await api.updateDriver(driver.id, { isActive: !driver.isActive }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Starea șoferului nu a putut fi schimbată.'); }
    finally { setSaving(false); }
  };
  const setCurrentDriver = async (vehicle: Vehicle, driver: Driver) => {
    setSaving(true); setError(null);
    try {
      await api.assignDrivers(vehicle.id, { driverIds: vehicle.drivers.map((item) => item.id), currentDriverId: driver.id });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Șoferul curent nu a putut fi schimbat.'); }
    finally { setSaving(false); }
  };

  return <AppShell active="drivers" title="Șoferi" subtitle="Persoane, date de contact și asignări pe vehicule" action={<Button title="Șofer nou" onPress={() => openForm()} />}>
    <ScrollView contentContainerStyle={ui.content}>
      {error && <Message error>{error}</Message>}
      {loading ? <ActivityIndicator color={colors.accent} size="large" /> : <View style={[page.grid, width < 760 && page.gridMobile]}>
        {drivers.map((driver) => {
          const assignment = driver.activeAssignments?.[0];
          return <View key={driver.id} style={[page.card, !driver.isActive && page.inactive]}>
            <View style={page.cardTop}><View style={page.avatar}><Ionicons name="person" color="#fff" size={20} /></View><View style={{ flex: 1, minWidth: 0 }}><Text style={page.name}>{driver.name}</Text><Text style={page.secondary}>{formatInternationalPhone(driver.phoneE164)}</Text></View></View>
            <View style={page.assignment}><Text style={page.label}>VEHICUL ASIGNAT</Text><Text style={page.vehicle}>{assignment?.vehicle.registrationNumber ?? 'Neasignat'}</Text>{assignment && <Text style={page.secondary}>Poziția {assignment.slot} în echipaj</Text>}</View>
            {driver.notes ? <Text style={page.notes}>{driver.notes}</Text> : null}
            <View style={page.actions}><Button secondary title="Editează" onPress={() => openForm(driver)} />{driver.isActive && <Button secondary title="Asignări" onPress={() => setAssigning(driver)} />}<Button secondary title={driver.isActive ? 'Dezactivează' : 'Reactivează'} onPress={() => void toggleActive(driver)} /></View>
          </View>;
        })}
      </View>}
      {!loading && !drivers.length && <Text style={page.empty}>Nu există încă șoferi. Creează primul șofer pentru a-l asigna unui vehicul.</Text>}
    </ScrollView>
    <Modal visible={Boolean(editing)} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
      <View style={page.backdrop}><SafeAreaView style={page.modal}><ScrollView contentContainerStyle={page.modalContent}>
        <View style={page.modalHead}><Text style={page.modalTitle}>{editing === 'new' ? 'Șofer nou' : 'Editează șoferul'}</Text><Pressable onPress={() => setEditing(null)}><Ionicons name="close" color={colors.text} size={25} /></Pressable></View>
        <Field label="Nume" value={form.name} onChangeText={(name) => setForm({ ...form, name })} maxLength={120} />
        <CountryPhoneField countryIso={form.phoneCountryIso} phoneNumber={form.phoneNumber} onCountryChange={(phoneCountryIso) => setForm({ ...form, phoneCountryIso })} onPhoneChange={(phoneNumber) => setForm({ ...form, phoneNumber })} />
        <Field label="Observații" multiline value={form.notes} onChangeText={(notes) => setForm({ ...form, notes })} maxLength={2000} />
        <View style={ui.actions}><Button secondary title="Anulează" onPress={() => setEditing(null)} /><Button disabled={saving || !form.name.trim()} title="Salvează" onPress={() => void save()} /></View>
      </ScrollView></SafeAreaView></View>
    </Modal>
    <Modal visible={Boolean(assigning)} transparent animationType="fade" onRequestClose={() => setAssigning(null)}>
      <View style={page.backdrop}><SafeAreaView style={page.modal}><View style={page.modalContent}>
        <View style={page.modalHead}><View><Text style={page.modalTitle}>Asignare vehicul</Text><Text style={page.secondary}>{assigning?.name}</Text></View><Pressable onPress={() => setAssigning(null)}><Ionicons name="close" color={colors.text} size={25} /></Pressable></View>
        <Text style={page.help}>Apasă un vehicul pentru a asigna sau elimina șoferul. Un vehicul poate avea maximum doi șoferi.</Text>
        <ScrollView style={{ maxHeight: 480 }}>{vehicles.map((vehicle) => {
          const selected = Boolean(assigning && vehicle.drivers?.some((driver) => driver.id === assigning.id));
          const isCurrent = Boolean(assigning && vehicle.currentDriverId === assigning.id);
          return <Pressable key={vehicle.id} disabled={saving} onPress={() => void toggleVehicle(vehicle)} style={[page.vehicleOption, selected && page.vehicleOptionSelected]}><Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={selected ? colors.success : colors.muted} /><View style={{ flex: 1 }}><Text style={page.vehicle}>{vehicle.registrationNumber}</Text><Text style={page.secondary}>{vehicle.drivers?.map((driver) => `${driver.name}${driver.isCurrent ? ' · la volan' : ''}`).join(' / ') || 'Fără șofer'}</Text></View>{selected && !isCurrent && assigning && <Pressable onPress={(event) => { event.stopPropagation(); void setCurrentDriver(vehicle, assigning); }} style={page.currentButton}><Text style={page.currentButtonText}>Setează la volan</Text></Pressable>}</Pressable>;
        })}</ScrollView>
      </View></SafeAreaView></View>
    </Modal>
  </AppShell>;
}

const page = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, gridMobile: { flexDirection: 'column' },
  card: { flexGrow: 1, flexBasis: 330, maxWidth: 520, padding: 16, gap: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel }, inactive: { opacity: .58 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1e4f86', alignItems: 'center', justifyContent: 'center' }, name: { color: colors.text, fontSize: 18, fontWeight: '900' }, secondary: { color: colors.muted, fontSize: 12, marginTop: 2 },
  assignment: { padding: 12, borderRadius: 10, backgroundColor: colors.panel2 }, label: { color: colors.muted, fontSize: 10, fontWeight: '900' }, vehicle: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 3 }, notes: { color: colors.muted, lineHeight: 19 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, empty: { color: colors.muted, textAlign: 'center', padding: 30 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.76)', justifyContent: 'center', padding: 14 }, modal: { width: '100%', maxWidth: 620, maxHeight: '90%', alignSelf: 'center', backgroundColor: colors.panel, borderRadius: 16, borderWidth: 1, borderColor: colors.border }, modalContent: { padding: 18, gap: 15 }, modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, modalTitle: { color: colors.text, fontSize: 21, fontWeight: '900' }, help: { color: colors.muted, lineHeight: 19 },
  vehicleOption: { minHeight: 60, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 11, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }, vehicleOptionSelected: { backgroundColor: '#123154' }, currentButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1e4f86' }, currentButtonText: { color: '#fff', fontWeight: '800', fontSize: 11 }
});
