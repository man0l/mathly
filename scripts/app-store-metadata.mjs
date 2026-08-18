#!/usr/bin/env node
/**
 * Push the App Store listing metadata that Apple's automated 3.1.2 check reads.
 *
 * Guideline 3.1.2 rejects an auto-renewable subscription app whose *metadata*
 * has no functional Terms of Use (EULA) link. Two places have to carry it, and
 * neither lives in this repo's build output, so keeping the copy in a markdown
 * doc is not a fix — it has to be written into App Store Connect:
 *
 *   1. the App Store description (what the automated check scans), and
 *   2. the custom EULA on App Information (agreement *text*, not a URL).
 *
 *   node scripts/app-store-metadata.mjs --check      # copy + links (no creds)
 *   node scripts/app-store-metadata.mjs --push       # write it to App Store Connect
 *   node scripts/app-store-metadata.mjs --preflight  # audit the live listing
 *
 * --push and --preflight need the same secrets the TestFlight upload uses:
 *   APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID,
 *   APP_STORE_CONNECT_API_KEY_BASE64 (base64 of the .p8)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALE = 'en-US';
const BUNDLE_ID = 'com.balkanbit.mathly';
const API = 'https://api.appstoreconnect.apple.com';

// Apple's limits — exceeding either is a silent 409 from the API.
const MAX_DESCRIPTION = 4000;
const MAX_EULA = 10000;

/** Version states whose localized metadata App Store Connect still lets you edit. */
const EDITABLE_STATES = new Set([
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
  'WAITING_FOR_EXPORT_COMPLIANCE',
]);

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** The app and the listing must point at the same legal pages, so both read from links.ts. */
function legalLinks() {
  const src = read('src/lib/links.ts');
  const links = {};
  for (const [, key, url] of src.matchAll(/(\w+):\s*'(https:\/\/[^']+)'/g)) links[key] = url;
  if (!links.terms || !links.privacy) {
    throw new Error('src/lib/links.ts no longer exposes terms/privacy URLs');
  }
  return links;
}

function metadata() {
  const description = read(`docs/app-store-metadata/${LOCALE}/description.txt`).trim();
  const eula = read(`docs/app-store-metadata/${LOCALE}/eula.txt`).trim();
  return { description, eula, links: legalLinks() };
}

/* ------------------------------- checks -------------------------------- */

async function urlIsFunctional(url) {
  // Apple follows the link like a user would, so a redirect that lands on a
  // real page is fine — only the final status and body matter.
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) return `HTTP ${res.status}`;
  const body = await res.text();
  if (body.length < 500) return 'page is suspiciously empty';
  return null;
}

/**
 * Prices the paywall shows as its fallback copy. A figure the listing and the
 * paywall disagree on is a rejection on its own, so they are compared here
 * rather than discovered during review.
 */
function paywallPrices() {
  const src = read('src/screens/PaywallScreen.tsx');
  const plans = src.slice(src.indexOf('const PLANS'), src.indexOf('/** Merge the live store prices'));
  return [...plans.matchAll(/price: '(\$[\d.]+)'/g)].map((m) => m[1]);
}

