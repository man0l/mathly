import { loadAppEnv } from './loadAppEnv';

/**
 * Store-config preflight for the checkout funnel, driven by the RevenueCat
 * test-mode secret key. This is the API-side half of "does checkout work":
 * if the current offering has no packages for a store, every real Subscribe
 * tap in that store's app dies on "No offering package" — the exact bug both
 * Apple and Google rejected us for.
 */

const RC_API = 'https://api.revenuecat.com';

/** From env first (CI secret), then the local gitignored .env. */
export function revenueCatTestKey(): string {
  return process.env.REVENUECAT_TEST_KEY || loadAppEnv().REVENUECAT_TEST_KEY || '';
}

type RcPackage = { identifier?: string; platform_product_identifier?: string };

type RcOfferingsResponse = {
  current_offering_id?: string;
  offerings?: { identifier?: string; packages?: RcPackage[] }[];
};

/**
 * Packages of the current offering as a given store sees them. Reading the
 * offerings through a throwaway subscriber mirrors what the SDK does at
 * configure time; the subscriber is deleted again right after (test mode).
 */
export async function fetchCurrentOfferingPackages(
  apiKey: string,
  platform: 'ios' | 'android',
): Promise<RcPackage[]> {
  const appUserId = `e2e-checkout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const res = await fetch(
      `${RC_API}/v1/subscribers/${encodeURIComponent(appUserId)}/offerings`,
      { headers: { Authorization: `Bearer ${apiKey}`, 'X-Platform': platform } },
    );
    if (!res.ok) {
      throw new Error(`RevenueCat offerings check failed with HTTP ${res.status}`);
    }
    const body = (await res.json()) as RcOfferingsResponse;
    const current =
      body.offerings?.find((o) => o.identifier === body.current_offering_id) ??
      body.offerings?.[0];
    if (!current) throw new Error('RevenueCat project has no offerings at all');
    return current.packages ?? [];
  } finally {
    // Best effort: don't litter the test-mode customer list with ghosts.
    await fetch(`${RC_API}/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch(() => undefined);
  }
}

/**
 * Whether a package covers a plan, using the same identifiers the app matches
 * on: RC standard package ids ($rc_annual / $rc_weekly) or store product ids
 * (mathly_pro_yearly / mathly_pro_weekly).
 */
export function packageMatchesPlan(pkg: RcPackage, plan: 'yearly' | 'weekly'): boolean {
  const hay = `${pkg.identifier ?? ''} ${pkg.platform_product_identifier ?? ''}`.toLowerCase();
  return plan === 'yearly' ? /annual|yearly/.test(hay) : /weekly/.test(hay);
}
