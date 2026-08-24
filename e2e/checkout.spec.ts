import { expect, test } from '@playwright/test';

import { trackDialogs } from './helpers/dialogs';
import { completeOnboarding } from './helpers/onboarding';
import {
  fetchCurrentOfferingPackages,
  packageMatchesPlan,
  revenueCatTestKey,
} from './helpers/revenuecat';

/**
 * The checkout funnel end to end, including the store-side configuration the
 * UI depends on. Both stores rejected a build where tapping Subscribe did
 * nothing; every test here pins down one way that used to happen.
 */

test('store config: the current offering packages both plans', async () => {
  const key = revenueCatTestKey();
  if (!key) {
    // Locally the key is optional (UI specs still run); in CI it is required.
    test.skip(!process.env.CI, 'REVENUECAT_TEST_KEY not configured locally');
    throw new Error('REVENUECAT_TEST_KEY secret is missing in CI');
  }

  for (const platform of ['ios', 'android'] as const) {
    const packages = await fetchCurrentOfferingPackages(key, platform);
    const missing = (['yearly', 'weekly'] as const).filter(
      (plan) => !packages.some((pkg) => packageMatchesPlan(pkg, plan)),
    );
    expect(
      missing,
      `The RevenueCat offering has no package for: ${missing.join(', ')} (${platform}). ` +
        'Attach mathly_pro_yearly ($rc_annual) and mathly_pro_weekly ($rc_weekly) to the ' +
        'current offering in the RevenueCat dashboard — an empty offering leaves the ' +
        'Subscribe button dead in release builds, which is what both stores rejected.',
    ).toEqual([]);
  }
});

test('paywall discloses the subscription and checkout unlocks pro', async ({ page }) => {
  const dialogs = trackDialogs(page);
  await completeOnboarding(page);

  // Guideline 3.1.2 wants name, length, price and auto-renewal on screen.
  await expect(page.getByText('Your tutor is ready.')).toBeVisible();
  await expect(page.getByText(/Cancel anytime/)).toBeVisible();
  await expect(page.getByText(/renews automatically every year unless you cancel/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Terms of use' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy policy' })).toBeVisible();
  await expect(page.getByText('$39.99', { exact: false }).first()).toBeVisible();

  // Switching plans must switch the CTA: weekly has no trial.
  await page.getByRole('button', { name: 'Weekly' }).click();
  const subscribe = page.getByRole('button', { name: 'Subscribe', exact: true });
  await expect(subscribe).toBeVisible();

  await subscribe.click();
  const testPurchase = page.getByRole('button', { name: 'Test valid purchase' });
  await testPurchase.waitFor({ timeout: 20_000 });
  await testPurchase.click();

  await page.getByText('Ready to solve?').waitFor({ timeout: 30_000 });

  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.getByText('Mathly Pro — active')).toBeVisible();

  // A happy checkout must stay silent — no error dialogs along the way.
  expect(dialogs).toEqual([]);
});

test('restore answers with feedback instead of hanging or dying silently', async ({ page }) => {
  const dialogs = trackDialogs(page);
  await completeOnboarding(page);

  const restore = page.getByRole('button', { name: 'Restore purchase' });
  await restore.click();
  await expect
    .poll(() => dialogs.some((d) => d.message.includes('Nothing to restore')), {
      timeout: 15_000,
      message: 'Restore gave no feedback — this is the dead-button review bug',
    })
    .toBe(true);

  // The button must recover and answer again, never stick on a spinner.
  await restore.click();
  await expect.poll(() => dialogs.length).toBeGreaterThanOrEqual(2);
});

test('the paywall can be dismissed and checkout still works from Settings', async ({ page }) => {
  const dialogs = trackDialogs(page);
  await completeOnboarding(page);

  // Escape hatch: nobody gets trapped behind a failing purchase.
  await page.getByTestId('paywall-close').click();
  await page.getByText('Ready to solve?').waitFor({ timeout: 30_000 });

  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Upgrade to Mathly Pro' }).click();
  // The dismissed paywall instance stays mounted (hidden) in the web stack,
  // so target the one on top.
  await expect(page.getByText('Your tutor is ready.').last()).toBeVisible();

  await page.getByRole('button', { name: 'Start 3-day free trial' }).last().click();
  const testPurchase = page.getByTestId('paywall-test-purchase').last();
  await testPurchase.waitFor({ timeout: 20_000 });
  await testPurchase.click();

  await page.getByText('Ready to solve?').waitFor({ timeout: 30_000 });
  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.getByText('Mathly Pro — active')).toBeVisible();
  expect(dialogs).toEqual([]);
});

test('a failed purchase shows an error and the paywall recovers', async ({ page }) => {
  const dialogs = trackDialogs(page);
  await completeOnboarding(page);

  // Rehearse a declined payment on the simulated path.
  await page.evaluate(() => localStorage.setItem('e2e_fail_purchase', '1'));
  await page.getByTestId('paywall-start').click();
  const testPurchase = page.getByRole('button', { name: 'Test valid purchase' });
  await testPurchase.waitFor({ timeout: 20_000 });
  await testPurchase.click();

  await expect
    .poll(() => dialogs.some((d) => d.message.includes('Purchase not completed')), {
      timeout: 20_000,
      message: 'Failed purchase produced no visible feedback — the reported dead-button bug',
    })
    .toBe(true);

  // Recovery: without the fault injected, the same buttons complete checkout.
  await page.evaluate(() => localStorage.removeItem('e2e_fail_purchase'));
  await page.getByTestId('paywall-test-purchase').click();
  await page.getByText('Ready to solve?').waitFor({ timeout: 30_000 });
});
