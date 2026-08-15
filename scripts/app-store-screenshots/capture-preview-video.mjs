/**
 * Record the app demo / App Store preview video (Expo web + Playwright), then
 * transcode to Apple's spec with ffmpeg.
 *
 * Apple's accepted app-preview resolution for iPhone 6.9"/6.5" is 886x1920
 * portrait — NOT the device resolution used for screenshots. Length must be
 * 15-30s, H.264, max 30fps, .mov/.m4v/.mp4.
 *
 * By default this runs against the REAL backend (set api/.env) so the demo
 * shows a genuine AI solve. Pass --stub to use the canned solution instead.
 *
 * Usage (from repo root):
 *   node scripts/app-store-screenshots/capture-preview-video.mjs [--stub]
 */
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'docs/app-store-screenshots/preview');
const WORK = path.join(ROOT, 'docs/app-store-screenshots/_work/video');
const PORT = 19006;
const BASE = `http://localhost:${PORT}`;
const STUB = process.argv.includes('--stub');

// Playwright records at VIEWPORT size and does not scale the page up to
// recordVideo.size; deviceScaleFactor is ignored for video. Record at exactly
// the viewport size and upscale in ffmpeg instead. 443x960 is the same 19.5:9
// aspect as the 886x1920 output.
const VIEW_W = 443;
const VIEW_H = 960;
const OUT_W = 886;
const OUT_H = 1920;
const MAX_SECONDS = 29;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    console.log(`Expo already on :${PORT} — assuming it has the right env`);
    return null;
  }
  console.log('Starting Expo web…');
  const child = spawn('npx', ['expo', 'start', '--web', '--port', String(PORT)], {
    cwd: ROOT,
    env: {
      ...process.env,
      ...loadDotEnv(),
      EXPO_PUBLIC_E2E: '1',
      EXPO_PUBLIC_E2E_STUB_API: STUB ? '1' : '0',
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

/** Give the scanner a live-looking feed: handwritten equation on ruled paper. */
async function injectFakeCamera(page) {
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 480);
    g.addColorStop(0, '#22293F');
    g.addColorStop(1, '#0D1120');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, 480);
    ctx.strokeStyle = 'rgba(148,163,204,0.22)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 70);
      ctx.lineTo(640, i * 70);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(232,238,252,0.92)';
    ctx.font = '36px Georgia, serif';
    ctx.fillText('2x² − 5x − 3 = 0', 150, 240);
    ctx.font = '22px Georgia, serif';
    ctx.fillStyle = 'rgba(178,188,212,0.8)';
    ctx.fillText('Solve. Show every step.', 195, 300);
    const stream = canvas.captureStream(30);
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = async () => stream;
    }
  });
}

async function record(context, page) {
  // Seed a returning, subscribed user so the video opens straight on Home.
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('mathly-onboarded-v1', '1');
    localStorage.setItem(
      'mathly-profile-v1',
      JSON.stringify({
        subjects: ['Algebra', 'Calculus'],
        level: 'High school',
        goal: 'Actually understand',
        stuckOn: ['Word problems'],
        explainStyle: 'Step by step',
      }),
    );
    localStorage.setItem('mathly-pro-v1', '1');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);
  await page.getByText('Ready to solve?').waitFor({ timeout: 90_000 });

  await sleep(1400); // beat on Home

  // Open the scanner (fake live feed) and hover a beat.
  await page.getByRole('button', { name: 'Scan a problem' }).click();
  await page.getByText('Fit the equation inside the frame').waitFor({ timeout: 30_000 });
  await sleep(1800);

  // Capture the problem → real (or stub) analyzing animation.
  await page.getByTestId('e2e-use-test-photo').click();
  await page.getByText('Reading the problem').waitFor({ timeout: 30_000 });
  // Wait for the solution to land (real API can take a while).
  await page.getByText('Verified by substitution').waitFor({ timeout: 150_000 });
  await sleep(1200);

  // Reveal steps one by one.
  const reveal = page.getByTestId('reveal-next-step');
  for (let i = 0; i < 6 && (await reveal.isVisible().catch(() => false)); i++) {
    await reveal.click();
    await sleep(900);
  }
  await sleep(700);

  // Scroll to the graph.
  const graph = page.getByText('SEE IT');
  await graph.waitFor({ timeout: 10_000 });
  await graph.scrollIntoViewIfNeeded();
  await sleep(1600);

  // Ask the suggested follow-up.
  const chip = page.getByRole('button', { name: 'Why the ±?' });
  if (await chip.isVisible().catch(() => false)) {
    await chip.click();
  } else {
    await page.getByRole('button', { name: 'Ask a follow-up…' }).click().catch(() => {});
  }
  await page.getByText('Think', { exact: false }).first().waitFor({ timeout: 90_000 }).catch(() => {});
  await sleep(2000);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(WORK, { recursive: true });
  // Playwright names recordings page@<guid>.webm — clear every leftover so
  // ffmpeg never picks up a partial file from an aborted run.
  for (const f of await readdir(WORK)) {
    if (f.endsWith('.webm')) await rm(path.join(WORK, f), { force: true });
  }

  let expoChild = null;
  try {
    expoChild = await ensureExpo();
    await sleep(2500);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: VIEW_W, height: VIEW_H },
      recordVideo: {
        dir: WORK,
        size: { width: VIEW_W, height: VIEW_H },
      },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60_000);

    await injectFakeCamera(page);
    await record(context, page);

    // Finalize recording
    const video = page.video();
    await context.close();
    const filePath = await video?.path();
    await browser.close();

    if (!filePath) throw new Error('no video recorded');
    // Give the OS a beat to flush the finalized recording.
    await sleep(1500);
    const src = filePath;
    console.log('recorded', src);

    // Transcode to Apple's app-preview spec + a social-friendly square-ish cut.
    // App Store Connect rejects previews with no audio track — and does it
    // silently, so the upload just never appears. The recording has no sound,
    // so give the store cut a silent AAC track rather than stripping audio.
    const SILENT_AUDIO = ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'];
    const outs = {
      'app-preview-886x1920.mp4': {
        pre: SILENT_AUDIO,
        extra: [`-vf`, `scale=${OUT_W}:${OUT_H}:flags=lanczos`, `-t`, String(MAX_SECONDS)],
        audio: ['-c:a', 'aac', '-b:a', '128k', '-shortest'],
      },
      'demo-720p.mp4': {
        pre: [],
        extra: [`-vf`, `scale=720:-2`, `-t`, String(MAX_SECONDS)],
        audio: ['-an'],
      },
    };
    for (const [name, { pre, extra, audio }] of Object.entries(outs)) {
      const out = path.join(OUT_DIR, name);
      console.log('transcoding →', name);
      const res = spawnSync(
        'ffmpeg',
        ['-y', '-i', src, ...pre, ...extra, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', ...audio, out],
        { stdio: 'inherit', shell: true },
      );
      if (res.status !== 0) throw new Error(`ffmpeg failed for ${name}`);
    }
    console.log('Done →', path.relative(ROOT, OUT_DIR));
  } finally {
    if (expoChild) expoChild.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
