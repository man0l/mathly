import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { useAppNavigation } from '../navigation';
import { BackHeader } from '../components/ScreenShell';
import { GraphPlot } from '../components/GraphPlot';
import { Button } from '../components/ui';
import { CheckIcon, CopyIcon, SendIcon, SparkIcon } from '../components/icons';
import { chatReply } from '../lib/api';
import { subjectMeta } from '../theme/subjects';
import { colors, radius, typography } from '../theme/tokens';
import { useApp } from '../state/AppProvider';
import type { FollowUpMessage } from '../types';

type SolutionRoute = RouteProp<{ params: { id: string; error?: string } }, 'params'>;

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();

export function SolutionScreen() {
  const route = useRoute<SolutionRoute>();
  const navigation = useAppNavigation();
  const { solutions, updateSolution, profile } = useApp();
  const solution = useMemo(() => solutions.find((s) => s.id === route.params?.id), [solutions, route.params?.id]);

  const [revealed, setRevealed] = useState(1);
  const [followUp, setFollowUp] = useState('');
  const [asking, setAsking] = useState(false);

  // Arrived via scan: the stack is Tabs → Scanner → Solution, so plain goBack
  // would drop the user back into the camera. Pop past the scanner instead.
  const goBackPastScanner = () => {
    const routes = navigation.getState()?.routes ?? [];
    const prev = routes[routes.length - 2];
    if (prev?.name === 'Scanner' && routes.length >= 2) {
      navigation.pop(2);
    } else {
      navigation.goBack();
    }
  };

  if (!solution) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <BackHeader title="Solution" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
          <Text style={{ fontSize: 40 }}>🤔</Text>
          <Text style={typography.h3}>Something went wrong</Text>
          <Text style={[typography.bodySecondary, { textAlign: 'center' }]}>
            {route.params?.error
              ? 'The solver could not reach the tutor service. Check your connection and try again.'
              : 'That problem is no longer saved.'}
          </Text>
          <Button label="Try again" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const meta = subjectMeta(solution.subject);
  const steps = solution.steps ?? [];
  const shown = steps.slice(0, revealed);

  const ask = async (preset?: string) => {
    const q = (preset ?? followUp).trim();
    if (!q || asking) return;
    setFollowUp('');
    setAsking(true);

    const userMsg: FollowUpMessage = {
      id: `u-${uid()}`,
      role: 'user',
      text: q,
      createdAt: nowIso(),
    };
    const optimistic = [...solution.followUps, userMsg];
    await updateSolution(solution.id, { followUps: optimistic });

    try {
      const reply = await chatReply({
        messages: [
          ...optimistic.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            createdAt: m.createdAt,
          })),
        ],
        profile,
        solutionContext: { problemText: solution.problemText, finalAnswer: solution.finalAnswer },
      });
      const tutorMsg: FollowUpMessage = {
        id: `t-${uid()}`,
        role: 'tutor',
        text: reply,
        createdAt: nowIso(),
      };
      await updateSolution(solution.id, { followUps: [...optimistic, tutorMsg] });
    } catch {
      const errMsg: FollowUpMessage = {
        id: `t-${uid()}`,
        role: 'tutor',
        text: 'Connection hiccup — ask me again in a moment.',
        createdAt: nowIso(),
      };
      await updateSolution(solution.id, { followUps: [...optimistic, errMsg] });
    } finally {
      setAsking(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <BackHeader title="Solution" onBack={goBackPastScanner} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Problem */}
        <View style={styles.problemCard}>
          <View style={[styles.subjectTag, { backgroundColor: meta.tintSoft }]}>
            <Text style={{ fontSize: 12 }}>{meta.emoji}</Text>
            <Text style={[typography.small, { color: meta.tint, fontWeight: '700' }]}>{meta.label.toUpperCase()}</Text>
          </View>
          <Text style={styles.problemText}>{solution.problemText}</Text>
          {solution.method ? <Text style={typography.small}>via {solution.method}</Text> : null}
        </View>

        {/* Final answer */}
        <LinearGradient colors={['rgba(124,92,252,0.20)', 'rgba(77,124,254,0.10)']} style={styles.answerCard}>
          <Text style={[typography.small, { color: colors.accent2, letterSpacing: 0.14, fontWeight: '700' }]}>
            ANSWER
          </Text>
          <Text style={styles.answerText}>{solution.finalAnswer}</Text>
          <View style={styles.answerRow}>
            <View style={styles.verified}>
              <CheckIcon size={13} color={colors.mint} />
              <Text style={[typography.small, { color: colors.mint }]}>Verified by substitution</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Copy answer" style={styles.copyBtn}>
              <CopyIcon size={16} />
            </Pressable>
          </View>
        </LinearGradient>

        {/* Steps */}
        <Text style={[typography.small, styles.sectionLabel]}>STEP-BY-STEP</Text>
        <View style={{ gap: 10 }}>
          {shown.map((step, i) => (
            <View key={i} style={styles.stepCard}>
              <View style={styles.stepHead}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={typography.h3}>{step.title}</Text>
              </View>
              {step.expression ? (
                <View style={styles.exprBox}>
                  <Text style={styles.exprText}>{step.expression}</Text>
                </View>
              ) : null}
              <Text style={[typography.bodySecondary, { marginTop: 10 }]}>{step.detail}</Text>
            </View>
          ))}
        </View>

        {revealed < steps.length ? (
          <Button
            testID="reveal-next-step"
            label={`Reveal next step (${revealed}/${steps.length})`}
            variant="secondary"
            onPress={() => setRevealed((r) => r + 1)}
            style={{ marginTop: 4 }}
          />
        ) : (
          <View style={styles.doneRow}>
            <SparkIcon size={15} color={colors.mint} />
            <Text style={[typography.caption, { color: colors.mint }]}>
              Full solution unlocked — nice work following along.
            </Text>
          </View>
        )}

        {/* Graph */}
        {solution.graph ? (
          <>
            <Text style={[typography.small, styles.sectionLabel]}>SEE IT</Text>
            <View style={styles.graphCard}>
              <GraphPlot spec={solution.graph} />
            </View>
          </>
        ) : null}

        {/* Follow-ups */}
        <Text style={[typography.small, styles.sectionLabel]}>ASK A FOLLOW-UP</Text>
        {solution.followUps.length > 0 ? (
          <View style={{ gap: 10 }}>
            {solution.followUps.map((m) => (
              <View
                key={m.id}
                style={[styles.msgRow, m.role === 'user' ? styles.msgUser : styles.msgTutor]}
              >
                {m.role === 'tutor' ? <View style={styles.tutorDot} /> : null}
                <View style={[styles.msgBubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleTutor]}>
                  <Text style={[typography.body, m.role === 'user' ? { color: '#fff' } : null]}>{m.text}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.suggestRow}>
            {['Why the ±?', 'Show a faster way', 'Give me one to practice'].map((s) => (
              <Pressable key={s} onPress={() => ask(s)} accessibilityRole="button" accessibilityLabel={s} style={styles.suggestChip}>
                <Text style={[typography.caption, { color: colors.accent2 }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {asking ? (
          <View style={[styles.msgRow, styles.msgTutor]}>
            <View style={styles.tutorDot} />
            <View style={[styles.msgBubble, styles.bubbleTutor, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={typography.bodySecondary}>Thinking…</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.askRow}>
          <TextInput
            style={styles.askInput}
            placeholder="Ask anything about this problem…"
            placeholderTextColor={colors.textTertiary}
            value={followUp}
            onChangeText={setFollowUp}
            onSubmitEditing={() => ask()}
            returnKeyType="send"
          />
          <Pressable onPress={() => ask()} accessibilityRole="button" accessibilityLabel="Send follow-up" style={styles.askSend}>
            {asking ? <ActivityIndicator color="#fff" size="small" /> : <SendIcon size={20} />}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  problemCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 18,
    gap: 10,
  },
  subjectTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  problemText: { ...typography.h2, fontFamily: 'SpaceGrotesk_500Medium' },
  answerCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 252, 0.35)',
    padding: 20,
    gap: 10,
  },
  answerText: { ...typography.display, color: '#fff', fontFamily: 'SpaceGrotesk_700Bold', fontSize: 30 },
  answerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  copyBtn: { padding: 6 },
  sectionLabel: { letterSpacing: 0.14, fontWeight: '700', marginTop: 6 },
  stepCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  exprBox: {
    marginTop: 12,
    backgroundColor: 'rgba(11, 14, 23, 0.7)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
  },
  exprText: { ...typography.mono, color: colors.cyan },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 6 },
  graphCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 14,
  },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestChip: {
    borderWidth: 1,
    borderColor: 'rgba(77, 124, 254, 0.35)',
    backgroundColor: 'rgba(77, 124, 254, 0.08)',
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  msgRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  msgUser: { justifyContent: 'flex-end' },
  msgTutor: {},
  msgBubble: {
    maxWidth: '84%',
    borderRadius: radius.lg,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  bubbleUser: { backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  bubbleTutor: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 6 },
  tutorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  askRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  askInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: colors.text,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  askSend: {
    width: 50,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
