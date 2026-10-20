import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppShell } from '@/components/app-shell';
import { Button, colors, Field, Message, styles as ui } from '@/components/ui';
import { api } from '@/lib/api';
import { bucharestDate } from '@/lib/format';
import { Driver, DriverHoursOverview, DriverQuestion } from '@/types/vehicle';

const minutes = (value?: number | null) => {
  if (value === null || value === undefined) return 'Necunoscut';
  const hours = Math.floor(value / 60); const rest = value % 60;
  return hours ? `${hours} h ${rest} min` : `${rest} min`;
};
const confidence = { HIGH: 'Ridicată', MEDIUM: 'Medie', LOW: 'Scăzută' } as const;
type Calibration = { untilBreak: string; daily: string; weekly: string; fortnight: string; deadline: string; canDrive: boolean };

export default function DriverHoursScreen() {
  const [data, setData] = useState<DriverHoursOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calibrating, setCalibrating] = useState<Driver | null>(null);
  const [calibration, setCalibration] = useState<Calibration>({ untilBreak: '', daily: '', weekly: '', fortnight: '', deadline: '', canDrive: true });
  const { width } = useWindowDimensions();
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.driverHours(true)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Programul șoferilor nu poate fi calculat.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return undefined; }, [load]));
  const sync = async () => {
    setSyncing(true); setError(null);
    try { setData(await api.syncDriverHours()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Istoricul GPS nu a putut fi sincronizat.'); }
    finally { setSyncing(false); }
  };
  const answer = async (question: DriverQuestion, value: unknown) => {
    setError(null);
    try { await api.answerDriverQuestion(question.id, value); setData(await api.driverHours(false)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Răspunsul nu a putut fi salvat.'); }
  };
  const openCalibration = (driver: Driver) => {
    const snapshot = driver.hoursSnapshot;
    setCalibrating(driver);
    setCalibration({
      untilBreak: snapshot ? String(snapshot.untilNextBreakMinutes) : '',
      daily: snapshot ? String(snapshot.dailyDrivingRemainingMinutes) : '',
      weekly: snapshot ? String(snapshot.weeklyDrivingRemainingMinutes) : '',
      fortnight: snapshot ? String(snapshot.fortnightDrivingRemainingMinutes) : '',
      deadline: snapshot?.dailyRestDeadline?.slice(0, 16) ?? '',
      canDrive: snapshot?.canDriveNow ?? true
    });
  };
  const saveCalibration = async () => {
    if (!calibrating) return;
    setSyncing(true); setError(null);
    const numberOrNull = (value: string) => value.trim() ? Number(value) : null;
    try {
      await api.calibrateDriver(calibrating.id, {
        effectiveAt: new Date().toISOString(), canDriveNow: calibration.canDrive,
        untilNextBreakMinutes: numberOrNull(calibration.untilBreak),
        dailyDrivingRemainingMinutes: numberOrNull(calibration.daily),
        weeklyDrivingRemainingMinutes: numberOrNull(calibration.weekly),
        fortnightDrivingRemainingMinutes: numberOrNull(calibration.fortnight),
        dailyRestDeadline: calibration.deadline ? new Date(calibration.deadline).toISOString() : null
      });
      setCalibrating(null); setData(await api.driverHours(false));
    } catch (e) { setError(e instanceof Error ? e.message : 'Calibrarea nu a putut fi salvată.'); }
    finally { setSyncing(false); }
  };
  const clearCalibration = async () => {
    if (!calibrating) return;
    setSyncing(true); setError(null);
    try {
      await api.clearDriverCalibration(calibrating.id);
      setCalibrating(null); setData(await api.driverHours(false));
    } catch (e) { setError(e instanceof Error ? e.message : 'Calibrarea nu a putut fi eliminată.'); }
    finally { setSyncing(false); }
  };

  const questionCount = data?.questions.length ?? 0;
  return <AppShell active="hours" title="Program șoferi" subtitle="Estimare din istoricul GPS și confirmări curente" action={<Button disabled={syncing} title={syncing ? 'Se sincronizează…' : 'Recalculează'} onPress={() => void sync()} />}>
    <ScrollView contentContainerStyle={ui.content}>
      <View style={page.notice}><Ionicons name="information-circle-outline" size={22} color="#93c5fd" /><Text style={page.noticeText}>Aceste valori sunt estimări operaționale bazate pe GPS, nu înlocuiesc tahograful și nu trebuie folosite ca dovadă legală. Confirmările managerului ridică precizia situației curente.</Text></View>
      {error && <Message error>{error}</Message>}
      {data?.syncWarnings.map((warning) => <Message key={warning.vehicleId} error>{warning.registrationNumber}: {warning.message ?? 'Istoricul GPS nu a putut fi sincronizat.'}</Message>)}
      {questionCount > 0 && <View style={page.questions}>
        <View style={page.sectionHead}><View><Text style={page.sectionTitle}>Necesită confirmare</Text><Text style={page.sectionSub}>{questionCount} {questionCount === 1 ? 'întrebare activă' : 'întrebări active'} · numai despre situația actuală</Text></View><View style={page.count}><Text style={page.countText}>{questionCount}</Text></View></View>
        {data?.questions.map((question) => <QuestionCard key={question.id} question={question} drivers={data.drivers} onAnswer={(value) => void answer(question, value)} />)}
      </View>}
      <View style={page.sectionHead}><View><Text style={page.sectionTitle}>Situația șoferilor</Text><Text style={page.sectionSub}>Ultima calculare: {data ? bucharestDate(data.computedAt) : '—'}</Text></View><Pressable onPress={() => router.push('/drivers')} style={page.manage}><Ionicons name="people-outline" color="#93c5fd" size={18} /><Text style={page.manageText}>Gestionează șoferii</Text></Pressable></View>
      {loading ? <ActivityIndicator color={colors.accent} size="large" /> : <View style={[page.grid, width < 760 && page.gridMobile]}>{data?.drivers.map((driver) => <DriverCard key={driver.id} driver={driver} onCalibrate={() => openCalibration(driver)} onOpenVehicle={(id) => router.push(`/vehicles/${id}`)} />)}</View>}
      {!loading && !data?.drivers.length && <View style={page.empty}><Ionicons name="people-outline" size={30} color={colors.muted} /><Text style={page.emptyText}>Nu există șoferi. Creează-i și asignează-i vehiculelor din secțiunea Șoferi.</Text><Button title="Deschide Șoferi" onPress={() => router.push('/drivers')} /></View>}
    </ScrollView>
    <Modal visible={Boolean(calibrating)} transparent animationType="fade" onRequestClose={() => setCalibrating(null)}>
      <View style={page.backdrop}><SafeAreaView style={page.modal}><ScrollView contentContainerStyle={page.modalBody}>
        <View style={page.sectionHead}><View><Text style={page.modalTitle}>Calibrare sigură</Text><Text style={page.sectionSub}>{calibrating?.name}</Text></View><Pressable onPress={() => setCalibrating(null)}><Ionicons name="close" size={25} color={colors.text} /></Pressable></View>
        <Text style={page.noticeText}>Folosește valorile cunoscute acum. Calibrarea curentă o înlocuiește pe cea anterioară; nu păstrăm un istoric al corecțiilor.</Text>
        <View style={page.toggle}><Text style={page.toggleLabel}>Poate conduce acum</Text><View style={page.toggleActions}><Pressable onPress={() => setCalibration({ ...calibration, canDrive: true })} style={[page.choice, calibration.canDrive && page.choiceActive]}><Text style={page.choiceText}>Da</Text></Pressable><Pressable onPress={() => setCalibration({ ...calibration, canDrive: false })} style={[page.choice, !calibration.canDrive && page.choiceActive]}><Text style={page.choiceText}>Nu</Text></Pressable></View></View>
        <Field label="Minute până la pauza de 45 min" keyboardType="number-pad" value={calibration.untilBreak} onChangeText={(untilBreak) => setCalibration({ ...calibration, untilBreak })} />
        <Field label="Minute disponibile astăzi" keyboardType="number-pad" value={calibration.daily} onChangeText={(daily) => setCalibration({ ...calibration, daily })} />
        <Field label="Minute disponibile săptămâna aceasta" keyboardType="number-pad" value={calibration.weekly} onChangeText={(weekly) => setCalibration({ ...calibration, weekly })} />
        <Field label="Minute disponibile în două săptămâni" keyboardType="number-pad" value={calibration.fortnight} onChangeText={(fortnight) => setCalibration({ ...calibration, fortnight })} />
        <Field label="Repausul trebuie început până la (data ISO)" placeholder="2026-10-20T21:30" value={calibration.deadline} onChangeText={(deadline) => setCalibration({ ...calibration, deadline })} />
        <View style={ui.actions}><Button secondary title="Revino la estimarea GPS" onPress={() => void clearCalibration()} disabled={syncing} /><Button secondary title="Anulează" onPress={() => setCalibrating(null)} /><Button disabled={syncing} title="Salvează calibrarea" onPress={() => void saveCalibration()} /></View>
      </ScrollView></SafeAreaView></View>
    </Modal>
  </AppShell>;
}

function DriverCard({ driver, onCalibrate, onOpenVehicle }: { driver: Driver; onCalibrate: () => void; onOpenVehicle: (id: string) => void }) {
  const snapshot = driver.hoursSnapshot;
  const assignment = driver.activeAssignments?.[0];
  const confidenceColor = snapshot?.confidence === 'HIGH' ? colors.success : snapshot?.confidence === 'MEDIUM' ? colors.orange : colors.danger;
  return <View style={page.card}>
    <View style={page.cardTop}><View style={{ flex: 1, minWidth: 0 }}><Text style={page.driverName}>{driver.name}</Text><Pressable disabled={!assignment} onPress={() => assignment && onOpenVehicle(assignment.vehicleId)}><Text style={page.vehicleLink}>{assignment?.vehicle.registrationNumber ?? 'Neasignat unui vehicul'}</Text></Pressable></View><View style={[page.canDrive, { backgroundColor: snapshot?.canDriveNow ? '#12583f' : '#662530' }]}><Text style={page.canDriveText}>{snapshot?.canDriveNow ? 'POATE CONDUCE' : 'NU POATE CONDUCE'}</Text></View></View>
    {snapshot ? <>
      <Metric icon="cafe-outline" label="Până la pauza de 45 min" value={minutes(snapshot.untilNextBreakMinutes)} />
      <Metric icon="today-outline" label="Condus disponibil astăzi" value={minutes(snapshot.dailyDrivingRemainingMinutes)} />
      <Metric icon="calendar-outline" label="Disponibil săptămâna aceasta" value={minutes(snapshot.weeklyDrivingRemainingMinutes)} />
      <Metric icon="moon-outline" label="Repaus zilnic până la" value={snapshot.dailyRestDeadline ? bucharestDate(snapshot.dailyRestDeadline) : 'Necunoscut'} />
      <View style={page.confidence}><View style={[page.dot, { backgroundColor: confidenceColor }]} /><Text style={page.confidenceText}>Încredere {confidence[snapshot.confidence]} · {snapshot.source === 'MANAGER_CONFIRMATION' ? 'confirmat de manager' : 'estimat GPS'}</Text></View>
    </> : <Text style={page.noData}>Nu există încă suficiente date. Apasă Recalculează.</Text>}
    <Button secondary title="Calibrează situația" onPress={onCalibrate} />
  </View>;
}

function Metric({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={page.metric}><View style={page.metricIcon}><Ionicons name={icon} color="#93c5fd" size={18} /></View><View style={{ flex: 1 }}><Text style={page.metricLabel}>{label}</Text><Text style={page.metricValue}>{value}</Text></View></View>;
}

function QuestionCard({ question, drivers, onAnswer }: { question: DriverQuestion; drivers: Driver[]; onAnswer: (value: unknown) => void }) {
  const vehicleDrivers = question.vehicleId
    ? drivers.filter((driver) => driver.activeAssignments?.some((assignment) => assignment.vehicleId === question.vehicleId)) : [];
  return <View style={[page.question, question.priority === 'URGENT' && page.questionUrgent]}><View style={{ flex: 1, minWidth: 0 }}><Text style={page.questionTitle}>{question.title}</Text><Text style={page.questionDetail}>{question.detail}</Text></View><View style={page.questionActions}>
    {question.type === 'WHO_IS_DRIVING' ? vehicleDrivers.map((driver) => <Pressable key={driver.id} onPress={() => onAnswer(driver.id)} style={page.answer}><Text style={page.answerText}>{driver.name}</Text></Pressable>) : <><Pressable onPress={() => onAnswer(true)} style={page.answer}><Text style={page.answerText}>Da</Text></Pressable><Pressable onPress={() => onAnswer(false)} style={page.answer}><Text style={page.answerText}>Nu</Text></Pressable></>}
  </View></View>;
}

const page = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: '#254d7e', backgroundColor: '#10243d' }, noticeText: { flex: 1, color: '#bdcbe0', lineHeight: 19, fontSize: 12 },
  questions: { gap: 10, padding: 15, borderRadius: 14, borderWidth: 1, borderColor: '#705616', backgroundColor: '#2d2510' }, sectionHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '900' }, sectionSub: { color: colors.muted, fontSize: 12, marginTop: 3 }, count: { minWidth: 30, height: 30, borderRadius: 15, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' }, countText: { color: '#111827', fontWeight: '900' },
  question: { padding: 13, borderRadius: 11, backgroundColor: '#3a3014', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }, questionUrgent: { borderWidth: 1, borderColor: colors.danger }, questionTitle: { color: colors.text, fontWeight: '900' }, questionDetail: { color: '#d6cba9', fontSize: 12, marginTop: 4, lineHeight: 17 }, questionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, answer: { minHeight: 38, paddingHorizontal: 14, borderRadius: 9, backgroundColor: '#735a17', alignItems: 'center', justifyContent: 'center' }, answerText: { color: '#fff', fontWeight: '900' },
  manage: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10 }, manageText: { color: '#93c5fd', fontWeight: '800', fontSize: 12 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, gridMobile: { flexDirection: 'column' }, card: { flexGrow: 1, flexBasis: 390, maxWidth: 600, gap: 11, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, driverName: { color: colors.text, fontSize: 19, fontWeight: '900' }, vehicleLink: { color: '#93c5fd', fontSize: 12, fontWeight: '800', marginTop: 3 }, canDrive: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8 }, canDriveText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  metric: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 5 }, metricIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#173354', alignItems: 'center', justifyContent: 'center' }, metricLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }, metricValue: { color: colors.text, fontWeight: '800', marginTop: 2 }, confidence: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 7, borderTopWidth: 1, borderTopColor: colors.border }, dot: { width: 8, height: 8, borderRadius: 4 }, confidenceText: { color: colors.muted, fontSize: 11 }, noData: { color: colors.muted, lineHeight: 19 }, empty: { alignItems: 'center', gap: 14, padding: 30 }, emptyText: { color: colors.muted, maxWidth: 480, textAlign: 'center', lineHeight: 20 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.76)', justifyContent: 'center', padding: 14 }, modal: { width: '100%', maxWidth: 650, maxHeight: '92%', alignSelf: 'center', borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel }, modalBody: { padding: 18, gap: 14 }, modalTitle: { color: colors.text, fontSize: 21, fontWeight: '900' }, toggle: { gap: 7 }, toggleLabel: { color: colors.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }, toggleActions: { flexDirection: 'row', gap: 8 }, choice: { minWidth: 72, padding: 11, borderRadius: 9, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }, choiceActive: { backgroundColor: colors.accent, borderColor: colors.accent }, choiceText: { color: colors.text, fontWeight: '900' }
});
