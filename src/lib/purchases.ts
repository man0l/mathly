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

export async function purchasePro(plan: PlanId): Promise<boolean> {
  const Purchases = getPurchases();
  if (!Purchases || !configured) return false;
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  // Never fall back to an arbitrary package — charging a plan the user did not
  // pick is worse than failing the purchase.
  const pkg =
    packages.find((p) => p.packageType === PLAN_PACKAGE_TYPE[plan]) ??
    packages.find((p) => p.product.identifier.endsWith(`.${plan}`));
  if (!pkg) throw new Error(`No offering package for the ${plan} plan`);
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
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
