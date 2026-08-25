import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppNavigation } from '../navigation';

import { CameraIcon, ChevronRight, ScanIcon, SparkIcon } from '../components/icons';
import { openLegalLink } from '../lib/links';
import { SUBJECTS, subjectMeta } from '../theme/subjects';
import { colors, gradients, radius, typography } from '../theme/tokens';
import { useApp } from '../state/AppProvider';

export function ScanHomeScreen() {
  const navigation = useAppNavigation();
  const { solutions, profile } = useApp();
  const [quickAsk, setQuickAsk] = useState('');

  const firstName = useMemo(() => (profile?.level ? profile.level.toLowerCase() : ''), [profile]);
  const recent = solutions.slice(0, 4);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={typography.small}>
              {firstName ? `${firstName} · ` : ''}Your AI tutor
            </Text>
            <Text style={typography.h2}>Ready to solve?</Text>
          </View>
          <View style={styles.streakChip}>
            <SparkIcon size={13} color={colors.accent} />
            <Text style={styles.streakText}>Pro</Text>
          </View>
        </View>

        <Pressable
          onPress={() => navigation.navigate('Scanner')}
          accessibilityRole="button"
          accessibilityLabel="Scan a problem"
        >
          <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.scanCard}>
            <View style={styles.scanIconWrap}>
              <CameraIcon size={30} color="#fff" />
            </View>
            <Text style={styles.scanTitle}>Scan a problem</Text>
            <Text style={styles.scanSub}>Point your camera at any equation — solved in seconds.</Text>
          </LinearGradient>
        </Pressable>

        <View style={styles.quickRow}>
          <TextInput
            style={styles.quickInput}
            placeholder="or type a problem, e.g. 3x + 7 = 25…"
            placeholderTextColor={colors.textTertiary}
            value={quickAsk}
            onChangeText={setQuickAsk}
            onSubmitEditing={() => {
              if (!quickAsk.trim()) return;
              navigation.navigate('Analyzing', { text: quickAsk.trim() });
              setQuickAsk('');
            }}
            returnKeyType="done"
          />
          <Pressable
            style={styles.quickSend}
            onPress={() => {
              if (!quickAsk.trim()) return;
              navigation.navigate('Analyzing', { text: quickAsk.trim() });
              setQuickAsk('');
            }}
            accessibilityRole="button"
            accessibilityLabel="Solve typed problem"
          >
            <ScanIcon size={20} color="#fff" />
          </Pressable>
        </View>

        {/* 5.1.2(i): the disclosure sits at the exact point where a problem
            first leaves the device, for both entry paths (scan + typed). */}
        <Text style={[typography.caption, styles.aiNote]}>
          Problems you scan or type are processed by an AI service (OpenAI) to
          generate answers.{' '}
          <Text
            style={[typography.caption, styles.aiNoteLink]}
            onPress={() => openLegalLink('privacy')}
            accessibilityRole="link"
          >
            Privacy Policy
          </Text>
        </Text>

        <Text style={[typography.small, styles.sectionLabel]}>SUBJECTS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {SUBJECTS.map((s) => (
            <View key={s.id} style={[styles.subjectChip, { borderColor: `${s.tint}44` }]}>
              <Text style={{ fontSize: 14 }}>{s.emoji}</Text>
              <Text style={[typography.caption, { color: s.tint }]}>{s.label}</Text>
            </View>
          ))}
        </ScrollView>

        {recent.length > 0 ? (
          <>
            <Text style={[typography.small, styles.sectionLabel]}>RECENT</Text>
            <View style={{ gap: 10 }}>
              {recent.map((s) => {
                const meta = subjectMeta(s.subject);
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => navigation.navigate('Solution', { id: s.id })}
                    accessibilityRole="button"
                    accessibilityLabel={s.problemText}
                    style={styles.recentRow}
                  >
                    <View style={[styles.recentIcon, { backgroundColor: meta.tintSoft }]}>
                      <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={typography.body} numberOfLines={1}>
                        {s.problemText}
                      </Text>
                      <Text style={[typography.small, { color: meta.tint }]} numberOfLines={1}>
                        {s.finalAnswer}
                      </Text>
                    </View>
                    <ChevronRight size={18} />
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 30 }}>📷</Text>
            <Text style={[typography.bodySecondary, { textAlign: 'center', marginTop: 8 }]}>
              Your solved problems appear here.{'\n'}Scan your first one above.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  streakText: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  scanCard: {
    borderRadius: radius.xl,
    padding: 22,
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    shadowColor: '#4D7CFE',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  scanIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  scanTitle: { ...typography.h2, color: '#fff' },
  scanSub: { ...typography.caption, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  quickSend: {
    width: 52,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: { letterSpacing: 0.14, fontWeight: '700', marginTop: 8 },
  aiNote: { color: colors.textTertiary, marginTop: -4, lineHeight: 16 },
  aiNoteLink: { color: colors.textSecondary, textDecorationLine: 'underline' },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: 'rgba(21, 26, 44, 0.7)',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  recentIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emptyCard: {
    alignItems: 'center',
    padding: 28,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginTop: 6,
  },
});
