import { expect, test } from '@playwright/test';

import { completeOnboarding } from './helpers/onboarding';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('onboarding → paywall → solve → follow-up → history → chat', async ({ page }) => {
  test.setTimeout(240_000);

  await completeOnboarding(page);

  // Simulated purchase unlocks the app
  await page.getByTestId('paywall-start').click();
  const testPurchase = page.getByRole('button', { name: 'Test valid purchase' });
  await testPurchase.waitFor({ timeout: 20_000 });
  await testPurchase.click();
  await page.getByText('Ready to solve?').waitFor({ timeout: 30_000 });
  // 5.1.2(i) guard: scan home discloses the AI hand-off at the submission point.
  await page.getByText(/scan or type are processed by an AI service/).waitFor();

  // Scan → test photo → solution (stubbed API)
  await page.getByRole('button', { name: 'Scan a problem' }).click();
  await page.getByText('Fit the equation inside the frame').waitFor();
  await page.getByTestId('e2e-use-test-photo').click();
  await page.getByText('Reading the problem').waitFor();
  await page.getByText('Verified by substitution').waitFor({ timeout: 60_000 });

  // Reveal every step
  const reveal = page.getByTestId('reveal-next-step');
  for (let i = 0; i < 5 && (await reveal.isVisible().catch(() => false)); i++) {
    await reveal.click();
    await sleep(200);
  }
  await page.getByText('Full solution unlocked').waitFor();
  await page.getByText('SEE IT').waitFor();

  // Follow-up chip
  await page.getByRole('button', { name: 'Why the ±?' }).click();
  await page.getByText('Think of the ± sign', { exact: false }).waitFor({ timeout: 30_000 });

  // Back → home (skips the scanner) → history shows the problem
  await page.getByRole('button', { name: 'Go back' }).click();
  await page.getByText('Ready to solve?').waitFor();
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByText('Solve 2x² − 5x − 3 = 0').first()).toBeVisible();

  // Chat
  await page.getByRole('tab', { name: 'Chat' }).click();
  await page.getByText(/Messages are processed by an AI service/).waitFor();
  await page.getByRole('button', { name: 'Explain the quadratic formula' }).click();
  await page.getByText('Think of the ± sign', { exact: false }).waitFor({ timeout: 30_000 });

  // Settings shows active pro
  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.getByText('Mathly Pro — active')).toBeVisible();
});
