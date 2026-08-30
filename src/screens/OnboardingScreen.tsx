import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppNavigation } from '../navigation';

import { contentColumn } from '../components/ScreenShell';
import { Button } from '../components/ui';
import { CheckIcon, ScanIcon, SparkIcon } from '../components/icons';
import { QUIZ_STEPS, type QuizOption } from '../config/onboarding';
import { openLegalLink } from '../lib/links';
import { colors, gradients, radius, typography } from '../theme/tokens';
import { useApp } from '../state/AppProvider';
import type { OnboardingProfile } from '../types';

type Phase = 'welcome' | 'quiz' | 'building';

const BUILD_LINES = [
  'Choosing your tutor persona',
  'Loading your subjects',
  'Calibrating explanation depth',
  'Preparing practice problems',
];

export function OnboardingScreen() {
  const navigation = useAppNavigation();
  const { completeOnboarding, profile } = useApp();
  const [phase, setPhase] = useState<Phase>('welcome');
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  const steps = QUIZ_STEPS;
  const step = steps[page];

  const canContinue = useMemo(() => {
    if (phase !== 'quiz') return true;
    const sel = answers[step.key] ?? [];
    return sel.length > 0;
  }, [phase, answers, step.key]);

  const toggle = useCallback((key: string, label: string, multi: boolean) => {
    setAnswers((prev) => {
      const cur = prev[key] ?? [];
      if (!multi) return { ...prev, [key]: [label] };
      return {
        ...prev,
        [key]: cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label],
      };
    });
  }, []);

  const startBuilding = useCallback(
    async (final: Record<string, string[]>) => {
      setPhase('building');
      const p: OnboardingProfile = {
        subjects: final.subjects ?? [],
        level: final.level?.[0] ?? 'High school',
        goal: final.goal?.[0] ?? 'Actually understand',
        stuckOn: final.stuckOn ?? [],
        explainStyle: final.explainStyle?.[0] ?? 'Step by step',
      };
      await completeOnboarding(p);
      // Stay on the building animation; it navigates to the paywall when done.
    },
    [completeOnboarding],
  );

  if (phase === 'welcome') {
    return <Welcome onStart={() => setPhase('quiz')} returning={!!profile} />;
  }

  if (phase === 'building') {
    return <BuildingScreen onDone={() => navigation.navigate('Paywall')} />;
  }

  const selected = answers[step.key] ?? [];

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={contentColumn({ flex: 1 })}>
        <View style={styles.progressRow}>
          {steps.map((s, i) => (
            <View key={s.key} style={[styles.progressSeg, i <= page && styles.progressSegOn]} />
          ))}
        </View>

        {/*
          Render only the current step. A horizontal FlatList that never
          scrolled (Continue only bumped `page`) left reviewers tapping the
          still-visible previous options with no highlight — Apple 2.1 on iPad.
        */}
        <ScrollView
          style={styles.quizScroll}
          contentContainerStyle={styles.quizContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={typography.display}>{step.question}</Text>
          <Text style={styles.sub}>{step.sub}</Text>
          <View style={{ gap: 10, paddingBottom: 24 }}>
            {step.options.map((opt: QuizOption) => {
              const on = selected.includes(opt.label);
              return (
                <Pressable
                  key={opt.label}
                  testID={on ? `quiz-option-${opt.label}-selected` : `quiz-option-${opt.label}`}
                  onPress={() => toggle(step.key, opt.label, step.multi)}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ selected: on }}
                  hitSlop={6}
                  style={({ pressed }) => [styles.option, on && styles.optionOn, pressed && styles.optionPressed]}
                >
                  {opt.emoji ? <Text style={styles.optionEmoji}>{opt.emoji}</Text> : null}
                  <View style={{ flex: 1 }}>
                    <Text style={typography.h3}>{opt.label}</Text>
                    {opt.sub ? <Text style={typography.small}>{opt.sub}</Text> : null}
                  </View>
                  <View style={[styles.checkDot, on && styles.checkDotOn]}>
                    {on ? <CheckIcon size={15} color="#fff" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {page > 0 ? (
            <Pressable
              onPress={() => setPage((p) => p - 1)}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={8}
              style={({ pressed }) => [pressed && styles.optionPressed]}
            >
              <Text style={typography.caption}>Back</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Button
            label="Continue"
            disabled={!canContinue}
            style={{ flex: 1, maxWidth: 300 }}
            onPress={() => {
              if (page < steps.length - 1) {
                setPage((p) => p + 1);
              } else {
                startBuilding(answers);
              }
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Welcome({ onStart, returning }: { onStart: () => void; returning: boolean }) {
  return (
    <LinearGradient colors={['#131A33', colors.bg, colors.bg]} style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={[contentColumn({ flex: 1 }), { paddingHorizontal: 24, justifyContent: 'space-between' }]}>
          <View style={{ alignItems: 'center', paddingTop: 92 }}>
            <LogoMark />
            <Text style={[typography.display, styles.welcomeTitle]}>Math that finally{"\n"}makes sense.</Text>
            <Text style={styles.sub}>
              Snap a photo of any problem — algebra, calculus, physics — and get the full solution with every step explained.
            </Text>
          </View>

          <View style={{ gap: 28, paddingBottom: 40 }}>
            <View style={styles.proofRow}>
              <SparkIcon size={16} color={colors.accent} />
              <Text style={typography.caption}>2M+ problems solved this month</Text>
            </View>
            {/* 5.1.2(i): the permission moment — the AI hand-off is disclosed
                directly above the action that accepts it, with both legal pages
                one tap away. */}
            <View style={{ gap: 14 }}>
              <Text style={styles.consentNote}>
                By continuing you agree to our{' '}
                <Text
                  style={styles.consentLink}
                  onPress={() => openLegalLink('terms')}
                  accessibilityRole="link"
                >
                  Terms of Use
                </Text>{' '}
                and{' '}
                <Text
                  style={styles.consentLink}
                  onPress={() => openLegalLink('privacy')}
                  accessibilityRole="link"
                >
                  Privacy Policy
                </Text>
                . Problems you submit are processed by an AI service (OpenAI),
                solely to generate your solutions.
              </Text>
              <Button label={returning ? 'Set up my tutor again' : 'Get started'} onPress={onStart} />
              <Pressable
                onPress={onStart}
                accessibilityRole="button"
                accessibilityLabel="I already have an account"
                hitSlop={8}
              >
                <Text style={[typography.caption, { textAlign: 'center' }]}>I already have an account</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

export function LogoMark({ size = 76 }: { size?: number }) {
  return (
    <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoWrap}>
      <ScanIcon size={size * 0.44} color="#fff" />
    </LinearGradient>
  );
}

function BuildingScreen({ onDone }: { onDone: () => void }) {
  const [lines, setLines] = useState(0);

  React.useEffect(() => {
    let cancelled = false;
    const tick = async (i: number) => {
      if (cancelled) return;
      if (i >= BUILD_LINES.length) {
        setTimeout(() => !cancelled && onDone(), 700);
        return;
      }
      await new Promise((r) => setTimeout(r, 750));
      if (cancelled) return;
      setLines(i + 1);
      tick(i + 1);
    };
    tick(0);
    return () => {
      cancelled = true;
    };
  }, [onDone]);

  return (
    <SafeAreaView style={[styles.root, { justifyContent: 'center' }]} edges={['top', 'bottom']}>
      <View style={[contentColumn(), { paddingHorizontal: 32, alignItems: 'center', gap: 36 }]}>
        <LogoMark size={92} />
        <Text style={typography.h1}>Setting up your tutor</Text>
        <View style={{ gap: 18, alignSelf: 'stretch' }}>
          {BUILD_LINES.map((line, i) => (
            <View key={line} style={styles.buildRow}>
              <View style={[styles.checkDot, styles.checkDotBig, i < lines && styles.checkDotOn]}>
                {i < lines ? <CheckIcon size={17} color="#fff" /> : null}
              </View>
              <Text style={[typography.bodySecondary, i < lines && { color: colors.text }]}>{line}</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  sub: { ...typography.bodySecondary, marginTop: 12 },
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surface },
  progressSegOn: { backgroundColor: colors.accent },
  quizScroll: { flex: 1 },
  quizContent: { paddingHorizontal: 20, paddingBottom: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 15,
    minHeight: 56,
  },
  optionOn: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft },
  optionPressed: { opacity: 0.82 },
  optionEmoji: { fontSize: 21, width: 30, textAlign: 'center' },
  checkDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDotOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  checkDotBig: { width: 32, height: 32, borderRadius: 16 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  welcomeTitle: { textAlign: 'center', marginTop: 32, fontSize: 38, lineHeight: 44 },
  logoWrap: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C5CFC',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  buildRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  consentNote: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 12,
  },
  consentLink: { color: colors.textSecondary, textDecorationLine: 'underline' },
});
