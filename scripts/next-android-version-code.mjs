#!/usr/bin/env node
// Computes the next safe Android versionCode by asking Google Play Console
// for the highest versionCode it has ever seen across all tracks, so a build
// can never regress below what Play already knows about. That's the failure
// mode this script exists to prevent: a CI workflow keyed off
// github.run_number resets to 1 whenever the workflow file is recreated
// (renamed, deleted+restored, etc.), producing a versionCode Play Console
// has already served, which it rejects with "does not allow any existing
// users to upgrade to the newly added APKs."
//
// Prints the version code to stdout (nothing else); diagnostics go to
// stderr. Falls back to ANDROID_FALLBACK_VERSION_CODE when Play can't be
// queried (no service account configured, first-ever release, network
// issue) — never lower than that fallback either way.

import crypto from 'node:crypto';

const packageName = process.env.ANDROID_PACKAGE_NAME;
const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
const fallback = Number(process.env.ANDROID_FALLBACK_VERSION_CODE ?? 1);

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), serviceAccount.private_key);
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  return body.access_token;
}

async function maxVersionCodeOnPlay(pkg, token) {
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}`;
  const authHeaders = { Authorization: `Bearer ${token}` };

  const editRes = await fetch(`${base}/edits`, { method: 'POST', headers: authHeaders });
  if (editRes.status === 404) return 0; // no Play Console listing yet — nothing to collide with
  if (!editRes.ok) throw new Error(`create edit failed: ${editRes.status} ${await editRes.text()}`);
  const { id: editId } = await editRes.json();

  let max = 0;
  try {
    const tracksRes = await fetch(`${base}/edits/${editId}/tracks`, { headers: authHeaders });
    if (tracksRes.ok) {
      const { tracks } = await tracksRes.json();
      for (const track of tracks ?? []) {
        for (const release of track.releases ?? []) {
          for (const vc of release.versionCodes ?? []) {
            max = Math.max(max, Number(vc));
          }
        }
      }
    } else if (tracksRes.status !== 404) {
      throw new Error(`list tracks failed: ${tracksRes.status} ${await tracksRes.text()}`);
    }
  } finally {
    await fetch(`${base}/edits/${editId}`, { method: 'DELETE', headers: authHeaders }).catch(() => {});
  }
  return max;
}

async function computeVersionCode() {
  if (!packageName) throw new Error('ANDROID_PACKAGE_NAME is required');
  if (!serviceAccountJson) {
    console.warn('warn: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON unset — using fallback version code');
    return fallback;
  }
  try {
    const token = await getAccessToken(JSON.parse(serviceAccountJson));
    const maxKnown = await maxVersionCodeOnPlay(packageName, token);
    return Math.max(maxKnown + 1, fallback);
  } catch (err) {
    console.warn(`warn: could not query Play Console (${err.message}) — using fallback version code`);
    return fallback;
  }
}

computeVersionCode()
  .then((versionCode) => {
    console.log(String(versionCode));
  })
  .catch((err) => {
    console.error(`error: ${err.message}`);
    process.exit(1);
  });
