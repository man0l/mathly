/**
 * Capture the app UI (Expo web + Playwright) and composite store marketing
 * screenshots for:
 *   - App Store 6.5"  (1242×2688)
 *   - App Store 6.9"  (1320×2868)
 *   - Play Store phone (1080×1920)
 *
 * Usage (from repo root, with Expo web already running on :19006 OR let this start it):
 *   node scripts/app-store-screenshots/capture-and-compose.mjs
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT_IOS_65 = path.join(ROOT, 'docs/app-store-screenshots/en-US');
const OUT_IOS_69 = path.join(ROOT, 'docs/app-store-screenshots/en-US-6.9in');
const OUT_ANDROID = path.join(ROOT, 'docs/app-store-screenshots/play-phone');
const RAW = path.join(ROOT, 'docs/app-store-screenshots/_raw');
const WORK = path.join(ROOT, 'docs/app-store-screenshots/_work');
const PORT = 19006;
const BASE = `http://localhost:${PORT}`;

const W_65 = 1242;
const H_65 = 2688;
// Apple's required 6.9" portrait size — exact, not derived from the 6.5" aspect.
const W_69 = 1320;
const H_69 = 2868;
// Play Store phone set.
const W_ANDROID = 1080;
const H_ANDROID = 1920;

function loadDotEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Real TCP connect against 127.0.0.1 — an HTTP probe can be answered by a
// system proxy for an unbound port and read as "open".
function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    const done = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(1500);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
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
    env: {
      ...process.env,
      ...loadDotEnv(),
      EXPO_PUBLIC_E2E: '1',
      EXPO_PUBLIC_E2E_STUB_API: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  for (let i = 0; i < 90; i++) {
    if (await portOpen(PORT)) {
      console.log('Expo ready');
      return child;
    }
    await sleep(2000);
  }
  throw new Error('Expo web failed to start within 3 minutes');
}

async function resetApp(page) {
  // Expo web keeps a websocket open — never use networkidle.
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Bundled fonts load async on web — wait for them or captures show fallbacks.
  await page.evaluate(() => document.fonts.ready);
  await page.getByText('Math that finally').waitFor({ timeout: 60_000 });
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

async function unlockPaywall(page) {
  await page.getByTestId('paywall-start').click();
  const test = page.getByRole('button', { name: 'Test valid purchase' });
  await test.waitFor({ timeout: 30_000 });
  await test.click();
  await page.getByText('Ready to solve?').waitFor({ timeout: 60_000 });
}

async function hideChrome(page) {
  await page.addStyleTag({
    content: `
      *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
      body { overflow: hidden !important; }
    `,
  });
}

async function captureViewport(page, name, settleMs = 1200) {
  await hideChrome(page);
  await sleep(settleMs);
  const out = path.join(RAW, `${name}.png`);
  await page.screenshot({ path: out, type: 'png' });
  console.log('captured', name);
  return out;
}

// ---------------------------------------------------------------------------
// Marketing composition

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Space+Grotesk:wght@500;700&display=swap';

function phoneFrameCss() {
  return `
    .phone {
      position: relative;
      width: 980px;
      height: 2000px;
      border-radius: 72px;
      border: 3px solid rgba(148, 163, 204, 0.35);
      background: #0B0E17;
      overflow: hidden;
      box-shadow: 0 40px 120px rgba(0,0,0,0.55);
    }
    .status {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 62px;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 48px 0;
      font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 26px;
      font-weight: 600;
      color: #fff;
      pointer-events: none;
    }
    .island {
      position: absolute;
      top: 18px;
      left: 50%;
      transform: translateX(-50%);
      width: 180px;
      height: 42px;
      background: #000;
      border-radius: 24px;
      z-index: 6;
    }
    .screen {
      position: absolute;
      inset: 0;
      overflow: hidden;
      background: #0B0E17;
    }
    .screen img { width: 100%; height: auto; display: block; transform-origin: top center; }
  `;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function marketingShell({ eyebrow, title, pill, phoneInner, phoneClass = '', extraStyle = '' }) {
  const titleHtml = title
    .split('\n')
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join('');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="${FONT_HREF}" rel="stylesheet" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${W_65}px;
    height: ${H_65}px;
    overflow: hidden;
    background: #070A12;
    font-family: "Space Grotesk", Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .canvas {
    width: ${W_65}px;
    height: ${H_65}px;
    position: relative;
    background:
      radial-gradient(ellipse 70% 40% at 50% 0%, rgba(124, 92, 252, 0.22) 0%, transparent 60%),
      radial-gradient(ellipse 50% 30% at 80% 20%, rgba(77, 124, 254, 0.12) 0%, transparent 50%),
      linear-gradient(180deg, #0E1322 0%, #070A12 55%, #05070D 100%);
    overflow: hidden;
  }
  .copy {
    position: absolute;
    top: 96px;
    left: 72px;
    right: 72px;
    z-index: 2;
  }
  .eyebrow {
    font-family: Inter, sans-serif;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.18em;
    color: #7C5CFC;
    margin-bottom: 22px;
  }
  .title {
    font-size: 72px;
    font-weight: 700;
    line-height: 1.05;
    color: #F2F4FB;
    letter-spacing: -0.02em;
    margin-bottom: 28px;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    background: #EDEFFB;
    color: #10141F;
    font-family: Inter, sans-serif;
    font-size: 26px;
    font-weight: 700;
    padding: 14px 28px;
    border-radius: 999px;
  }
  .pill-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #7C5CFC;
    flex-shrink: 0;
  }
  .phone-wrap {
    position: absolute;
    left: 50%;
    top: 540px;
    transform: translateX(-50%);
    z-index: 1;
  }
  ${phoneFrameCss()}
  ${extraStyle}
</style>
</head>
<body>
  <div class="canvas">
    <div class="copy">
      <div class="eyebrow">${escapeHtml(eyebrow)}</div>
      <div class="title">${titleHtml}</div>
      <div class="pill"><span class="pill-dot"></span>${escapeHtml(pill)}</div>
    </div>
    <div class="phone-wrap">
      <div class="phone ${phoneClass}">
        <div class="island"></div>
        <div class="status">
          <span>9:41</span>
          <span style="opacity:0.9;font-size:22px">●●●● ▮</span>
        </div>
        <div class="screen">${phoneInner}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** Hand-composed hero: scan frame over a handwritten equation photo. */
