/**
 * Generate brand assets (icon, adaptive icons, favicon, splash) plus the e2e
 * test-problem image by rendering HTML with Playwright and screenshotting it.
 * Run: npm run assets  (from repo root)
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const PUBLIC = path.join(ROOT, 'public');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function png(page, html, out, { width, height, transparent = false } = {}) {
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: 'load' });
  await sleep(300);
  await page.screenshot({ path: out, type: 'png', omitBackground: transparent });
  console.log('wrote', path.relative(ROOT, out));
}

const scanCorners = (c, s = 10, w = 14, cap = 8) => `
  <div style="position:absolute;inset:0;">
    ${['tl', 'tr', 'bl', 'br']
      .map((corner) => {
        const horiz = corner[1] === 'l' ? 'left' : 'right';
        const vert = corner[0] === 't' ? 'top' : 'bottom';
        const bH = corner[1] === 'l' ? 'border-left' : 'border-right';
        const bV = corner[0] === 't' ? 'border-top' : 'border-bottom';
        const r =
          corner === 'tl' ? 'border-top-left-radius' : corner === 'tr' ? 'border-top-right-radius' : corner === 'bl' ? 'border-bottom-left-radius' : 'border-bottom-right-radius';
        return `<div style="position:absolute;${vert}:${vert === 'top' ? -w / 2 : -w / 2}px;${horiz}:${horiz === 'left' ? -w / 2 : -w / 2}px;width:${s * 3.2}px;height:${s * 3.2}px;${bV}:${w}px solid #fff;${bH}:${w}px solid #fff;${r}:${cap}px;"></div>`;
      })
      .join('')}
  </div>`;

function iconHtml({ size, bg = true }) {
  return `<!DOCTYPE html><html><head><style>
    * { margin: 0; padding: 0; }
    body { width: ${size}px; height: ${size}px; overflow: hidden; ${bg ? 'background: linear-gradient(135deg, #7C5CFC 0%, #4D7CFE 100%);' : 'background: transparent;'} }
    .wrap { position: relative; width: 100%; height: 100%; }
    .frame { position: absolute; inset: 22%; }
    .dot { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: ${size * 0.07}px; height: ${size * 0.07}px; border-radius: 50%; background: #fff; }
  </style></head><body>
    <div class="wrap">
      <div class="frame">${scanCorners('#fff', size * 0.09, size * 0.055, size * 0.05)}</div>
      <div class="dot"></div>
    </div>
  </body></html>`;
}

const splashHtml = (size) => `<!DOCTYPE html><html><head><style>
  * { margin: 0; padding: 0; }
  body { width: ${size}px; height: ${size}px; background: #0B0E17; display: flex; align-items: center; justify-content: center; }
  .icon { width: ${size * 0.22}px; height: ${size * 0.22}px; border-radius: ${size * 0.06}px; background: linear-gradient(135deg, #7C5CFC, #4D7CFE); position: relative; box-shadow: 0 0 80px rgba(124,92,252,0.45); }
  .frame { position: absolute; inset: 24%; }
</style></head><body>
  <div class="icon"><div class="frame">${scanCorners('#fff', size * 0.02, size * 0.013, size * 0.012)}</div>
  <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${size * 0.016}px;height:${size * 0.016}px;border-radius:50%;background:#fff;"></div></div>
</body></html>`;

const testProblemHtml = `<!DOCTYPE html><html><head><style>
  * { margin: 0; padding: 0; }
  body { width: 640px; height: 840px; background: #F6F3EC; display: flex; align-items: center; justify-content: center; }
  .paper { width: 520px; height: 700px; background: #FFFDF8; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.10); padding: 60px 50px; box-sizing: border-box; font-family: "Segoe Print", "Comic Sans MS", "Bradley Hand", cursive; color: #17202E; position: relative; }
  .lines { position: absolute; inset: 50px; background: repeating-linear-gradient(transparent, transparent 45px, rgba(23,32,46,0.08) 45px, rgba(23,32,46,0.08) 46px); }
  .q { font-size: 44px; line-height: 92px; }
  .num { position: absolute; top: 46px; left: -34px; font-size: 30px; color: #6B7280; font-family: Georgia, serif; }
</style></head><body>
  <div class="paper">
    <div class="lines"></div>
    <div style="position:relative;">
      <div class="num">3.</div>
      <div class="q">Solve:&nbsp;&nbsp;2x² − 5x − 3 = 0</div>
      <div class="q" style="color:#3A4658;">Show every step.</div>
    </div>
  </div>
</body></html>`;

async function main() {
  await mkdir(ASSETS, { recursive: true });
  await mkdir(path.join(PUBLIC, 'e2e'), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  await png(page, iconHtml({ size: 1024, bg: true }), path.join(ASSETS, 'icon.png'), { width: 1024, height: 1024 });

  // Adaptive icon foreground: transparent bg, centered glyph at safe-zone scale.
  await png(
    page,
    iconHtml({ size: 512, bg: false }),
    path.join(ASSETS, 'android-icon-foreground.png'),
    { width: 512, height: 512, transparent: true },
  );
  await png(
    page,
    `<!DOCTYPE html><html><body style="margin:0;width:512px;height:512px;background:#0B0E17"></body></html>`,
    path.join(ASSETS, 'android-icon-background.png'),
    { width: 512, height: 512 },
  );
  await png(
    page,
    iconHtml({ size: 512, bg: false }),
    path.join(ASSETS, 'android-icon-monochrome.png'),
    { width: 512, height: 512, transparent: true },
  );

  await png(page, iconHtml({ size: 196, bg: true }), path.join(ASSETS, 'favicon.png'), { width: 196, height: 196 });
  await png(page, splashHtml(1284), path.join(ASSETS, 'splash.png'), { width: 1284, height: 2778 });

  await png(page, testProblemHtml, path.join(PUBLIC, 'e2e', 'test-problem.png'), { width: 640, height: 840 });

  await browser.close();
  console.log('Assets done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
