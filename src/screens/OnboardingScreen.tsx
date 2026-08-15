import React, { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppNavigation } from '../navigation';

import { Button } from '../components/ui';
import { CheckIcon, ScanIcon, SparkIcon } from '../components/icons';
import { QUIZ_STEPS, type QuizOption } from '../config/onboarding';
import { colors, gradients, radius, typography } from '../theme/tokens';
import { useApp } from '../state/AppProvider';
import type { OnboardingProfile } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');

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

  const canContinue = useMemo(() => {
    if (phase !== 'quiz') return true;
    const step = steps[page];
    const sel = answers[step.key] ?? [];
    return sel.length > 0;
  }, [phase, page, answers, steps]);

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
    return (
      <BuildingScreen
        onDone={() => navigation.navigate('Paywall')}
      />
    );
  }

  const step = steps[page];
  const selected = answers[step.key] ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.progressRow}>
        {steps.map((s, i) => (
          <View key={s.key} style={[styles.progressSeg, i <= page && styles.progressSegOn]} />
        ))}
      </View>

      <FlatList
        data={steps}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.key}
        renderItem={({ item, index }) => (
          <View style={{ width: SCREEN_W, paddingHorizontal: 20 }}>
            <Text style={typography.display}>{item.question}</Text>
            <Text style={styles.sub}>{item.sub}</Text>
            <View style={{ gap: 10, paddingBottom: 24 }}>
              {item.options.map((opt: QuizOption) => {
                const on = selected.includes(opt.label);
                return (
                  <Pressable
                    key={opt.label}
                    onPress={() => toggle(item.key, opt.label, item.multi)}
                    accessibilityRole="button"
                    accessibilityLabel={opt.label}
                    style={[styles.option, on && styles.optionOn]}
                  >
                    {opt.emoji ? <Text style={styles.optionEmoji}>{opt.emoji}</Text> : null}
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.h3, { color: on ? colors.text : colors.text }]}>{opt.label}</Text>
                      {opt.sub ? <Text style={typography.small}>{opt.sub}</Text> : null}
                    </View>
                    <View style={[styles.checkDot, on && styles.checkDotOn]}>
                      {on ? <CheckIcon size={15} color="#fff" /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        extraData={answers}
        onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          setPage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W));
        }}
      />

      <View style={styles.footer}>
        {page > 0 ? (
          <Pressable onPress={() => setPage((p) => p - 1)} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={typography.caption}>Back</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Button
          label={page === steps.length - 1 ? 'Continue' : 'Continue'}
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
  );
}

function Welcome({ onStart, returning }: { onStart: () => void; returning: boolean }) {
  return (
    <LinearGradient colors={['#131A33', colors.bg, colors.bg]} style={styles.root}>
      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' }}>
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
          <Button label={returning ? 'Set up my tutor again' : 'Get started'} onPress={onStart} />
          <Pressable onPress={onStart} accessibilityRole="button" accessibilityLabel="I already have an account">
            <Text style={[typography.caption, { textAlign: 'center' }]}>I already have an account</Text>
          </Pressable>
        </View>
      </View>
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
    <View style={[styles.root, { justifyContent: 'center', paddingHorizontal: 32 }]}>
      <View style={{ alignItems: 'center', gap: 36 }}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  sub: { ...typography.bodySecondary, marginTop: 12 },
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 26, paddingBottom: 18 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surface },
  progressSegOn: { backgroundColor: colors.accent },
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
  },
  optionOn: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft },
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
    paddingBottom: 28,
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
});
