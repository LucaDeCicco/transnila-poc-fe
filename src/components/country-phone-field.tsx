import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { phoneCountries } from '../lib/phone';
import { colors } from './ui';

export function CountryPhoneField({ countryIso, phoneNumber, onCountryChange, onPhoneChange }: {
  countryIso: string;
  phoneNumber: string;
  onCountryChange: (countryIso: string) => void;
  onPhoneChange: (phoneNumber: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = phoneCountries.find((country) => country.iso === countryIso) ?? phoneCountries.find((country) => country.iso === 'RO')!;
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ro-RO');
    if (!query) return phoneCountries;
    return phoneCountries.filter((country) => country.name.toLocaleLowerCase('ro-RO').includes(query) ||
      country.callingCode.includes(query) || country.iso.toLocaleLowerCase('ro-RO').includes(query));
  }, [search]);

  const close = () => { setOpen(false); setSearch(''); };

  return <View style={phone.field}>
    <Text style={phone.label}>Număr de telefon</Text>
    <View style={phone.inputRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Selectează prefixul țării" onPress={() => setOpen(true)} style={phone.countryButton}>
        <Text style={phone.countryText}>{selected.flag} {selected.callingCode}</Text>
      </Pressable>
      <TextInput
        value={phoneNumber}
        onChangeText={onPhoneChange}
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholder="712 345 678"
        placeholderTextColor={colors.muted}
        style={phone.numberInput}
        maxLength={40}
      />
    </View>
    <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
      <View style={phone.backdrop}>
        <SafeAreaView style={phone.modal}>
          <View style={phone.modalHeader}>
            <Text style={phone.modalTitle}>Selectează țara</Text>
            <Pressable accessibilityRole="button" onPress={close} style={phone.closeButton}><Text style={phone.closeText}>Închide</Text></Pressable>
          </View>
          <TextInput autoFocus value={search} onChangeText={setSearch} placeholder="Caută țara sau prefixul" placeholderTextColor={colors.muted} style={phone.search} />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.iso}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <Pressable onPress={() => { onCountryChange(item.iso); close(); }} style={[phone.option, item.iso === selected.iso && phone.optionSelected]}>
              <Text style={phone.flag}>{item.flag}</Text><Text style={phone.optionName}>{item.name}</Text><Text style={phone.callingCode}>{item.callingCode}</Text>
            </Pressable>}
            ListEmptyComponent={<Text style={phone.empty}>Nu a fost găsită nicio țară.</Text>}
          />
        </SafeAreaView>
      </View>
    </Modal>
  </View>;
}

const phone = StyleSheet.create({
  field: { gap: 6 }, label: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }, inputRow: { flexDirection: 'row', gap: 8 },
  countryButton: { minHeight: 48, minWidth: 112, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1, borderRadius: 9 },
  countryText: { color: colors.text, fontSize: 16, fontWeight: '700' }, numberInput: { flex: 1, minWidth: 0, minHeight: 48, color: colors.text, backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1, borderRadius: 9, padding: 12, fontSize: 16 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'center', padding: 16 }, modal: { width: '100%', maxWidth: 560, height: '82%', alignSelf: 'center', backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 }, modalTitle: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '800' }, closeButton: { paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.panel2, borderRadius: 8 }, closeText: { color: colors.text, fontWeight: '700' },
  search: { color: colors.text, backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1, borderRadius: 9, padding: 12, fontSize: 16 }, option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomColor: colors.border, borderBottomWidth: 1 }, optionSelected: { backgroundColor: colors.panel2 }, flag: { fontSize: 22 },
  optionName: { flex: 1, color: colors.text, fontSize: 15 }, callingCode: { color: colors.muted, fontWeight: '700' }, empty: { color: colors.muted, textAlign: 'center', padding: 24 }
});
