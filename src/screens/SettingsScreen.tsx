import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppNavigation } from '../navigation';

import { BookIcon, ChevronRight, CrownIcon, SettingsIcon, TrashIcon } from '../components/icons';
import { appAlert } from '../lib/alert';
import { openLegalLink } from '../lib/links';
import { purchaseErrorMessage, restorePurchases } from '../lib/purchases';
import { colors, radius, typography } from '../theme/tokens';
import { useApp } from '../state/AppProvider';

export function SettingsScreen() {
  const navigation = useAppNavigation();
  const { profile, isPro, solutions, resetAll, setPro } = useApp();
  const [restoring, setRestoring] = useState(false);

  const confirmReset = () => {
    Alert.alert('Delete all data?', 'Your history, chat and profile will be removed from this device. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => resetAll() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={typography.h2}>Settings</Text>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <SettingsIcon size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={typography.h3}>Your tutor setup</Text>
            <Text style={typography.small} numberOfLines={2}>
              {[profile?.level, profile?.explainStyle, ...(profile?.subjects ?? []).slice(0, 3)].filter(Boolean).join(' · ') ||
                'Not set up yet'}
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Onboarding')}
            accessibilityRole="button"
            accessibilityLabel="Edit tutor setup"
          >
            <Text style={{ ...typography.caption, color: colors.accent2 }}>Edit</Text>
          </Pressable>
        </View>

        {/* Subscription */}
        <View style={isPro ? styles.proCard : styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <CrownIcon size={20} color={colors.amber} />
            <Text style={typography.h3}>{isPro ? 'Mathly Pro — active' : 'Mathly Pro'}</Text>
          </View>
          <Text style={[typography.bodySecondary, { marginTop: 8 }]}>
            {isPro
              ? 'Unlimited scans, steps and follow-ups are unlocked.'
              : 'Unlimited scans, step-by-step solutions and follow-up questions.'}
          </Text>
          {!isPro ? (
            <Pressable
              onPress={() => navigation.navigate('Paywall')}
              accessibilityRole="button"
              accessibilityLabel="Upgrade to Mathly Pro"
              style={styles.upgradeBtn}
            >
              <Text style={[typography.button, { color: '#fff' }]}>Start free trial</Text>
            </Pressable>
          ) : null}
          {/* Restore has to be reachable by someone who is *not* Pro on this
              device — a reinstall is exactly when it is needed (3.1.1). The
              try/catch matters: an unhandled rejection would leave this stuck
              on "Restoring…" forever, which reads as a hung app. */}
          <Pressable
            onPress={async () => {
              setRestoring(true);
              try {
                const ok = await restorePurchases();
                if (ok) await setPro(true);
                else if (!isPro) {
                  appAlert('Nothing to restore', 'No active Mathly Pro subscription was found for your account.');
                }
              } catch (e) {
                console.warn('restore failed', e);
                appAlert('Restore failed', purchaseErrorMessage(e));
              } finally {
                setRestoring(false);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
          >
            <Text style={[typography.caption, { marginTop: 12 }]}>
              {restoring ? 'Restoring…' : 'Restore purchases'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>STATS</Text>
        <View style={styles.statsRow}>
          <Stat label="Problems solved" value={String(solutions.length)} />
          <Stat label="Subjects" value={String(profile?.subjects.length ?? 0)} />
          <Stat label="Follow-ups" value={String(solutions.reduce((n, s) => n + s.followUps.length, 0))} />
        </View>

        <Text style={styles.sectionLabel}>MORE</Text>
        <View style={styles.card}>
          <Row icon={<BookIcon size={19} />} label="Privacy policy" onPress={() => openLink('privacy')} />
          <Divider />
          <Row icon={<BookIcon size={19} />} label="Terms of use" onPress={() => openLink('terms')} />
          <Divider />
          <Row icon={<TrashIcon size={19} />} label="Delete all my data" danger onPress={confirmReset} />
        </View>

        <Text style={[typography.small, { textAlign: 'center', marginTop: 18 }]}>
          Mathly v1.0.0 · Made for students
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const openLink = openLegalLink;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={typography.small}>{label}</Text>
    </View>
  );
}

function Row({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.row}>
      {icon}
      <Text style={[typography.body, { flex: 1, color: danger ? colors.rose : colors.text }]}>{label}</Text>
      <ChevronRight size={18} />
    </Pressable>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 2 }} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, gap: 16, paddingTop: 8 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 18,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 18,
  },
  proCard: {
    backgroundColor: 'rgba(255, 184, 107, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 107, 0.3)',
    borderRadius: radius.xl,
    padding: 18,
  },
  upgradeBtn: {
    marginTop: 14,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: 13,
  },
  sectionLabel: { ...typography.small, letterSpacing: 0.14, fontWeight: '700', marginTop: 6 },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  statValue: { ...typography.h2, fontFamily: 'SpaceGrotesk_700Bold', color: colors.accent2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
});
