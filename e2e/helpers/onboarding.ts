import { expect, type Page } from '@playwright/test';

/**
 * The onboarding funnel shared by every checkout spec, from a clean device to
 * the moment the paywall is up ("Your tutor is ready.").
 *
 * Each quiz step asserts that tapping an option actually selects it, and that
 * Continue replaces the question (not just bumping hidden page state). A
 * horizontal FlatList that never scrolled is what Apple rejected as
 * "no response when we tapped on the options" on iPad.
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

  await answerStep(page, {
    question: 'What do you need help with?',
    option: 'Algebra',
    nextQuestion: 'What are you studying right now?',
  });
  await answerStep(page, {
    question: 'What are you studying right now?',
    option: 'High school',
    nextQuestion: 'What is your main goal?',
  });
  await answerStep(page, {
    question: 'What is your main goal?',
    option: 'Actually understand',
    nextQuestion: 'Where do you usually get stuck?',
  });
  await answerStep(page, {
    question: 'Where do you usually get stuck?',
    option: 'Word problems',
    nextQuestion: 'How do you like explanations?',
  });
  await answerStep(page, {
    question: 'How do you like explanations?',
    option: 'Step by step',
  });

  // Building animation → paywall
  await page.getByText('Setting up your tutor').waitFor({ timeout: 30_000 });
  await page.getByText('Your tutor is ready.').waitFor({ timeout: 60_000 });
}

export async function answerStep(
  page: Page,
  args: { question: string; option: string; nextQuestion?: string },
): Promise<void> {
  await expect(page.getByText(args.question)).toBeVisible();
  const choice = page.getByRole('button', { name: args.option, exact: true });
  await choice.click();
  await expect(page.getByTestId(`quiz-option-${args.option}-selected`)).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText(args.question)).toHaveCount(0);
  if (args.nextQuestion) {
    await expect(page.getByText(args.nextQuestion)).toBeVisible();
  }
}
