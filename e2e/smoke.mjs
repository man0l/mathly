/** Quick full-flow smoke check against the running Expo web server. */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:19006';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  const step = async (name, fn) => {
    try {
      await fn();
      console.log('OK  ', name);
    } catch (e) {
      console.log('FAIL', name, '-', String(e).slice(0, 300));
      await page.screenshot({ path: `e2e/fail-${name.replace(/\W+/g, '_')}.png` });
      throw e;
    }
  };

  await step('load', async () => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.getByText('Math that finally').waitFor({ timeout: 90_000 });
  });

  await step('quiz-flow', async () => {
    await page.getByRole('button', { name: 'Get started' }).click();
    await page.getByText('What do you need help with?').waitFor({ timeout: 30_000 });
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
    await page.getByText('Setting up your tutor').waitFor({ timeout: 30_000 });
  });

  await step('paywall', async () => {
    await page.getByText('Your tutor is ready.').waitFor({ timeout: 60_000 });
    await page.screenshot({ path: 'e2e/shot-paywall.png' });
  });

  await step('test-purchase', async () => {
    await page.getByTestId('paywall-start').click();
    const test = page.getByRole('button', { name: 'Test valid purchase' });
    await test.waitFor({ timeout: 20_000 });
    await test.click();
    await page.getByText('Ready to solve?').waitFor({ timeout: 30_000 });
  });

  await step('home', async () => {
    await page.screenshot({ path: 'e2e/shot-home.png' });
  });

  await step('scanner', async () => {
    await page.getByRole('button', { name: 'Scan a problem' }).click();
    await page.getByText('Fit the equation inside the frame').waitFor({ timeout: 30_000 });
    await page.screenshot({ path: 'e2e/shot-scanner.png' });
  });

  await step('scan-test-photo', async () => {
    await page.getByTestId('e2e-use-test-photo').click();
    await page.getByText('Reading the problem').waitFor({ timeout: 30_000 });
    await page.screenshot({ path: 'e2e/shot-analyzing.png' });
  });

  await step('solution', async () => {
    await page.getByText('STEP-BY-STEP').waitFor({ timeout: 60_000 });
    await page.getByText('Verified by substitution').waitFor({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/shot-solution.png' });
  });

  await step('reveal-steps', async () => {
    const btn = page.getByTestId('reveal-next-step');
    for (let i = 0; i < 4 && (await btn.isVisible().catch(() => false)); i++) {
      await btn.click();
      await sleep(250);
    }
    await page.getByText('Full solution unlocked').waitFor({ timeout: 10_000 });
  });

  await step('graph', async () => {
    await page.getByText('SEE IT').waitFor({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/shot-solution-full.png' });
  });

  await step('follow-up', async () => {
    await page.getByRole('button', { name: 'Why the ±?' }).click();
    await page.getByText('Think of the ± sign', { exact: false }).waitFor({ timeout: 30_000 });
    await page.screenshot({ path: 'e2e/shot-followup.png' });
  });

  await step('back-home-history', async () => {
    await page.getByRole('button', { name: 'Go back' }).click();
    await sleep(1500);
    await page.screenshot({ path: 'e2e/after-back.png' });
    const txt = await page.evaluate(() => document.body.innerText.slice(0, 200));
    console.log('AFTER-BACK TEXT:', JSON.stringify(txt));
    await page.getByRole('tab', { name: 'History' }).click();
    await page.getByText('Solve 2x² − 5x − 3 = 0').first().waitFor({ timeout: 20_000 });
    await page.screenshot({ path: 'e2e/shot-history.png' });
  });

  await step('chat', async () => {
    await page.getByRole('tab', { name: 'Chat' }).click();
    await page.getByText('Ask anything — concepts, homework, exam prep.').waitFor({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Explain the quadratic formula' }).click();
    await page.getByText('Think of the ± sign', { exact: false }).waitFor({ timeout: 30_000 });
    await page.screenshot({ path: 'e2e/shot-chat.png' });
  });

  await step('settings', async () => {
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByText('Your tutor setup').waitFor({ timeout: 20_000 });
    await page.getByText('Mathly Pro — active').waitFor({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/shot-settings.png' });
  });

  console.log('\nPage errors captured:', errors.length);
  for (const e of errors.slice(0, 10)) console.log(' -', e.slice(0, 200));

  await browser.close();
  console.log('SMOKE PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
