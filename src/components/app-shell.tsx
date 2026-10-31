import { ComponentProps, PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { colors } from './ui';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/auth-context';
import { TripSearchResult } from '@/types/vehicle';

type IconName = ComponentProps<typeof Ionicons>['name'];
export type AppSection = 'operations' | 'findWork' | 'map' | 'vehicles' | 'availability' | 'drivers' | 'attention';

const navigation: { key: AppSection; label: string; compactLabel?: string; icon: IconName; route: Href; mobile?: boolean }[] = [
  { key: 'operations', label: 'Operațiuni', icon: 'grid-outline', route: '/' },
  { key: 'findWork', label: 'Găsește curse', compactLabel: 'Oferte', icon: 'briefcase-outline', route: '/find-work' },
  { key: 'map', label: 'Hartă', icon: 'map-outline', route: '/map' },
  { key: 'vehicles', label: 'Vehicule', icon: 'car-outline', route: '/vehicles' },
  { key: 'drivers', label: 'Șoferi', icon: 'people-outline', route: '/drivers', mobile: false },
  { key: 'availability', label: 'Mesaj', icon: 'chatbubble-ellipses-outline', route: '/availability', mobile: false },
  { key: 'attention', label: 'Necesită atenție', compactLabel: 'Mai mult', icon: 'ellipsis-horizontal-circle-outline', route: '/attention' }
];

export function AppShell({ active, title, subtitle, action, back, children }: PropsWithChildren<{
  active: AppSection;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  back?: boolean;
}>) {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const router = useRouter();
  const { logout } = useAuth();

  const navigate = (route: Href) => router.push(route);
  return <View style={shell.root}>
    {desktop && <View style={shell.sidebar}>
      <View style={shell.brandMark}><Text style={shell.brandLetter}>T</Text></View>
      <View style={shell.brandCopy}><Text style={shell.brand}>Transnila</Text><Text style={shell.brandSub}>Fleet Control</Text></View>
      <Pressable onPress={() => navigate('/trips/new')} style={shell.newTrip}><Ionicons name="add-circle-outline" color="#fff" size={20} /><Text style={shell.newTripText}>Cursă nouă</Text></Pressable>
      <View style={shell.navigation}>{navigation.map((item) => <NavItem key={item.key} active={active === item.key} icon={item.icon} label={item.label} onPress={() => navigate(item.route)} />)}</View>
      <View style={shell.poc}><Ionicons name="flask-outline" color={colors.muted} size={17} /><Text style={shell.pocText}>Versiune POC</Text></View>
    </View>}
    <View style={shell.main}>
      <View style={shell.topbar}>
        <View style={shell.headingRow}>
          {back && <Pressable accessibilityLabel="Înapoi" onPress={() => router.back()} style={({ pressed }) => [shell.back, pressed && shell.pressed]}><Ionicons name="arrow-back" size={24} color={colors.text} /></Pressable>}
          {!desktop && !back && <View style={shell.mobileBrand}><Text style={shell.mobileBrandText}>T</Text></View>}
          <View style={shell.headingCopy}><Text numberOfLines={1} style={shell.title}>{title}</Text>{subtitle && <Text numberOfLines={2} style={shell.subtitle}>{subtitle}</Text>}</View>
        </View>
        {action && <View style={shell.action}>{action}</View>}
      </View>
      <GlobalTools desktop={desktop} onNew={() => navigate('/trips/new')} onOpen={(id) => navigate(`/vehicles/${id}`)} onLogout={logout} />
      <View style={[shell.body, !desktop && shell.mobileBody]}>{children}</View>
      {!desktop && <View style={shell.bottomNav}>{navigation.filter((item) => item.mobile !== false).map((item) => {
        const selected = active === item.key;
        return <Pressable key={item.key} accessibilityRole="button" onPress={() => navigate(item.route)} style={({ pressed }) => [shell.bottomItem, pressed && shell.pressed]}>
          <View style={[shell.bottomIcon, selected && shell.bottomIconActive]}><Ionicons name={item.icon} size={21} color={selected ? '#fff' : colors.muted} /></View>
          <Text numberOfLines={1} style={[shell.bottomLabel, selected && shell.bottomLabelActive]}>{item.compactLabel ?? item.label}</Text>
        </Pressable>;
      })}</View>}
    </View>
  </View>;
}

function GlobalTools({ desktop, onNew, onOpen, onLogout }: { desktop: boolean; onNew: () => void; onOpen: (id: string) => void; onLogout: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TripSearchResult[]>([]);
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const timer = setTimeout(() => api.search(query).then(setResults).catch(() => setResults([])), 250);
    return () => clearTimeout(timer);
  }, [query]);
  return <View style={shell.globalTools}>
    <View style={shell.globalSearch}><Ionicons name="search-outline" size={18} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Caută comandă, referință sau număr…" placeholderTextColor={colors.muted} style={shell.globalInput} />{query ? <Pressable onPress={() => { setQuery(''); setResults([]); }}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
      {results.length > 0 && <View style={shell.searchResults}>{results.map((item) => <Pressable key={item.vehicleId} onPress={() => { setQuery(''); setResults([]); onOpen(item.vehicleId); }} style={shell.searchResult}><View style={{ flex: 1 }}><Text style={shell.resultTitle}>{item.registrationNumber}{item.orderNumber ? ` · ${item.orderNumber}` : ''}</Text><Text style={shell.resultText}>{item.clientName ?? item.driverName ?? 'Fără detalii comandă'}</Text></View><Ionicons name="arrow-forward" size={17} color={colors.muted} /></Pressable>)}</View>}
    </View>
    {!desktop && <Pressable accessibilityLabel="Cursă nouă" onPress={onNew} style={shell.compactNew}><Ionicons name="add" size={23} color="#fff" /></Pressable>}
    <Pressable accessibilityLabel="Ieșire din aplicație" onPress={onLogout} style={shell.logout}><Ionicons name="log-out-outline" size={21} color={colors.muted} />{desktop && <Text style={shell.logoutText}>Ieșire</Text>}</Pressable>
  </View>;
}

