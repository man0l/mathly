/**
 * Capture the paywall for App Store Connect's in-app-purchase review screenshot.
 *
 * Apple requires a review screenshot on every subscription before it can be
 * submitted, and it must show the purchase UI as the reviewer will see it.
 * The marketing screenshots never cover the paywall, so this captures it on its
 * own.
 *
 * Usage (from repo root):
 *   node scripts/app-store-screenshots/capture-paywall.mjs
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'docs/app-store-screenshots/iap-review');
const PORT = 19006;
const BASE = `http://localhost:${PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function ensureExpo() {
  if (await portOpen(PORT)) {
    console.log(`Expo already on :${PORT}`);
    return null;
  }
  console.log('Starting Expo web…');
  const child = spawn('npx', ['expo', 'start', '--web', '--port', String(PORT)], {
    cwd: ROOT,
    shell: true,
    stdio: 'ignore',
    env: { ...process.env, EXPO_PUBLIC_E2E: '1', EXPO_PUBLIC_E2E_STUB_API: '1' },
  });
  for (let i = 0; i < 90; i++) {
    await sleep(2000);
    if (await portOpen(PORT)) {
      console.log('Expo ready');
      return child;
    }
  }
  throw new Error('Expo web failed to start within 3 minutes');
}

async function runOnboardingToPaywall(page) {
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByText('What do you need help with?').waitFor();
  await page.getByRole('button', { name: 'Algebra' }).click();
  await page.getByRole('button', { name: 'Calculus' }).click();
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
  await page.getByText('Your tutor is ready.').waitFor({ timeout: 60_000 });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let expoChild = null;
  let browser = null;
  try {
    expoChild = await ensureExpo();
    // CI images sometimes carry a Chromium that does not match the pinned
    // Playwright build; honour an explicit path when one is provided.
    browser = await chromium.launch(
      process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
    );
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
    });
    const page = await context.newPage();

    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    await page.getByText('Math that finally').waitFor({ timeout: 60_000 });

    await runOnboardingToPaywall(page);
    await page.getByTestId('paywall-start').waitFor({ timeout: 30_000 });

    // The simulated-purchase button only exists because web has no StoreKit.
    // A reviewer must see the real purchase UI, so hide it (and scrollbars).
    await page.addStyleTag({
      content: `
        [data-testid="paywall-test-purchase"] { display: none !important; }
        *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
        body { overflow: hidden !important; }
      `,
    });
    await sleep(1200);

    const out = path.join(OUT_DIR, 'paywall.png');
    await page.screenshot({ path: out, type: 'png' });
    console.log('captured →', path.relative(ROOT, out));
  } finally {
    if (browser) await browser.close();
    if (expoChild) expoChild.kill('SIGTERM');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
