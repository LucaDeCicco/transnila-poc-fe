import { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

export const colors = { bg: '#0b1018', panel: '#141c29', panel2: '#1b2636', text: '#f3f6fb', muted: '#99a8bc', accent: '#3b82f6', yellow: '#facc15', danger: '#fb7185', border: '#2a394d' };

export function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}
export function Row({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.label}>{label}</Text><Text selectable style={styles.value}>{value}</Text></View>;
}
export function Button({ title, onPress, disabled, secondary }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, (disabled || pressed) && styles.buttonDim]}>
    {disabled ? <ActivityIndicator color={colors.text} /> : <Text style={styles.buttonText}>{title}</Text>}
  </Pressable>;
}
export function Field(props: TextInputProps & { label: string; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{props.label}</Text><TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.multiline && styles.multiline, props.style]} /></View>;
}
export function Message({ children, error }: PropsWithChildren<{ error?: boolean }>) {
  return <View style={[styles.message, error && styles.errorMessage]}><Text style={styles.messageText}>{children}</Text></View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, content: { width: '100%', maxWidth: 1180, alignSelf: 'center', padding: 16, gap: 14 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' }, subtitle: { color: colors.muted, fontSize: 14 },
  section: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  sectionTitle: { color: colors.text, fontWeight: '800', fontSize: 18, marginBottom: 4 }, row: { gap: 3, paddingVertical: 4 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }, value: { color: colors.text, fontSize: 16 },
  button: { minHeight: 46, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { backgroundColor: colors.panel2, borderColor: colors.border, borderWidth: 1 }, buttonText: { color: '#fff', fontWeight: '800' }, buttonDim: { opacity: 0.55 },
  field: { gap: 6 }, input: { color: colors.text, backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1, borderRadius: 9, padding: 12, fontSize: 16 }, multiline: { minHeight: 100, textAlignVertical: 'top' },
  message: { backgroundColor: '#183357', borderRadius: 9, padding: 12 }, errorMessage: { backgroundColor: '#4a1d29' }, messageText: { color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }
});
