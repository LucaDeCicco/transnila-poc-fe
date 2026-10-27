import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/components/ui';

export default function RootLayout() {
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