function NavItem({ active, icon, label, onPress }: { active: boolean; icon: IconName; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [shell.navItem, active && shell.navItemActive, pressed && shell.pressed]}>
    <Ionicons name={icon} color={active ? '#fff' : colors.muted} size={21} />
    <Text style={[shell.navText, active && shell.navTextActive]}>{label}</Text>
  </Pressable>;
}

const shell = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  sidebar: { width: 238, paddingHorizontal: 16, paddingVertical: 22, backgroundColor: '#101722', borderRightWidth: 1, borderRightColor: colors.border },
  brandMark: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  brandLetter: { color: '#fff', fontWeight: '900', fontSize: 21 }, brandCopy: { marginTop: 12 },
  brand: { color: colors.text, fontWeight: '900', fontSize: 20 }, brandSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  newTrip: { marginTop: 18, minHeight: 44, borderRadius: 10, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, newTripText: { color: '#fff', fontWeight: '900' },
  navigation: { marginTop: 30, gap: 7 }, navItem: { minHeight: 46, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  navItemActive: { backgroundColor: '#1e3a63' }, navText: { color: colors.muted, fontWeight: '700' }, navTextActive: { color: '#fff' },
  poc: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }, pocText: { color: colors.muted, fontSize: 12 },
  main: { flex: 1, minWidth: 0 }, topbar: { minHeight: 76, paddingHorizontal: 22, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: '#101722', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headingRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 }, headingCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 }, action: { flexShrink: 0 },
  back: { width: 42, height: 42, borderRadius: 10, backgroundColor: colors.panel2, alignItems: 'center', justifyContent: 'center' },
  mobileBrand: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }, mobileBrandText: { color: '#fff', fontWeight: '900', fontSize: 19 },
  globalTools: { minHeight: 60, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', gap: 9, alignItems: 'center', backgroundColor: '#0d141e', borderBottomWidth: 1, borderBottomColor: colors.border, zIndex: 20 },
  globalSearch: { flex: 1, maxWidth: 720, minHeight: 42, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, position: 'relative' }, globalInput: { flex: 1, color: colors.text, minWidth: 0, paddingVertical: 8 },
  searchResults: { position: 'absolute', left: 0, right: 0, top: 45, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel2, overflow: 'hidden', zIndex: 50, elevation: 10 }, searchResult: { minHeight: 54, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }, resultTitle: { color: colors.text, fontWeight: '900' }, resultText: { color: colors.muted, fontSize: 11, marginTop: 2 }, compactNew: { width: 42, height: 42, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  logout: { minHeight: 42, paddingHorizontal: 11, borderRadius: 10, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, logoutText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  body: { flex: 1, minHeight: 0 }, mobileBody: { paddingBottom: 70 },
  bottomNav: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 68, paddingTop: 7, paddingBottom: 5, paddingHorizontal: 4, flexDirection: 'row', backgroundColor: '#101722', borderTopWidth: 1, borderTopColor: colors.border },
  bottomItem: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2 }, bottomIcon: { minWidth: 38, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, bottomIconActive: { backgroundColor: colors.accent },
  bottomLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', maxWidth: '100%' }, bottomLabelActive: { color: colors.text },
  pressed: { opacity: 0.68 }
});
