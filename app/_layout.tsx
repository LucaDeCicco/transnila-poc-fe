import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthProvider, useAuth } from '@/auth/auth-context';
import { colors } from '@/components/ui';

const TEMPORARY_LOCKDOWN = true;

export default function RootLayout() {
  if (TEMPORARY_LOCKDOWN) return <TemporaryLockdownScreen />;
  return <AuthProvider><AccessGate /></AuthProvider>;
}

function TemporaryLockdownScreen() {
  return <View style={lockdown.screen}>
    <StatusBar style="light" />
    <ScrollView contentContainerStyle={lockdown.scroll}>
      <View style={lockdown.card}>
        <Text style={lockdown.name}>Cristi (82.76.153.75),</Text>
        <Text style={lockdown.paragraph}>Nu știu pe cine ai vrut să impresionezi folosind un instrument (Grafana k6/2.3.0) pentru un test de stres asupra unei aplicații aflate la nivel de PoC. După cum ai observat, nu a trebuit să faci nimic special pentru a avea acces la informațiile din interfață. Cred că era destul de clar pentru oricine că aplicația nu avea încă implementate măsuri de securitate.</Text>
        <Text style={lockdown.paragraph}>Este, până la urmă, un PoC — o demonstrație a ceea ce putem construi pentru a vă ușura munca. În loc să te bucuri de instrument sau, de ce nu, să ne oferi sugestii pentru a-l îmbunătăți, ai preferat să încerci să ne impresionezi cu un test de stres.</Text>
        <Text style={lockdown.paragraph}>Hai să vorbim și despre impactul lui. Acum este unul nesemnificativ, deoarece folosim un plan gratuit și nu avem niciun card asociat serviciului. Dar să presupunem că aș fi avut activată facturarea pay-as-you-go. Eu aș fi stat liniștit, considerând că aplicația este doar „între noi” și neimaginându-mi că unul dintre noi s-ar trezi să ne saboteze chiar pe noi. În acest caz, aș fi ajuns să plătesc pentru „demonstrația” ta.</Text>
        <Text style={lockdown.paragraph}>Sincer, nu te pot înțelege. Mai mult, cred că nici tu nu ai înțeles că scopul acestui proiect este să îți ușureze ție munca.</Text>
        <Text style={lockdown.conclusion}>Ești mare om!</Text>
      </View>
    </ScrollView>
  </View>;
}

function AccessGate() {
  const auth = useAuth();
  if (auth.state === 'checking') return <Gate><ActivityIndicator size="large" color={colors.accent} /><Text style={gate.subtitle}>Verificăm accesul…</Text></Gate>;
  if (auth.state === 'blocked') return <Gate><Text style={gate.blocked}>De ce esti ratat ?</Text></Gate>;
  if (auth.state === 'unauthenticated') return <LoginScreen />;
  return <>
    <StatusBar style="light" />
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.panel }, headerTintColor: colors.text, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="map" options={{ headerShown: false }} />
      <Stack.Screen name="availability" options={{ headerShown: false }} />
      <Stack.Screen name="attention" options={{ headerShown: false }} />
      <Stack.Screen name="find-work" options={{ headerShown: false }} />
      <Stack.Screen name="vehicles/index" options={{ headerShown: false }} />
      <Stack.Screen name="vehicles/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="trips/new" options={{ headerShown: false }} />
    </Stack>
  </>;
}

function LoginScreen() {
  const auth = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (!username.trim() || !password || submitting) return;
    setSubmitting(true);
    try { await auth.login(username.trim(), password); }
    catch { /* The provider exposes a safe error message. */ }
    finally { setSubmitting(false); }
  };
  return <Gate>
    <View style={gate.card}>
      <Text style={gate.eyebrow}>TRANȘNILĂ · ACCES INTERN</Text>
      <Text style={gate.title}>Autentificare</Text>
      <Text style={gate.subtitle}>Introdu credentialele temporare pentru a accesa aplicația.</Text>
      <TextInput autoCapitalize="none" autoCorrect={false} autoComplete="username" placeholder="Utilizator" placeholderTextColor={colors.muted} value={username} onChangeText={setUsername} style={gate.input} />
      <TextInput autoCapitalize="none" autoCorrect={false} autoComplete="current-password" secureTextEntry placeholder="Parolă" placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} onSubmitEditing={() => void submit()} style={gate.input} />
      {auth.error && <Text style={gate.error}>{auth.error}</Text>}
      <Pressable accessibilityRole="button" disabled={submitting || !username.trim() || !password} onPress={() => void submit()} style={({ pressed }) => [gate.button, (pressed || submitting || !username.trim() || !password) && gate.buttonDisabled]}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={gate.buttonText}>Intră în aplicație</Text>}
      </Pressable>
    </View>
  </Gate>;
}

function Gate({ children }: { children: React.ReactNode }) {
  return <View style={gate.screen}><StatusBar style="light" /><View style={gate.center}>{children}</View></View>;
}

const gate = StyleSheet.create({
  screen: { flex: 1, minHeight: '100%', backgroundColor: colors.bg },
  center: { flex: 1, width: '100%', maxWidth: 460, alignSelf: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  card: { width: '100%', padding: 26, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, gap: 14 },
  eyebrow: { color: '#60a5fa', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.bg, color: colors.text, paddingHorizontal: 14, fontSize: 16 },
  button: { minHeight: 50, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: .55 }, buttonText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  error: { color: '#fecdd3', backgroundColor: '#4a1d29', borderRadius: 9, padding: 11 },
  blocked: { color: colors.danger, fontSize: 34, lineHeight: 42, fontWeight: '900', textAlign: 'center' }
});

const lockdown = StyleSheet.create({
  screen: { flex: 1, minHeight: '100%', backgroundColor: '#080b10' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 48 },
  card: { width: '100%', maxWidth: 820, alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 32, borderRadius: 18, borderWidth: 1, borderColor: '#263241', backgroundColor: '#101722', gap: 18 },
  name: { color: '#f8fafc', fontSize: 32, lineHeight: 39, fontWeight: '900' },
  paragraph: { color: '#d1d5db', fontSize: 17, lineHeight: 28 },
  conclusion: { marginTop: 8, color: '#f8fafc', fontSize: 25, lineHeight: 32, fontWeight: '900' }
});
