import { StyleSheet, Text, View } from 'react-native';
import { MapConfig } from '../types/vehicle';
import { colors } from './ui';

export function LocationPreviewMap({ latitude, longitude, approximate, height = 180 }: {
  config: MapConfig; latitude: number; longitude: number; approximate: boolean; height?: number;
}) {
  return <View style={[styles.box, { height }]}><Text style={styles.title}>{approximate ? 'Pin aproximativ' : 'Pin exact'}</Text><Text style={styles.text}>{latitude.toFixed(6)}, {longitude.toFixed(6)}</Text><Text style={styles.text}>Minimapa interactivă este disponibilă în versiunea web.</Text></View>;
}

const styles = StyleSheet.create({
  box: { borderRadius: 12, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 18, gap: 6 },
  title: { color: colors.text, fontWeight: '900' }, text: { color: colors.muted, textAlign: 'center' }
});
