/* eslint-disable @typescript-eslint/no-require-imports */
import { Platform } from 'react-native';

/**
 * RevenueCat wrapper. On iOS/Android with keys configured it uses the real SDK.
 * On web (and when no keys are set) purchases are simulated: a purchase call
 * resolves after a short delay and flips the local pro flag. The e2e flows use
 * the simulated path via the "Test valid purchase" button on the paywall.
 */

export const ENTITLEMENT_ID = 'Mathly Pro';

const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_KEY ?? '';
const RC_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const PLATFORM_KEY = Platform.OS === 'ios' && RC_IOS_KEY ? RC_IOS_KEY : RC_ANDROID_KEY;

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
export const purchasesAvailable = isNative && !!PLATFORM_KEY;

/**
 * Whether the simulated ("Test valid purchase") path may be offered.
 *
 * A shipped iOS build must never expose it: handing out Pro without an In-App
 * Purchase is a Guideline 3.1.1 rejection, and a reviewer who taps Subscribe
 * and sees no purchase sheet is a 2.1 rejection. Web and dev builds keep it —
 * that is what the e2e funnel drives.
 */
export const simulationAllowed = !isNative || __DEV__;

type PurchasesModule = typeof import('react-native-purchases').default;

function getPurchases(): PurchasesModule | null {
  if (!isNative) return null;
  return require('react-native-purchases').default;
}

let configured = false;

export async function configurePurchases(): Promise<boolean> {
  const Purchases = getPurchases();
  if (!Purchases || !PLATFORM_KEY) return false;
  if (configured) return true;
  try {
    const { LOG_LEVEL } = require('react-native-purchases');
    if (__DEV__) await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: PLATFORM_KEY });
    configured = true;
  } catch (e) {
    console.warn('[purchases] configure failed', e);
  }
  return configured;
}

export type PlanId = 'yearly' | 'weekly';

/** RevenueCat package types and App Store product IDs, per plan. */
const PLAN_PACKAGE_TYPE: Record<PlanId, string> = {
  yearly: 'ANNUAL',
  weekly: 'WEEKLY',
};

type Pkg = Awaited<ReturnType<PurchasesModule['getOfferings']>>['current'] extends infer C
  ? C extends { availablePackages: (infer P)[] }
    ? P
    : never
  : never;

/**
 * Never fall back to an arbitrary package — charging a plan the user did not
 * pick is worse than failing the purchase.
 */
function findPackage(packages: Pkg[], plan: PlanId): Pkg | undefined {
  return (
    packages.find((p) => p.packageType === PLAN_PACKAGE_TYPE[plan]) ??
    packages.find((p) => p.product.identifier.endsWith(`.${plan}`))
  );
}

async function currentPackages(): Promise<Pkg[]> {
  const Purchases = getPurchases();
  if (!Purchases || !configured) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function purchasePro(plan: PlanId): Promise<boolean> {
  const Purchases = getPurchases();
  if (!Purchases || !configured) return false;
  const pkg = findPackage(await currentPackages(), plan);
  if (!pkg) throw new Error(`No offering package for the ${plan} plan`);
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
}

/** What the paywall must disclose for a plan, in the user's own storefront. */
export type PlanOffer = {
  /** Localized price, e.g. "$39.99" or "39,99 €". */
  priceString: string;
  /** Localized price per week, when it can be derived. */
  perWeek: string | null;
  /** Length of the introductory free trial in days, if the plan has one. */
  trialDays: number | null;
};

/**
 * Live prices straight from the store.
 *
 * The paywall ships static copy as a fallback, but showing a price that no
 * longer matches App Store Connect is its own rejection — and the static
 * strings are US dollars, which are simply wrong in every other storefront.
 */
export async function fetchPlanOffers(): Promise<Partial<Record<PlanId, PlanOffer>>> {
  const offers: Partial<Record<PlanId, PlanOffer>> = {};
  try {
    const packages = await currentPackages();
    for (const plan of ['yearly', 'weekly'] as PlanId[]) {
      const product = findPackage(packages, plan)?.product;
      if (!product) continue;
      const intro = product.introPrice;
      offers[plan] = {
        priceString: product.priceString,
        perWeek: plan === 'yearly' ? formatPerWeek(product.price / 52, product.currencyCode) : null,
        trialDays:
          intro && intro.price === 0 && intro.periodUnit === 'DAY' ? intro.periodNumberOfUnits : null,
      };
    }
  } catch (e) {
    console.warn('[purchases] could not read offerings', e);
  }
  return offers;
}

function formatPerWeek(amount: number, currencyCode: string): string | null {
  // Hermes ships without full ICU on some builds; a missing locale must not
  // take the paywall down.
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(amount);
  } catch {
    return null;
  }
}

export async function restorePurchases(): Promise<boolean> {
  const Purchases = getPurchases();
  if (!Purchases || !configured) return false;
  const info = await Purchases.restorePurchases();
  return !!info.entitlements.active[ENTITLEMENT_ID];
}

/** Simulated purchase for web/dev — mirrors what the RC sandbox would do. */
export async function simulatePurchase(): Promise<void> {
  await new Promise((r) => setTimeout(r, 900));
}
