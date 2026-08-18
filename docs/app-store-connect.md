# App Store Connect — Mathly submission guide

Everything the CI needs is already in the repo. This is the manual part:
Apple accounts, signing material, subscription products, and the App Store
Connect record. Budget ~1 hour the first time; most steps are one-off.

## 0. What you already have

- CI that builds + signs + uploads: `.github/workflows/ios-signing.yml`
  (dispatch → `testflight-release`) — same pipeline looxmaxxing ships with.
- Listing copy: `docs/store-listing.md`
- Screenshots: `docs/app-store-screenshots/en-US/` (6.5") and `en-US-6.9in/` (6.9")
- Preview video: `docs/app-store-screenshots/preview/app-preview-886x1920.mp4`
- Listing text pushed by script: `docs/app-store-metadata/en-US/`
  (`description.txt` + `eula.txt`) → `npm run metadata:push`
- Privacy policy text: `docs/privacy-policy.md` (hosted — step 6)
- API backend: https://aimathapp.vercel.app (already live)

Bundle ID: **com.balkanbit.mathly** · App name: **Mathly**

## 1. Identifiers (Apple Developer portal)

developer.apple.com → Certificates, Identifiers & Profiles → Identifiers:

1. **+ New identifier** → App IDs → App.
2. Description `Mathly`, bundle ID **explicit**: `com.balkanbit.mathly`.
3. Capabilities: none needed (no push, no sign-in). Camera needs no capability.

## 2. Certificates + provisioning profile

You already have an **Apple Distribution certificate** from looxmaxxing —
reuse the same `.p12`. Only the profile is app-specific:

1. Certificates → confirm an *Apple Distribution* cert exists (if not,
   create one, export the `.p12` with a password you know).
2. Profiles → **+** → Distribution → **App Store Connect** → App ID
   `com.balkanbit.mathly` → name it **`Mathly App Store`** → generate + download.
3. Base64 both files for GitHub secrets (PowerShell):
   ```powershell
   [convert]::ToBase64String((Get-Content -AsByteStream dist.p12)) | Set-Clipboard
   [convert]::ToBase64String((Get-Content -AsByteStream Mathly_App_Store.mobileprovision)) | Set-Clipboard
   ```

## 3. App Store Connect API key (for the upload step)

appstoreconnect.apple.com → Users and Access → Integrations → **App Store
Connect API** → + Generate (Admin access). Note the **Key ID**, **Issuer ID**,
download the `.p8` once. Base64 it the same way.

## 4. GitHub secrets (`man0l/mathly` → Settings → Secrets and variables → Actions)

Already set: `EXPO_PUBLIC_API_BASE_URL=https://aimathapp.vercel.app` ✅