async function check({ offline = false } = {}) {
  const { description, eula, links } = metadata();
  const problems = [];

  const prices = paywallPrices();
  if (prices.length < 2) {
    problems.push('could not read the fallback plan prices out of PaywallScreen.tsx');
  }
  for (const price of prices) {
    if (!description.includes(price)) problems.push(`description does not mention the ${price} plan price shown on the paywall`);
    if (!eula.includes(price)) problems.push(`EULA does not mention the ${price} plan price shown on the paywall`);
  }

  if (description.length > MAX_DESCRIPTION) {
    problems.push(`description is ${description.length} chars (max ${MAX_DESCRIPTION})`);
  }
  if (eula.length > MAX_EULA) {
    problems.push(`EULA is ${eula.length} chars (max ${MAX_EULA})`);
  }
  // The automated 3.1.2 check scans the description text itself, so the URLs
  // have to appear there verbatim — and be the ones the app itself opens.
  for (const key of ['terms', 'privacy']) {
    if (!description.includes(links[key])) {
      problems.push(`description is missing the ${key} URL ${links[key]} (from src/lib/links.ts)`);
    }
  }
  if (!eula.includes(links.terms)) {
    problems.push(`EULA text should point back at ${links.terms}`);
  }

  if (!offline) {
    for (const key of ['terms', 'privacy']) {
      const failure = await urlIsFunctional(links[key]);
      if (failure) problems.push(`${key} link ${links[key]} is not functional: ${failure}`);
      else console.log(`  ok  ${links[key]}`);
    }
  }

  if (problems.length) {
    console.error('\nApp Store metadata check failed:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`  ok  description ${description.length} chars, EULA ${eula.length} chars`);
  console.log(`  ok  paywall prices ${prices.join(', ')} match the description and EULA`);
  console.log('App Store metadata check passed.');
}

/* ---------------------------- App Store Connect ------------------------- */

function token() {
  const keyId = process.env.APP_STORE_CONNECT_KEY_ID;
  const issuerId = process.env.APP_STORE_CONNECT_ISSUER_ID;
  const keyBase64 = process.env.APP_STORE_CONNECT_API_KEY_BASE64;
  const missing = [
    ['APP_STORE_CONNECT_KEY_ID', keyId],
    ['APP_STORE_CONNECT_ISSUER_ID', issuerId],
    ['APP_STORE_CONNECT_API_KEY_BASE64', keyBase64],
  ].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`missing env: ${missing.join(', ')}`);

  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const input =
    `${b64({ alg: 'ES256', kid: keyId, typ: 'JWT' })}.` +
    `${b64({ iss: issuerId, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' })}`;
  // ES256 wants the raw r||s pair; Node defaults to DER, which Apple rejects.
  const signature = crypto.sign('sha256', Buffer.from(input), {
    key: Buffer.from(keyBase64, 'base64').toString('utf8'),
    dsaEncoding: 'ieee-p1363',
  });
  return `${input}.${signature.toString('base64url')}`;
}

function client(jwt) {
  return async function call(method, endpoint, body) {
    const res = await fetch(endpoint.startsWith('http') ? endpoint : `${API}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${jwt}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = json?.errors?.map((e) => `${e.title}: ${e.detail}`).join('; ') || res.statusText;
      throw new Error(`${method} ${endpoint} → ${res.status} ${detail}`);
    }
    return json;
  };
}

async function push() {
  const { description, eula, links } = metadata();

  // Never publish a link Apple will find dead — that is the rejection itself.
  for (const key of ['terms', 'privacy']) {
    const failure = await urlIsFunctional(links[key]);
    if (failure) throw new Error(`refusing to push: ${key} link ${links[key]} is not functional (${failure})`);
  }

  const call = client(token());

  const apps = await call('GET', `/v1/apps?filter[bundleId]=${BUNDLE_ID}&limit=1`);
  const app = apps.data[0];
  if (!app) throw new Error(`no app record for ${BUNDLE_ID}`);
  console.log(`App: ${app.attributes.name} (${app.id})`);

  // 1. Description — the field the automated 3.1.2 check scans.
  const versions = await call(
    'GET',
    `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10`,
  );
  const version = versions.data.find((v) => EDITABLE_STATES.has(v.attributes.appStoreState));
  if (!version) {
    const states = versions.data.map((v) => `${v.attributes.versionString} (${v.attributes.appStoreState})`);
    throw new Error(
      `no editable iOS version — found: ${states.join(', ') || 'none'}. ` +
        'Reject the build in App Store Connect (or add a new version) before pushing metadata.',
    );
  }
  console.log(`Version: ${version.attributes.versionString} (${version.attributes.appStoreState})`);

  const versionLocales = await call(
    'GET',
    `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`,
  );
  const versionLocale = versionLocales.data.find((l) => l.attributes.locale === LOCALE);
  if (!versionLocale) throw new Error(`version has no ${LOCALE} localization`);
  await call('PATCH', `/v1/appStoreVersionLocalizations/${versionLocale.id}`, {
    data: {
      type: 'appStoreVersionLocalizations',
      id: versionLocale.id,
      attributes: { description },
    },
  });
  console.log('  ✓ description updated (Terms of Use + Privacy Policy links included)');

  // 2. Privacy policy URL, on App Information rather than the version.
  const appInfos = await call('GET', `/v1/apps/${app.id}/appInfos?limit=10`);
  const appInfo = appInfos.data[0];
  if (appInfo) {
    const infoLocales = await call(
      'GET',
      `/v1/appInfos/${appInfo.id}/appInfoLocalizations?limit=50`,
    );
    const infoLocale = infoLocales.data.find((l) => l.attributes.locale === LOCALE);
    if (infoLocale) {
      await call('PATCH', `/v1/appInfoLocalizations/${infoLocale.id}`, {
        data: {
          type: 'appInfoLocalizations',
          id: infoLocale.id,
          attributes: { privacyPolicyUrl: links.privacy },
        },
      });
      console.log(`  ✓ privacy policy URL set to ${links.privacy}`);
    }
  }

  // 3. Custom EULA. App Store Connect stores agreement *text*, not a URL, so
  //    the text carries the canonical link back to the hosted page.
  const territories = await call('GET', '/v1/territories?limit=200');
  const territoryIds = territories.data.map((t) => ({ type: 'territories', id: t.id }));
  const existing = await call('GET', `/v1/apps/${app.id}/endUserLicenseAgreement`);
  if (existing?.data) {
    await call('PATCH', `/v1/endUserLicenseAgreements/${existing.data.id}`, {
      data: {
        type: 'endUserLicenseAgreements',
        id: existing.data.id,
        attributes: { agreementText: eula },
        relationships: { territories: { data: territoryIds } },
      },
    });
    console.log(`  ✓ custom EULA updated (${territoryIds.length} territories)`);
  } else {
    await call('POST', '/v1/endUserLicenseAgreements', {
      data: {
        type: 'endUserLicenseAgreements',
        attributes: { agreementText: eula },
        relationships: {
          app: { data: { type: 'apps', id: app.id } },
          territories: { data: territoryIds },
        },
      },
    });
    console.log(`  ✓ custom EULA created (${territoryIds.length} territories)`);
  }

  console.log('\nMetadata pushed. Submit for review from App Store Connect.');
}


/* ------------------------------- preflight ------------------------------ */

/**
 * Audit the live listing against what Apple's pre-review automation rejects
 * for. Every check is independent and degrades to a warning if the API shape
 * surprises us — a preflight that crashes tells you nothing.
 */
async function preflight() {
  const { links } = metadata();
  const call = client(token());
  const results = [];
  const record = (level, message) => results.push({ level, message });

  const guard = async (label, fn) => {
    try {
      await fn();
    } catch (err) {
      record('warn', `${label}: could not verify (${err.message})`);
    }
  };

  const apps = await call('GET', `/v1/apps?filter[bundleId]=${BUNDLE_ID}&limit=1`);
  const app = apps.data[0];
  if (!app) throw new Error(`no app record for ${BUNDLE_ID}`);
  console.log(`App: ${app.attributes.name} (${app.id})\n`);

  const versions = await call('GET', `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10`);
  const version = versions.data.find((v) => EDITABLE_STATES.has(v.attributes.appStoreState)) ?? versions.data[0];
  if (!version) throw new Error('the app has no iOS version yet');
  record('ok', `version ${version.attributes.versionString} (${version.attributes.appStoreState})`);

  // A version with no build attached cannot be submitted at all.
  await guard('build', async () => {
    const build = await call('GET', `/v1/appStoreVersions/${version.id}/build`);
    if (build?.data) record('ok', `build ${build.data.attributes?.version ?? build.data.id} attached`);
    else record('fail', 'no build attached to this version — upload one via the testflight-release job');
  });

  // 3.1.2: the description is what the automated check reads.
  let versionLocale = null;
  await guard('description', async () => {
    const locales = await call('GET', `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`);
    versionLocale = locales.data.find((l) => l.attributes.locale === LOCALE);
    if (!versionLocale) return record('fail', `version has no ${LOCALE} localization`);
    const live = versionLocale.attributes.description ?? '';
    for (const key of ['terms', 'privacy']) {
      if (live.includes(links[key])) record('ok', `description carries the ${key} link`);
      else record('fail', `description is missing the ${key} link ${links[key]} — this is the 3.1.2 rejection; run --push`);
    }
    if ((versionLocale.attributes.supportUrl ?? '').trim()) record('ok', 'support URL set');
    else record('fail', 'support URL is empty (required field)');
  });

  // 3.1.2: the custom EULA on App Information.
  await guard('EULA', async () => {
    const eula = await call('GET', `/v1/apps/${app.id}/endUserLicenseAgreement`);
    const text = eula?.data?.attributes?.agreementText ?? '';
    if (text.trim().length > 200) record('ok', `custom EULA present (${text.length} chars)`);
    else record('fail', 'no custom EULA on App Information — run --push');
  });

  // 5.1.1: privacy policy URL.
  await guard('privacy policy URL', async () => {
    const appInfos = await call('GET', `/v1/apps/${app.id}/appInfos?limit=10`);
    const appInfo = appInfos.data[0];
    if (!appInfo) return record('warn', 'no App Information record found');
    const locales = await call('GET', `/v1/appInfos/${appInfo.id}/appInfoLocalizations?limit=50`);
    const infoLocale = locales.data.find((l) => l.attributes.locale === LOCALE);
    const url = infoLocale?.attributes?.privacyPolicyUrl ?? '';
    if (url) record('ok', `privacy policy URL set (${url})`);
    else record('fail', 'privacy policy URL is empty — run --push');
    const declaration = await call('GET', `/v1/appInfos/${appInfo.id}/ageRatingDeclaration`).catch(() => null);
    if (declaration?.data) record('ok', 'age rating declaration filled in');
    else record('warn', 'age rating declaration not verified — confirm the questionnaire is answered');
  });

  // 2.3.3: screenshots are a hard submission requirement.
  await guard('screenshots', async () => {
    if (!versionLocale) return;
    const sets = await call('GET', `/v1/appStoreVersionLocalizations/${versionLocale.id}/appScreenshotSets?limit=20`);
    const types = sets.data.map((s) => s.attributes.screenshotDisplayType);
    if (types.length) record('ok', `screenshot sets: ${types.join(', ')}`);
    else record('fail', 'no screenshots uploaded for this version');
  });

  // 2.1 / 3.1.2: the subscriptions themselves must be submittable, and each
  // one needs its own review screenshot — the most commonly missed field.
  await guard('subscriptions', async () => {
    const groups = await call('GET', `/v1/apps/${app.id}/subscriptionGroups?limit=10`);
    if (!groups.data.length) return record('fail', 'no subscription groups — review cannot see the products (2.1)');
    const paywall = paywallPrices();
    for (const group of groups.data) {
      const subs = await call(
        'GET',
        `/v1/subscriptionGroups/${group.id}/subscriptions?limit=20&include=introductoryOffers`,
      );
      if (!subs.data.length) record('fail', `subscription group ${group.id} has no products`);
      for (const sub of subs.data) {
        const { name, productId, state } = sub.attributes;
        const submittable = ['READY_TO_SUBMIT', 'APPROVED', 'WAITING_FOR_REVIEW', 'IN_REVIEW'];
        if (submittable.includes(state)) record('ok', `${productId} — ${state}`);
        else record('fail', `${productId} is ${state}; it will not be reviewed with the build (2.1)`);

        await guard(`${productId} review screenshot`, async () => {
          const shot = await call('GET', `/v1/subscriptions/${sub.id}/appStoreReviewScreenshot`);
          if (shot?.data) record('ok', `${productId} has a review screenshot`);
          else record('fail', `${productId} has no review screenshot — required before submission (npm run screenshots:paywall)`);
        });

        await guard(`${productId} price`, async () => {
          const prices = await call(
            'GET',
            `/v1/subscriptions/${sub.id}/prices?include=subscriptionPricePoint&filter[territory]=USA&limit=10`,
          );
          const point = prices.included?.find((i) => i.type === 'subscriptionPricePoints');
          const customerPrice = point?.attributes?.customerPrice;
          if (!customerPrice) return record('warn', `${productId}: no US price returned to compare`);
          const shown = `$${Number(customerPrice).toFixed(2)}`;
          if (paywall.includes(shown)) record('ok', `${productId} US price ${shown} matches the paywall`);
          else record('fail', `${productId} US price is ${shown}; the paywall's fallback copy says ${paywall.join(' / ')}`);
        });

        if (!name) record('warn', `${productId} has no display name`);
      }
    }
  });

  console.log('Preflight:');
  const icon = { ok: '  ✓', warn: '  ⚠', fail: '  ✗' };
  for (const r of results) console.log(`${icon[r.level]} ${r.message}`);

  const failures = results.filter((r) => r.level === 'fail');
  const warnings = results.filter((r) => r.level === 'warn');
  console.log(
    `\n${failures.length} blocking, ${warnings.length} to confirm by hand, ` +
      `${results.length - failures.length - warnings.length} passing.`,
  );
  if (failures.length) {
    console.error('\nSubmitting like this invites a rejection. Fix the ✗ items first.');
    process.exit(1);
  }
  console.log('Nothing Apple checks automatically is missing. Good to submit.');
}

const args = process.argv.slice(2);
const mode = args.find((a) => a === '--push' || a === '--check' || a === '--preflight') ?? '--check';
try {
  if (mode === '--push') await push();
  else if (mode === '--preflight') await preflight();
  else await check({ offline: args.includes('--offline') });
} catch (err) {
  console.error(`\n${err.message}`);
  process.exit(1);
}
