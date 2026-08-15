import React, { useEffect, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { useAppNavigation } from '../navigation';
import { LogoMark } from './OnboardingScreen';
import { solveProblem } from '../lib/api';
import { colors, radius, typography } from '../theme/tokens';
import { useApp } from '../state/AppProvider';

type AnalyzingRoute = RouteProp<{ params: { photoUri?: string; imageBase64?: string; text?: string } }, 'params'>;

const PHASES = [
  'Reading the problem…',
  'Identifying the concepts…',
  'Working through the steps…',
  'Checking the answer…',
];

export function AnalyzingScreen() {
  const route = useRoute<AnalyzingRoute>();
  const navigation = useAppNavigation();
  const { addSolution, profile } = useApp();
  const [phase, setPhase] = useState(0);
  const [spin] = useState(() => new Animated.Value(0));

  const { photoUri, imageBase64, text } = route.params ?? {};

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [spin]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // Advance the phase ticker while the request is in flight.
      const ticker = setInterval(() => {
        if (!cancelled) setPhase((p) => Math.min(p + 1, PHASES.length - 1));
      }, 900);
      try {
        const solution = await solveProblem({ text, imageBase64, photoUri, profile });
        if (cancelled) return;
        setPhase(PHASES.length - 1);
        await new Promise((r) => setTimeout(r, 500));
        if (cancelled) return;
        await addSolution({ ...solution, photoUri });
        navigation.replace('Solution', { id: solution.id });
      } catch (e) {
        if (!cancelled) {
          navigation.replace('Solution', { id: 'error', error: String(e) });
        }
      } finally {
        clearInterval(ticker);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [text, imageBase64, photoUri, profile, addSolution, navigation]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <View style={styles.photoWrap}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={[styles.photo, styles.textCard]}>
              <Text style={styles.typedProblem}>{text}</Text>
            </View>
          )}
          <Animated.View
            style={{
              transform: [
                {
                  rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
                },
              ],
            }}
          >
            <View style={styles.scanLine} />
          </Animated.View>
        </View>

        <View style={{ marginTop: 40, alignItems: 'center', gap: 18 }}>
          <LogoMark size={54} />
          <Text style={typography.h2}>{PHASES[phase]}</Text>
          <Text style={typography.bodySecondary}>Usually takes a few seconds.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoWrap: {
    width: 260,
    height: 340,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  photo: { width: '100%', height: '100%' },
  textCard: { backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', padding: 24 },
  typedProblem: { ...typography.h2, textAlign: 'center', fontFamily: 'SpaceGrotesk_500Medium' },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 160,
    height: 3,
    backgroundColor: colors.accent,
    shadowColor: '#7C5CFC',
    shadowOpacity: 1,
    shadowRadius: 14,
  },
});
