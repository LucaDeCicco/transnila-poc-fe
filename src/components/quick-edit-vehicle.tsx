import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { availabilityLabels } from '../lib/format';
import { Availability, Vehicle } from '../types/vehicle';
import { Button, colors, Message } from './ui';

export function QuickEditVehicle({ vehicle, visible, onClose, onSave }: {
  vehicle: Vehicle | null;
  visible: boolean;
  onClose: () => void;
  onSave: (vehicle: Vehicle) => void;
}) {
  const [status, setStatus] = useState<Availability | 'null'>('null');
  const [saving, setSaving] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicle) return;
    setStatus(vehicle.availability ?? 'null');
    setConfirmRemoval(false);
    setError(null);
  }, [vehicle, visible]);

  const save = async () => {
    if (!vehicle || saving) return;
    if (vehicle.currentTrip && status === 'AVAILABLE' && !confirmRemoval) {
      setConfirmRemoval(true); setError('Statusul Disponibil șterge definitiv cursa curentă și documentul original. Apasă din nou „Confirmă și salvează”.'); return;
    }
    if (vehicle.currentTrip && status !== 'AVAILABLE' && status !== 'null' && status !== vehicle.availability) {
      const location = status === 'HEADING_TO_PICKUP' ? vehicle.currentTrip.pickupLocation : vehicle.currentTrip.deliveryLocation;
      if (!location) return setError(`Confirmă locația de ${status === 'HEADING_TO_PICKUP' ? 'ridicare' : 'livrare'} din pagina vehiculului înainte de schimbarea statusului.`);
    }
    setSaving(true); setError(null);
    try {
      const { api } = await import('../lib/api');
      const updated = await api.patch(vehicle.id, { availability: status === 'null' ? null : status });
      onSave(updated); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Modificarea nu a putut fi salvată.'); }
    finally { setSaving(false); }
  };

  return <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
    <Pressable style={modal.backdrop} onPress={onClose}>
      <Pressable accessibilityRole="none" onPress={(event) => event.stopPropagation()} style={modal.sheet}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={modal.content}>
          <View><Text style={modal.eyebrow}>Actualizare rapidă</Text><Text style={modal.title}>{vehicle?.registrationNumber}</Text></View>
          <View style={modal.group}><Text style={modal.label}>Status</Text><View style={modal.choices}>
            {[['null', 'Nespecificat'], ...Object.entries(availabilityLabels)].map(([key, label]) => <Pressable key={key} onPress={() => {
              const nextStatus = key as Availability | 'null';
              setStatus(nextStatus); setConfirmRemoval(false);
            }} style={[modal.choice, status === key && modal.choiceActive]}><Text style={modal.choiceText}>{label}</Text></Pressable>)}
          </View></View>
          <Text style={modal.hint}>{vehicle?.currentTrip ? 'Destinațiile se modifică și se confirmă cu minimapa din pagina vehiculului, în Cursa curentă sau Operațiuni.' : 'Destinația se poate defini și confirma independent din Operațiuni, în pagina vehiculului.'}</Text>
          {error && <Message error>{error}</Message>}
          <View style={modal.actions}><Button title={confirmRemoval ? 'Confirmă și salvează' : 'Salvează'} onPress={() => void save()} disabled={saving} /><Button secondary title="Anulează" onPress={onClose} /></View>
        </ScrollView>
      </Pressable>
    </Pressable>
  </Modal>;
}

const modal = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,12,.78)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '92%', borderRadius: 18, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, overflow: 'hidden' },
  content: { padding: 20, gap: 17 }, eyebrow: { color: colors.accent, textTransform: 'uppercase', fontSize: 11, fontWeight: '900' }, title: { color: colors.text, fontSize: 25, fontWeight: '900', marginTop: 3 },
  group: { gap: 7 }, label: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1, borderRadius: 9 }, choiceActive: { backgroundColor: colors.accent, borderColor: colors.accent }, choiceText: { color: colors.text, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }
});