function heroPhoneInner(photoDataUrl) {
  return `
    <div style="position:relative;width:100%;height:100%;background:#070A12;">
      <img src="${photoDataUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 25%;margin:0;transform:none;" />
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,10,18,0.35) 0%,transparent 30%,transparent 45%,rgba(7,10,18,0.88) 100%);"></div>
      <div style="position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);width:70%;height:34%;">
        <div style="position:absolute;inset:0;">
          <div style="position:absolute;top:0;left:0;width:90px;height:90px;border-top:10px solid #7C5CFC;border-left:10px solid #7C5CFC;border-top-left-radius:26px;"></div>
          <div style="position:absolute;top:0;right:0;width:90px;height:90px;border-top:10px solid #4D7CFE;border-right:10px solid #4D7CFE;border-top-right-radius:26px;"></div>
          <div style="position:absolute;bottom:0;left:0;width:90px;height:90px;border-bottom:10px solid #4D7CFE;border-left:10px solid #4D7CFE;border-bottom-left-radius:26px;"></div>
          <div style="position:absolute;bottom:0;right:0;width:90px;height:90px;border-bottom:10px solid #7C5CFC;border-right:10px solid #7C5CFC;border-bottom-right-radius:26px;"></div>
        </div>
      </div>
      <div style="position:absolute;left:48px;right:48px;bottom:110px;display:flex;flex-direction:column;gap:24px;">
        <div style="align-self:flex-start;background:rgba(124,92,252,0.92);color:#fff;font-family:Inter,sans-serif;font-weight:800;font-size:26px;padding:14px 26px;border-radius:999px;">✓ x = 3 or x = −1/2</div>
        <div style="color:rgba(242,244,251,0.75);font-family:Inter,sans-serif;font-size:23px;font-weight:600;">Solved in 4.2s · 5 steps explained</div>
      </div>
    </div>
  `;
}

function appPhoneInner(imgDataUrl, { scale = 1.0, yOffset = -20, hideBottom = 140 } = {}) {
  // Phone content is 980 wide; source is 1170 (390*3). Scale to fill width.
  return `
    <div style="position:absolute;inset:0;overflow:hidden;">
      <img src="${imgDataUrl}" style="
        width: 100%;
        height: auto;
        margin: 0;
        transform: translateY(${yOffset}px) scale(${scale});
        transform-origin: top center;
      " />
      <div style="position:absolute;left:0;right:0;bottom:0;height:${hideBottom}px;background:linear-gradient(180deg,transparent, #0B0E17 40%);"></div>
    </div>
  `;
}

