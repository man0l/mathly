import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { Button } from '../components/ui';
import { CheckIcon, CrownIcon } from '../components/icons';
import { appAlert } from '../lib/alert';
import { openLegalLink } from '../lib/links';
import {
  configurePurchases,
  fetchPlanOffers,
  purchasesAvailable,
  purchaseErrorMessage,
  purchasePro,
  restorePurchases,
  simulatePurchase,
  simulationAllowed,
  type PlanId,
  type PlanOffer,
} from '../lib/purchases';
import { useAppNavigation } from '../navigation';
import { colors, radius, typography } from '../theme/tokens';
import { useApp } from '../state/AppProvider';

const FEATURES = [
  'Unlimited problem scans',
  'Step-by-step solutions for every subject',
  'Ask follow-ups until it clicks',
  'Graphs that visualize the answer',
  'Priority solving speed',
];

type Plan = {
  id: PlanId;
  title: string;
  /** Length of the billing period, spelled out — Apple requires it on screen. */
  period: string;
  price: string;
  /** Optional second line, e.g. the yearly plan's per-week equivalent. */
  per: string | null;
  badge: string | null;
  trialDays: number | null;
};

/**
 * Fallback copy, used until the store answers (and on web). It must stay in
 * step with App Store Connect — `npm run metadata:preflight` compares the two.
 */
const PLANS: Plan[] = [
  {
    id: 'yearly',
    title: 'Yearly',
    period: 'year',
    price: '$39.99',
    per: '$0.77 / week',
    badge: 'SAVE 89%',
    trialDays: 3,
  },
  {
    id: 'weekly',
    title: 'Weekly',
    period: 'week',
    price: '$6.99',
    per: null,
    badge: null,
    trialDays: null,
  },
];

/** Merge the live store prices over the fallback copy. */
function withOffers(offers: Partial<Record<PlanId, PlanOffer>>): Plan[] {
  return PLANS.map((p) => {
    const offer = offers[p.id];
    if (!offer) return p;
    return {
      ...p,
      price: offer.priceString,
      per: offer.perWeek ? `${offer.perWeek} / week` : p.per,
      trialDays: offer.trialDays,
    };
  });
}

/**
 * Guideline 3.1.2 wants the binary itself to state what is being bought: the
 * subscription's name, its length, its price, and that it renews on its own.
 */
function disclosure(plan: Plan): string {
  const trial = plan.trialDays
    ? `The first ${plan.trialDays} days are free; after that it costs ${plan.price} and `
    : `It costs ${plan.price} and `;
  return (
    `Mathly Pro is an auto-renewing subscription. ${trial}renews automatically every ` +
    `${plan.period} unless you cancel at least 24 hours before the period ends. ` +
    'Manage or cancel it anytime in your App Store settings.'
  );
}

export function PaywallScreen() {
  const { setPro } = useApp();
  const navigation = useAppNavigation();
  const [plan, setPlan] = useState<PlanId>('yearly');
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>(PLANS);
  const [showTestPurchase, setShowTestPurchase] = useState(simulationAllowed && !purchasesAvailable);
  const selected = plans.find((p) => p.id === plan) ?? plans[0];

  // Prices come from the store so the paywall can never quote a figure App
  // Store Connect has moved on from, or dollars to a non-US storefront.
  useEffect(() => {
    let live = true;
    (async () => {
      if (!purchasesAvailable) return;
      await configurePurchases();
      const offers = await fetchPlanOffers();
      if (live && Object.keys(offers).length) setPlans(withOffers(offers));
    })();
    return () => {
      live = false;
    };
  }, []);

  // Every branch of the funnel ends in something the user can see. A silent
  // failure here is a Subscribe button that does nothing — the exact "cannot
  // continue" behaviour both stores rejected us for.
  const start = async () => {
    setLoading(true);
    try {
      await configurePurchases();
      if (purchasesAvailable) {
        const ok = await purchasePro(plan);
        if (ok) await setPro(true);
        else appAlert('Purchase not completed', 'You were not charged. Please try again in a moment.');
      } else if (simulationAllowed) {
        // Web/dev: simulate the purchase flow like the RC test store would.
        setShowTestPurchase(true);
      } else {
        // A shipped build with no store connection: say so rather than leaving
        // the button dead, which reads as a broken app in review.
        appAlert('Subscriptions unavailable', 'The App Store could not be reached. Please try again in a moment.');
      }
    } catch (e) {
      console.warn('purchase failed', e);
      appAlert('Purchase not completed', purchaseErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const testPurchase = async () => {
    try {
      await simulatePurchase();
      await setPro(true);
    } catch (e) {
      console.warn('simulated purchase failed', e);
      appAlert('Purchase not completed', purchaseErrorMessage(e));
    }
  };

  const restore = async () => {
    setLoading(true);
    try {
      const ok = await restorePurchases();
      if (ok) await setPro(true);
      else appAlert('Nothing to restore', 'No previous Mathly Pro purchase was found for this account.');
    } catch (e) {
      console.warn('restore failed', e);
      appAlert('Restore failed', purchaseErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#141B36', colors.bg, colors.bg]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Escape hatch: a purchase failure must never trap the user on this
            screen — both stores read that as "app prevents continuing". */}
        <Pressable
          testID="paywall-close"
          onPress={() => navigation.navigate('Tabs')}
          accessibilityRole="button"
          accessibilityLabel="Continue without Mathly Pro"
          hitSlop={12}
          style={styles.closeBtn}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <CrownIcon size={34} color={colors.amber} />
            <Text style={[typography.display, { textAlign: 'center', marginTop: 14 }]}>
              Your tutor is ready.
            </Text>
            <Text style={[typography.bodySecondary, { textAlign: 'center', marginTop: 10 }]}>
              Mathly Pro — an auto-renewing subscription. Cancel anytime.
            </Text>
          </View>

          <View style={{ gap: 11 }}>
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
            {plans.map((p) => {
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
                    <Text style={typography.small}>
                      {p.trialDays ? `${p.trialDays} days free, then ` : ''}
                      {p.price} / {p.period}
                    </Text>
                    {p.per ? <Text style={typography.small}>{p.per}</Text> : null}
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
            label={selected.trialDays ? `Start ${selected.trialDays}-day free trial` : 'Subscribe'}
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
          <Text style={[typography.small, { textAlign: 'center', marginTop: 8, lineHeight: 17 }]}>
            {disclosure(selected)}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 18,
    zIndex: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(148, 163, 204, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: colors.textSecondary, fontSize: 16, lineHeight: 20 },
  scroll: { paddingHorizontal: 24, paddingBottom: 20, gap: 22 },
  hero: { alignItems: 'center', paddingTop: 14, gap: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
