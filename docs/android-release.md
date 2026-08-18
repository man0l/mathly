# Android release credentials

The `android` job in `.github/workflows/android-release.yml` only runs on
`workflow_dispatch`, and it needs seven GitHub Actions secrets. Until they
exist, the job stops at its **Verify release credentials** step and names the
ones that are missing.

| Secret | What it is | Where it comes from |
| --- | --- | --- |
| `ANDROID_KEYSTORE_BASE64` | base64 of the upload keystore (`.p12`) | you generate it — step 1 |
| `ANDROID_KEYSTORE_PASSWORD` | that keystore's store password | you choose it — step 1 |
| `ANDROID_KEY_ALIAS` | alias of the key inside it (`upload`) | you choose it — step 1 |
| `ANDROID_KEY_PASSWORD` | that key's password (usually the same) | you choose it — step 1 |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | full JSON key file, pasted verbatim | Google Cloud + Play Console — step 2 |
| `EXPO_PUBLIC_API_BASE_URL` | backend URL baked into the JS bundle | your Vercel deployment |
| `EXPO_PUBLIC_REVENUECAT_KEY` | RevenueCat **Android** SDK key (`goog_…`) | RevenueCat → Project → API keys |

The fastest path is the helper script, which generates the keystore if you
don't have one and pushes every value with `gh secret set` (nothing is echoed
to the terminal):

```bash
bash scripts/setup-android-secrets.sh
```

Everything below is what that script automates, in case you'd rather do it by
hand or need to reproduce one step.

## 1. Upload keystore

Play signs the app it serves with its own key; the `.aab` you upload must be
signed with *your* upload key. Generate it once and never lose it — losing it
means asking Google to reset the upload key.

```bash
keytool -genkeypair -v \
  -keystore upload-keystore.p12 -storetype PKCS12 \
  -alias upload -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=com.balkanbit.mathly, OU=Mathly, O=BalkanBit, C=BG"
```

Keep `upload-keystore.p12` out of the repo (back it up in a password manager),
then set the four secrets:

```bash
gh secret set ANDROID_KEYSTORE_BASE64 --body "$(base64 -w0 upload-keystore.p12)"
gh secret set ANDROID_KEYSTORE_PASSWORD   # prompts, no shell history
gh secret set ANDROID_KEY_ALIAS --body upload
gh secret set ANDROID_KEY_PASSWORD
```

## 2. Play Console service account

Used twice by the workflow: `scripts/next-android-version-code.mjs` asks Play
for the highest `versionCode` already published, and `upload-google-play`
pushes the bundle to the internal track.

1. Play Console → **Setup → API access** → link a Google Cloud project.
2. Google Cloud → **IAM & Admin → Service accounts** → create one → **Keys →
   Add key → JSON**. Download it.
3. Back in Play Console → API access → **Grant access** for that account, with
   at least *Release to testing tracks* and *View app information* on
   `com.balkanbit.mathly`. Permissions take a few minutes to propagate.

```bash
gh secret set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON < service-account.json
```

Paste the whole file — the preflight rejects anything that isn't a JSON object
with `type: "service_account"`, a `client_email`, and a `private_key`.

## 3. App runtime config

```bash
gh secret set EXPO_PUBLIC_API_BASE_URL --body https://your-deployment.vercel.app
gh secret set EXPO_PUBLIC_REVENUECAT_KEY --body goog_xxx
```

Both are `EXPO_PUBLIC_*`, so they end up inside the shipped JS bundle — public
by design. Never put the OpenAI key (or any other server secret) here.

## 4. Verify and release

```bash
gh secret list                                  # names only; values are write-only
gh workflow run android-release.yml             # dispatch the release job
```

The build fails fast if a credential is missing, malformed, or if the keystore
password/alias don't open the keystore. To build without Play publishing (for a
locally-signed test bundle) set `STRICT_ANDROID_SECRETS=0` in the job env — the
preflight then warns instead of failing, and `configure-android-signing.sh`
falls back to a debug-signed AAB, which **Play will reject**.

## Rotating a credential

Passwords, the RevenueCat key, the API URL, and the service-account JSON can be
re-set at any time with the same `gh secret set` command. The keystore itself
cannot: once a version has been served from Play, every later upload must be
signed with the same upload key.
