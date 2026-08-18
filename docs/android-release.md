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

These have to be added by you, from a machine you're signed in on: Actions
secrets are write-only and settable only by a repo admin, and two of the values
(the Play service account and the RevenueCat key) don't exist anywhere yet —
they have to be minted from your Google and RevenueCat accounts first.

The fastest path is the helper script, which generates the keystore if you
don't have one and pushes every value with `gh secret set` (nothing is echoed
to the terminal):

```bash
bash scripts/setup-android-secrets.sh
```

### On macOS

```bash
brew install gh && gh auth login

git fetch origin && git checkout claude/android-ci-credentials-2ub7xk
bash scripts/setup-android-secrets.sh
```

**No JDK required.** A keystore is just a PKCS#12 file, so the script builds it
with `openssl`, which macOS preinstalls; `keytool` is used only if openssl is
missing. Both produce a byte-compatible keystore — Gradle and Play cannot tell
them apart. The script also works with the stock macOS bash 3.2 and BSD
`base64`.

> macOS ships a `/usr/bin/keytool` **stub** that exists on `PATH` with no JDK
> behind it and fails with "Unable to locate a Java Runtime". The scripts
> therefore probe `keytool -help` rather than trusting `command -v keytool`.

To build the keystore by hand with no Java at all:

```bash
openssl req -x509 -newkey rsa:2048 -sha256 -days 10000 -nodes \
  -keyout key.pem -out cert.pem \
  -subj "/CN=com.balkanbit.mathly/OU=Mathly/O=BalkanBit/C=BG"

openssl pkcs12 -export -inkey key.pem -in cert.pem \
  -name upload -out upload-keystore.p12 \
  -keypbe AES-256-CBC -certpbe AES-256-CBC -macalg sha256

rm key.pem cert.pem          # the .p12 now holds the key; back it up
```

The alias is whatever you pass to `-name` (`upload` above), and the export
password becomes both `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_PASSWORD` —
PKCS#12 uses one password for the store and the key.

### Without a terminal

Everything except the keystore can be pasted straight into
**GitHub → Settings → Secrets and variables → Actions → New repository
secret**. Only `ANDROID_KEYSTORE_BASE64` needs a shell, because it is the
base64 of a binary file:

```bash
base64 -i upload-keystore.p12 | tr -d '\n' | pbcopy   # now Cmd-V into the web form
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

(Or the `openssl` equivalent under "On macOS" below, if you have no JDK.)

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

1. Play Console → **Setup → API access** → link a Google Cloud project, and
   enable the **Google Play Android Developer API** in that project.
2. Google Cloud → **IAM & Admin → Service accounts** → create one → **Keys →
   Add key → JSON**. Download it.
3. Back in Play Console → API access → **Grant access** for that account.

### Which permissions to grant

Grant these as **app permissions scoped to `com.balkanbit.mathly`**, not
account permissions — a leaked key then cannot touch anything else:

| Permission | Why this workflow needs it |
| --- | --- |
| **View app information (read-only)** | `next-android-version-code.mjs` opens an edit and lists tracks to find the highest published `versionCode` |
| **Release apps to testing tracks** | `upload-google-play` uploads the `.aab` + mapping file and creates the internal-track release |

That is the whole set. Notably **not** needed:

- *Release to production, exclude devices, and use Play App Signing* — this
  workflow only targets the internal track, and withholding it means the key
  cannot ship to production even if it leaks.
- *Manage testing tracks and edit tester lists* — only needed to change who
  the testers are, which CI never does.
- *View financial data* / *Manage orders and subscriptions* — billing APIs,
  unrelated.
- **Any Google Cloud IAM role on the service account.** The GCP project only
  hosts the account and enables the API; authorization for publishing comes
  entirely from the Play Console grant. Do not add Editor/Owner.

Grants usually take effect within minutes but can take up to 24 hours. A
permission that hasn't propagated shows up as a 401/403 from the version-code
step, which falls back to `github.run_number` rather than failing the build.

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

# Dry run: checks every credential, builds nothing, publishes nothing.
gh workflow run android-release.yml -f job=verify-credentials

gh workflow run android-release.yml             # the real release (job=release)
```

`verify-credentials` also runs as a gate on every release dispatch, so a
missing or mistyped credential fails in well under a minute instead of after
the Gradle build.

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
