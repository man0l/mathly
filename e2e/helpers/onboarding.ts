import type { Page } from '@playwright/test';

/**
 * The onboarding funnel shared by every checkout spec, from a clean device to
 * the moment the paywall is up ("Your tutor is ready.").
 */
export async function completeOnboarding(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });

  // Welcome
  await page.getByText('Math that finally').waitFor({ timeout: 90_000 });
  // 5.1.2(i) guard: the third-party AI disclosure must be on the welcome
  // screen, above the button the user taps to continue.
  await page.getByText(/processed by an AI service \(OpenAI\)/).waitFor();
  await page.getByRole('button', { name: 'Get started' }).click();

  // Quiz
  await page.getByText('What do you need help with?').waitFor();
  await page.getByRole('button', { name: 'Algebra' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await page.getByText('What are you studying right now?').waitFor();
  await page.getByRole('button', { name: 'High school' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await page.getByText('What is your main goal?').waitFor();
  await page.getByRole('button', { name: 'Actually understand' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await page.getByText('Where do you usually get stuck?').waitFor();
  await page.getByRole('button', { name: 'Word problems' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await page.getByText('How do you like explanations?').waitFor();
  await page.getByRole('button', { name: 'Step by step', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  // Building animation → paywall
  await page.getByText('Setting up your tutor').waitFor({ timeout: 30_000 });
  await page.getByText('Your tutor is ready.').waitFor({ timeout: 60_000 });
}
