import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { availability } from '../lib/format';
import { statusTone } from '../lib/vehicle';
import { Availability } from '../types/vehicle';
import { colors } from './ui';

export function StatusBadge({ value, compact = false }: { value: Availability | null; compact?: boolean }) {
  const tone = statusTone(value);
  return <View style={[styles.status, { backgroundColor: tone.badge }, compact && styles.statusCompact]}>
    <View style={[styles.dot, { backgroundColor: tone.accent }]} /><Text style={styles.statusText}>{availability(value)}</Text>
  </View>;
}

export function SearchField({ value, onChange, placeholder = 'Caută după numărul de înmatriculare…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <View style={styles.search}>
    <Ionicons name="search" size={20} color={colors.muted} />
    <TextInput accessibilityLabel={placeholder} autoCapitalize="characters" autoCorrect={false} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.muted} returnKeyType="search" style={styles.searchInput} value={value} />
    {value.length > 0 && <Pressable accessibilityLabel="Șterge căutarea" hitSlop={10} onPress={() => onChange('')}><Ionicons name="close-circle" size={22} color={colors.muted} /></Pressable>}
  </View>;
}

export function FilterChip({ label, active, onPress, count }: { label: string; active: boolean; onPress: () => void; count?: number }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: .7 }]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>{count !== undefined && <Text style={[styles.chipCount, active && styles.chipCountActive]}>{count}</Text>}
  </Pressable>;
}

export function MetricCard({ label, value, tone, active, onPress, icon }: { label: string; value: number; tone: string; active?: boolean; onPress?: () => void; icon: ReactNode }) {
  const content = <><View style={[styles.metricIcon, { backgroundColor: `${tone}22` }]}>{icon}</View><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></>;
  if (!onPress) return <View style={[styles.metric, active && { borderColor: tone }]}>{content}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.metric, active && { borderColor: tone, backgroundColor: `${tone}12` }, pressed && { opacity: .75 }]}>{content}</Pressable>;
}

export function EmptyState({ icon = 'file-tray-outline', title, detail, action }: { icon?: keyof typeof Ionicons.glyphMap; title: string; detail: string; action?: ReactNode }) {
  return <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name={icon} size={28} color={colors.muted} /></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{detail}</Text>{action}</View>;
}

const styles = StyleSheet.create({
  status: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, statusCompact: { paddingVertical: 5, paddingHorizontal: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 }, statusText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  search: { minHeight: 48, minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.panel, paddingHorizontal: 13 },
  searchInput: { flex: 1, minWidth: 0, color: colors.text, fontSize: 15, paddingVertical: 10, outlineStyle: 'none' } as never,
  chip: { minHeight: 38, paddingHorizontal: 12, borderRadius: 19, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 7 }, chipActive: { backgroundColor: '#1e3a63', borderColor: colors.accent },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, chipTextActive: { color: '#fff' }, chipCount: { color: colors.muted, fontSize: 11, fontWeight: '900' }, chipCountActive: { color: '#bfdbfe' },
  metric: { minWidth: 138, flex: 1, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 }, metricIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  metricValue: { color: colors.text, fontSize: 25, fontWeight: '900' }, metricLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 3 },
  empty: { minHeight: 240, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 }, emptyIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.panel2, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' }, emptyText: { color: colors.muted, textAlign: 'center', maxWidth: 430, lineHeight: 20 }
});
