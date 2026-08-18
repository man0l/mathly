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
 *   node scripts/app-store-metadata.mjs --check   # verify copy + links (no creds)
 *   node scripts/app-store-metadata.mjs --push    # write it to App Store Connect
 *
 * --push needs the same secrets the TestFlight upload uses:
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

async function check({ offline = false } = {}) {
  const { description, eula, links } = metadata();
  const problems = [];

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

const args = process.argv.slice(2);
const mode = args.find((a) => a === '--push' || a === '--check') ?? '--check';
try {
  if (mode === '--push') await push();
  else await check({ offline: args.includes('--offline') });
} catch (err) {
  console.error(`\n${err.message}`);
  process.exit(1);
}
