import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthProvider, useAuth } from '@/auth/auth-context';
import { colors } from '@/components/ui';

export default function RootLayout() {
  return <AuthProvider><AccessGate /></AuthProvider>;
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
