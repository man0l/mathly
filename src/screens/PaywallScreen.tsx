import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { Button } from '../components/ui';
import { CheckIcon, CrownIcon } from '../components/icons';
import { openLegalLink } from '../lib/links';
import {
  configurePurchases,
  purchasesAvailable,
  purchasePro,
  restorePurchases,
  simulatePurchase,
} from '../lib/purchases';
import { colors, radius, typography } from '../theme/tokens';
import { useApp } from '../state/AppProvider';

const FEATURES = [
  'Unlimited problem scans',
  'Step-by-step solutions for every subject',
  'Ask follow-ups until it clicks',
  'Graphs that visualize the answer',
  'Priority solving speed',
];

const PLANS = [
  { id: 'yearly', title: 'Yearly', price: '$39.99', per: '$3.33 / week', badge: 'SAVE 73%', trial: '3 days free' },
  { id: 'weekly', title: 'Weekly', price: '$6.99', per: 'billed every week', badge: null, trial: null },
];

export function PaywallScreen() {
  const { setPro } = useApp();
  const [plan, setPlan] = useState('yearly');
  const [loading, setLoading] = useState(false);
  const [showTestPurchase, setShowTestPurchase] = useState(!purchasesAvailable);

  const start = async () => {
    setLoading(true);
    try {
      await configurePurchases();
      if (purchasesAvailable) {
        const ok = await purchasePro();
        if (ok) await setPro(true);
      } else {
        // Web/dev: simulate the purchase flow like the RC test store would.
        setShowTestPurchase(true);
      }
    } catch (e) {
      console.warn('purchase failed', e);
    } finally {
      setLoading(false);
    }
  };

  const testPurchase = async () => {
    await simulatePurchase();
    await setPro(true);
  };

  const restore = async () => {
    setLoading(true);
    try {
      const ok = await restorePurchases();
      if (ok) await setPro(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#141B36', colors.bg, colors.bg]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <CrownIcon size={34} color={colors.amber} />
            <Text style={[typography.display, { textAlign: 'center', marginTop: 14 }]}>
              Your tutor is ready.
            </Text>
            <Text style={[typography.bodySecondary, { textAlign: 'center', marginTop: 10 }]}>
              Start your free trial today. Cancel anytime.
            </Text>
          </View>

          <View style={{ gap: 14 }}>
            {FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <View style={styles.featureCheck}>
                  <CheckIcon size={14} color="#fff" />
                </View>
                <Text style={typography.body}>{f}</Text>
              </View>
            ))}
          </View>

          <View style={styles.plans}>
            {PLANS.map((p) => {
              const on = plan === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPlan(p.id)}
                  accessibilityRole="button"
                  accessibilityLabel={p.title}
                  style={[styles.plan, on && styles.planOn]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={typography.h3}>{p.title}</Text>
                    <Text style={typography.small}>{p.per}</Text>
                  </View>
                  <Text style={[typography.h2, { fontFamily: 'SpaceGrotesk_700Bold' }]}>{p.price}</Text>
                  {p.badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{p.badge}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <Button
            testID="paywall-start"
            label={plan === 'yearly' ? 'Start 3-day free trial' : 'Continue'}
            onPress={start}
            loading={loading}
            style={{ marginTop: 10 }}
          />

          {showTestPurchase ? (
            <Pressable
              testID="paywall-test-purchase"
              onPress={testPurchase}
              accessibilityRole="button"
              accessibilityLabel="Test valid purchase"
              style={styles.testBtn}
            >
              <Text style={typography.caption}>Test valid purchase</Text>
            </Pressable>
          ) : null}

          <View style={styles.legalRow}>
            <Pressable onPress={restore} accessibilityRole="button" accessibilityLabel="Restore purchase">
              <Text style={styles.legalText}>Restore</Text>
            </Pressable>
            <Text style={styles.legalText}>·</Text>
            <Pressable
              onPress={() => openLegalLink('terms')}
              accessibilityRole="link"
              accessibilityLabel="Terms of use"
            >
              <Text style={styles.legalText}>Terms</Text>
            </Pressable>
            <Text style={styles.legalText}>·</Text>
            <Pressable
              onPress={() => openLegalLink('privacy')}
              accessibilityRole="link"
              accessibilityLabel="Privacy policy"
            >
              <Text style={styles.legalText}>Privacy</Text>
            </Pressable>
          </View>
          <Text style={[typography.small, { textAlign: 'center', marginTop: 8 }]}>
            No charge during your trial. Cancel anytime in your store settings.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 24, gap: 30 },
  hero: { alignItems: 'center', paddingTop: 26, gap: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plans: { gap: 12 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  planOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  badge: {
    backgroundColor: colors.mintSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { color: colors.mint, fontSize: 11, fontWeight: '700', fontFamily: 'Inter_600SemiBold' },
  testBtn: { alignItems: 'center', paddingVertical: 10 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  legalText: { ...typography.small, textDecorationLine: 'underline' },
});