async function fileToDataUrl(filePath) {
  const buf = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

async function renderHtmlToPng(browser, html, outPath, { width = W_65, height = H_65 } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await sleep(700);
  await page.screenshot({ path: outPath, type: 'png' });
  await page.close();
  console.log('wrote', path.relative(ROOT, outPath));
}

// Target dimensions are explicit, not a uniform scale factor: App Store Connect
// requires exact pixel sizes (scaling 1242x2688 by 1320/1242 is 11px short).
async function scalePngWithCss(browser, srcPath, outPath, w, h, bg = '#0B0E17') {
  const dataUrl = await fileToDataUrl(srcPath);
  const html = `<!DOCTYPE html><html><body style="margin:0;background:${bg};width:${w}px;height:${h}px;overflow:hidden">
    <img src="${dataUrl}" style="width:${w}px;height:${h}px;object-fit:cover;object-position:top;display:block" />
  </body></html>`;
  await renderHtmlToPng(browser, html, outPath, { width: w, height: h });
}

const COPY = {
  '01-hero': {
    eyebrow: 'AI MATH TUTOR',
    title: 'Snap it. Solve it.\nActually get it.',
    pill: 'Step-by-step in seconds',
  },
  '02-scanner': {
    eyebrow: 'ANY PROBLEM',
    title: 'One photo is\nall it takes.',
    pill: 'Algebra to physics',
  },
  '03-solution': {
    eyebrow: 'STEP BY STEP',
    title: 'Every step,\nexplained.',
    pill: 'Reveal one step at a time',
  },
  '04-graph': {
    eyebrow: 'SEE THE MATH',
    title: 'Answers you can\npicture.',
    pill: 'Graphs built in',
  },
  '05-chat': {
    eyebrow: 'NEVER STUCK',
    title: 'Ask until\nit clicks.',
    pill: 'Follow-ups on any problem',
  },
  '06-history': {
    eyebrow: 'KEEP GOING',
    title: 'Your work,\nremembered.',
    pill: 'History across every subject',
  },
};

async function captureAll(browser) {
  await mkdir(RAW, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);

  // Scanner (02) — needs camera permission denied state → permission UI is
  // cleaner for marketing than a live feed; grant nothing.
  console.log('flow: scanner');
  await resetApp(page);
  // Skip straight past onboarding by seeding state.
  await page.evaluate(() => {
    localStorage.setItem('mathly-onboarded-v1', '1');
    localStorage.setItem('mathly-profile-v1', JSON.stringify({ subjects: ['Algebra', 'Calculus'], level: 'High school', goal: 'Actually understand', stuckOn: ['Word problems'], explainStyle: 'Step by step' }));
    localStorage.setItem('mathly-pro-v1', '1');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);
  await page.getByText('Ready to solve?').waitFor({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Scan a problem' }).click();
  // On web with no camera permission the scanner shows the friendly permission
  // card — for the marketing shot we want the viewfinder: fake granted state
  // by stubbing getUserMedia with a canvas feed.
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 480);
    g.addColorStop(0, '#1A2138');
    g.addColorStop(1, '#0D1120');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, 480);
    ctx.strokeStyle = 'rgba(148,163,204,0.25)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 80);
      ctx.lineTo(640, i * 80);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(226,232,249,0.85)';
    ctx.font = '34px Georgia, serif';
    ctx.fillText('2x² − 5x − 3 = 0', 150, 235);
    const stream = canvas.captureStream(30);
    navigator.mediaDevices.getUserMedia = async () => stream;
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);
  await page.getByText('Ready to solve?').waitFor({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Scan a problem' }).click();
  await page.getByText('Fit the equation inside the frame').waitFor({ timeout: 30_000 });
  await sleep(1500);
  await captureViewport(page, '02-scanner', 800);
  await page.getByRole('button', { name: 'Close scanner' }).click();
  await page.getByText('Ready to solve?').waitFor();

  // Solve via test photo (03 solution, 04 graph after reveal)
  console.log('flow: solution');
  await page.getByRole('button', { name: 'Scan a problem' }).click();
  await page.getByTestId('e2e-use-test-photo').click();
  await page.getByText('Reading the problem').waitFor();
  await page.getByText('Verified by substitution').waitFor({ timeout: 60_000 });
  await sleep(600);
  await captureViewport(page, '03-solution', 900);

  const reveal = page.getByTestId('reveal-next-step');
  for (let i = 0; i < 5 && (await reveal.isVisible().catch(() => false)); i++) {
    await reveal.click();
    await sleep(220);
  }
  await page.getByText('Full solution unlocked').waitFor();
  await captureViewport(page, '04-graph', 1000);

  // Follow-up chat (05)
  console.log('flow: follow-up');
  await page.getByRole('button', { name: 'Why the ±?' }).click();
  await page.getByText('Think of the ± sign', { exact: false }).waitFor({ timeout: 30_000 });
  await captureViewport(page, '05-chat', 800);

  // History (06) — back to home, tab over
  console.log('flow: history');
  await page.getByRole('button', { name: 'Go back' }).click();
  await page.getByText('Ready to solve?').waitFor();
  await page.getByRole('tab', { name: 'History' }).click();
  await page.getByText('Solve 2x² − 5x − 3 = 0').first().waitFor();
  await captureViewport(page, '06-history', 800);

  await context.close();
}

async function composeAll(browser) {
  await mkdir(WORK, { recursive: true });
  await mkdir(OUT_IOS_65, { recursive: true });
  await mkdir(OUT_IOS_69, { recursive: true });
  await mkdir(OUT_ANDROID, { recursive: true });

  const heroPath = path.join(ROOT, 'public/e2e/test-problem.png');
  const heroDataUrl = await fileToDataUrl(heroPath);

  // 01 hero — custom full-bleed composite
  {
    const c = COPY['01-hero'];
    const html = marketingShell({
      ...c,
      phoneInner: heroPhoneInner(heroDataUrl),
      phoneClass: 'bleed-bottom',
      extraStyle: `
        .phone-wrap { top: 500px; }
        .phone { width: 1040px; height: 2140px; border-radius: 78px; }
      `,
    });
    await writeFile(path.join(WORK, '01-hero.html'), html);
    await renderHtmlToPng(browser, html, path.join(OUT_IOS_65, '01-hero.png'));
  }

  const appShots = [
    { id: '02-scanner', yOffset: 0, scale: 1.0, hideBottom: 0, phoneTop: 540 },
    { id: '03-solution', yOffset: -10, scale: 1.0, hideBottom: 120, phoneTop: 520 },
    { id: '04-graph', yOffset: -30, scale: 1.0, hideBottom: 60, phoneTop: 520 },
    { id: '05-chat', yOffset: -20, scale: 1.0, hideBottom: 60, phoneTop: 520 },
    { id: '06-history', yOffset: -10, scale: 1.0, hideBottom: 60, phoneTop: 520 },
  ];

  for (const shot of appShots) {
    const rawPath = path.join(RAW, `${shot.id}.png`);
    if (!existsSync(rawPath)) {
      console.warn('missing raw capture', shot.id);
      continue;
    }
    const imgDataUrl = await fileToDataUrl(rawPath);
    const c = COPY[shot.id];
    const html = marketingShell({
      ...c,
      phoneInner: appPhoneInner(imgDataUrl, shot),
      phoneClass: 'bleed-bottom',
      extraStyle: `.phone-wrap { top: ${shot.phoneTop}px; }`,
    });
    await writeFile(path.join(WORK, `${shot.id}.html`), html);
    await renderHtmlToPng(browser, html, path.join(OUT_IOS_65, `${shot.id}.png`));
  }

  // Scale 6.5 → 6.9 and → Android 1080x1920
  for (const id of Object.keys(COPY)) {
    const src = path.join(OUT_IOS_65, `${id}.png`);
    if (!existsSync(src)) continue;
    await scalePngWithCss(browser, src, path.join(OUT_IOS_69, `${id}.png`), W_69, H_69, '#070A12');
    await scalePngWithCss(browser, src, path.join(OUT_ANDROID, `${id}.png`), W_ANDROID, H_ANDROID, '#070A12');
  }
}

async function main() {
  let expoChild = null;
  try {
    expoChild = await ensureExpo();
    await sleep(3000);

    const browser = await chromium.launch({ headless: true });
    console.log('Capturing app screens…');
    await captureAll(browser);
    console.log('Compositing marketing frames…');
    await composeAll(browser);
    await browser.close();
    console.log('Done.');
    console.log('App Store 6.5" →', path.relative(ROOT, OUT_IOS_65));
    console.log('App Store 6.9" →', path.relative(ROOT, OUT_IOS_69));
    console.log('Play phone    →', path.relative(ROOT, OUT_ANDROID));
  } finally {
    if (expoChild) expoChild.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
