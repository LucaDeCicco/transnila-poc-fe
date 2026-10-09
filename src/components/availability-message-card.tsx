import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { bucharestDate } from '../lib/format';
import { AvailabilityMessageResponse } from '../types/vehicle';
import { Button, colors, Message, Section, styles as ui } from './ui';

export function AvailabilityMessageCard({ data, loading, refreshing, error, onRefresh }: {
  data: AvailabilityMessageResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!data) return;
    await Clipboard.setStringAsync(data.message);
    setCopied(true);
  };

  return <Section title="Mesaj disponibilitate">
    <Text style={ui.subtitle}>Mesaj pregătit pentru grupurile WhatsApp, generat din vehiculele active și disponibile.</Text>
    {loading && !data ? <ActivityIndicator color={colors.accent} /> : data && <>
      <View style={card.preview}><Text selectable style={card.message}>{data.message}</Text></View>
      <Text style={card.meta}>{data.includedVehicles} vehicule incluse · generat {bucharestDate(data.generatedAt)}</Text>
      {data.incompleteVehicles > 0 && <Message error>{data.incompleteVehicles} vehicule disponibile au modelul, țara sau locația incompletă și nu au fost incluse.</Message>}
    </>}
    {error && <Message error>{error}</Message>}
    {copied && <Message>Mesajul a fost copiat. Îl poți lipi direct în WhatsApp.</Message>}
    <View style={ui.actions}>
      <Button title="Actualizează mesajul" onPress={() => { setCopied(false); onRefresh(); }} disabled={refreshing} />
      {data && <Button secondary title={copied ? 'Copiat' : 'Copiază pentru WhatsApp'} onPress={() => void copy()} />}
    </View>
  </Section>;
}

const card = StyleSheet.create({
  preview: { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 14 },
  message: { color: colors.text, fontSize: 15, lineHeight: 23 },
  meta: { color: colors.muted, fontSize: 12 }
});
