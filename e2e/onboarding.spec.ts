import { expect, test } from '@playwright/test';

import { answerStep, completeOnboarding } from './helpers/onboarding';

test('quiz options select, Continue is gated, and the question actually advances', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.getByText('Math that finally').waitFor({ timeout: 90_000 });
  await page.getByRole('button', { name: 'Get started' }).click();

  await expect(page.getByText('What do you need help with?')).toBeVisible();
  const continueBtn = page.getByRole('button', { name: 'Continue', exact: true });
  await expect(continueBtn).toBeDisabled();

  await page.getByRole('button', { name: 'Algebra' }).click();
  await expect(page.getByTestId('quiz-option-Algebra-selected')).toBeVisible();
  await expect(continueBtn).toBeEnabled();

  await continueBtn.click();
  await expect(page.getByText('What do you need help with?')).toHaveCount(0);
  await expect(page.getByText('What are you studying right now?')).toBeVisible();

  // A later step must also highlight — this is the page that used to keep
  // showing the first question after Continue, so taps looked dead.
  await answerStep(page, {
    question: 'What are you studying right now?',
    option: 'High school',
    nextQuestion: 'What is your main goal?',
  });
});

test.describe('iPad Air 11-inch (App Review device)', () => {
  // Logical points for iPad Air 11-inch portrait — the device Apple used.
  test.use({ viewport: { width: 820, height: 1180 } });

  test('onboarding options respond on the iPad review size', async ({ page }) => {
    await completeOnboarding(page);
    await expect(page.getByText('Your tutor is ready.')).toBeVisible();
  });

  test('paywall plan options switch the selected plan', async ({ page }) => {
    await completeOnboarding(page);
    await page.getByRole('button', { name: 'Weekly' }).click();
    await expect(page.getByTestId('plan-weekly-selected')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Subscribe', exact: true })).toBeVisible();
  });
});