Add these (values follow looxmaxxing's conventions):

| Secret | Value |
| --- | --- |
| `IOS_DIST_CERTIFICATE_P12` | base64 of the distribution `.p12` |
| `IOS_DIST_CERTIFICATE_PASSWORD` | that `.p12`'s password |
| `IOS_DIST_PROVISIONING_PROFILE_BASE64` | base64 of `Mathly App Store.mobileprovision` |
| `IOS_TEAM_ID` | your 10-char Team ID (Membership page) |
| `IOS_PROVISIONING_PROFILE_NAME` | `Mathly App Store` |
| `APP_STORE_CONNECT_KEY_ID` | from step 3 |
| `APP_STORE_CONNECT_ISSUER_ID` | from step 3 |
| `APP_STORE_CONNECT_API_KEY_BASE64` | base64 of the `.p8` |

(Also mirror looxmaxxing's Android secrets when you do the Play release:
keystore quartet + `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` + `EXPO_PUBLIC_REVENUECAT_KEY`.)

Sanity check without burning a build: run the workflow with job
`verify-signing` / certificate `distribution` — it should print your identity.

## 5. Subscription products (required before review)

Mathly's paywall is RevenueCat-backed. On Hobby-simple path:

1. **App Store Connect** → your app (create it first, step 7) →
   Features → **Subscriptions** → create Subscription Group
   `Mathly Pro` with two products:
   - `mathly_pro_yearly` — $39.99 / year, **3-day free trial** intro offer
   - `mathly_pro_weekly` — $6.99 / week
   Localization: name + description per product ("Full access…").
2. **RevenueCat** (reuse your existing project or make one for Mathly):
   - Apps → new iOS app, bundle `com.balkanbit.mathly`, store credentials via
     the App Store Connect API key from step 3.
   - Products → link the two product IDs above.
   - Entitlements → **Mathly Pro** (exact string — the app checks it) →
     attach both products. Offering → attach both, order yearly first.
   - Project settings → API keys → **iOS app public key** (`appl_…`).
3. GitHub secret: `EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_…`
   (Without it the app still builds; the paywall falls back to the simulated
   purchase flow — fine for TestFlight smoke tests, not for release.)

## 6. Legal pages (already hosted)

Apple requires public URLs for both the privacy policy and — because Mathly
sells auto-renewable subscriptions — the Terms of Use (EULA). Both are live on
the balkanbit site and are what the app opens from Settings and the paywall:

| Page | URL | Source |
| --- | --- | --- |
| Terms of Use (EULA) | https://www.balkanbit.app/mathly/terms | `docs/app-store-metadata/en-US/eula.txt` |
| Privacy Policy | https://www.balkanbit.app/mathly/privacy-policy | `docs/privacy-policy.md` |

`src/lib/links.ts` is the single source of these URLs for the app; the metadata
script reads the same file, so the listing can never point somewhere the app
does not.

## 6a. Push the listing metadata (do this before every submission)

Guideline 3.1.2 rejects a subscription app whose metadata has no functional
Terms of Use link. Two fields carry it, and neither is part of the build:

```bash
npm run metadata:check   # copy + live-link verification, no credentials needed
npm run metadata:push    # writes it into App Store Connect
```

or GitHub → Actions → **iOS Signing Setup** → job `app-store-metadata`
(same App Store Connect API secrets as the TestFlight upload).

The push sets:

1. the **App Store description** from `docs/app-store-metadata/en-US/description.txt`
   — it ends with the Terms of Use and Privacy Policy URLs, which is the text
   the automated 3.1.2 check scans;
2. the **privacy policy URL** on App Information;
3. the **custom EULA** from `docs/app-store-metadata/en-US/eula.txt`, for all
   territories. That field stores agreement *text*, not a URL — pasting a link
   into it does not satisfy the check.

The version has to be editable (Prepare for Submission / Rejected). If a build
is sitting in Waiting for Review, reject it in App Store Connect first — the
script says so instead of failing obscurely. It also refuses to push if either
legal URL does not return a live page.

## 7. Create the app record + build

1. App Store Connect → **+ New App**: iOS, name **Mathly — AI Math Tutor**
   (exact name shown on the store; subtitle from `docs/store-listing.md`),
   language English (US), bundle `com.balkanbit.mathly`, SKU `mathly-ios-1`.
2. GitHub → Actions → **iOS Signing Setup** → Run workflow → job
   `testflight-release`. ~25 min: prebuild → archive → export → upload.
3. TestFlight: the build appears after processing (~10 min). Internal testers
   can install immediately. For External Testers you'll fill the beta
   review form (camera usage is self-evident; typically approved same-day).

## 8. Fill the listing + submit

App Store Connect → your app → **Version 1.0.0**:

| Field | Value |
| --- | --- |
| What's New | `First release.` |
| Description | pushed by `npm run metadata:push` (step 6a) — do not retype it |
| Promo text / keywords | copy from `docs/store-listing.md` |
| Screenshots | drag in all 6 from `en-US-6.9in/` (6.5" auto-fills) |
| App Preview | `app-preview-886x1920.mp4` |
| Privacy Policy URL | set by `npm run metadata:push` (step 6a) |
| Terms of Use (EULA) | both are set by `npm run metadata:push` (step 6a) — the link inside the Description (what the automated 3.1.2 check scans) and the custom EULA on App Information. Note the EULA field takes agreement **text**, not a URL |
| Support URL | your site or `https://github.com/man0l/mathly` |
| Category | Education (secondary: Productivity) |
| Age Rating | answer quiz → 4+ (no user content, no web browsing) |
| Price | with IAP: price tier Free |
| App Privacy | collect: *Photos or Videos* + *Purchase History* (both = app functionality, not linked for photos / linked for purchases), no tracking |
| Export Compliance | uses HTTPS only → set `ITSAppUsesNonExemptEncryption=false` (already in `app.json`); answer "uses standard encryption, exempt" |
| Review notes | "Point the camera at any math problem — e.g. a textbook page. No account needed. Subscription: Mathly Pro yearly/weekly with 3-day trial." Add a short demo video link if handy. |

Then **Submit for Review**. Typical first-review turnaround: 24–48h.

## Common rejection traps (already handled in-repo)

- ✅ Camera purpose strings (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`)
- ✅ Privacy manifest + `ITSAppUsesNonExemptEncryption=false`
- ✅ Paywall shows price + trial terms; Restore button present
- ✅ Terms of Use (EULA) link in the App Store Description + custom EULA text
  in App Information (3.1.2 automated check) — written by
  `npm run metadata:push`, verified live by `npm run metadata:check`.
  **Run the push before every submission**: editing `docs/` changes nothing
  that review sees, which is exactly how the first 3.1.2 rejection happened.
- ✅ No signup wall — app usable (scan + solve) after onboarding
- ⚠️ **Sign in required? No.** Leave as-is.
- ⚠️ If IAP products are missing/invalid in App Store Connect (step 5), review
  will reject with Guideline 2.1 — do step 5 before submitting.
- ⚠️ Metadata lives in App Store Connect, not in the build — a green CI run
  does not mean the listing was updated. `npm run metadata:push` is the only
  thing that changes what review reads.

## Parallel Play Store release (quick version)

Play Console → create app → Play/App signing (or reuse your upload keystore) →
set the Android secrets from step 4 → run **Android Release** workflow
(dispatch) → internal track. Fill listing from the same
`docs/store-listing.md`; screenshots from `play-phone/`; data safety answers
mirror `docs/privacy-policy.md`.
