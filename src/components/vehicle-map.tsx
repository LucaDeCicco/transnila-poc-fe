import { StyleSheet, Text, View } from 'react-native';
import { colors } from './ui';
import { MapConfig, Vehicle, VehicleRoute } from '../types/vehicle';

export function VehicleMap({ height = 420 }: {
  config: MapConfig; vehicles: Vehicle[]; selectedVehicleId: string | null; route: VehicleRoute | null;
  onVehiclePress: (id: string) => void;
  height?: number;
  fitFleet?: boolean;
}) {
  return <View style={[styles.fallback, { height }]}><Text style={styles.text}>Harta interactivă este disponibilă momentan în versiunea web.</Text></View>;
}

const styles = StyleSheet.create({
  fallback: { height: 420, borderRadius: 12, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 20 },
  text: { color: colors.muted, textAlign: 'center' }
});
