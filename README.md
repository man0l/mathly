# Mathly — AI Math Tutor

Snap a photo of any math problem. Mathly reads it, solves it, and walks you
through every step — then answers your follow-ups until it clicks. Algebra to
calculus, physics to chemistry, with graphs that show what the answer means.

Built with Expo (React Native, TypeScript), an OpenAI-powered serverless API,
Playwright e2e + store-screenshot automation, and GitHub Actions CI that ships
signed `.aab` (Play internal track) and TestFlight builds.

## What's inside

| Area | Where |
| --- | --- |
| App source | `App.tsx`, `src/` (screens, components, theme, state, lib) |
| AI backend (Vercel functions) | `api/solve.mjs`, `api/chat.mjs`, `api/dev.mjs` (local runner) |
| E2E (full funnel) | `e2e/full-flow.spec.ts` + `playwright.config.ts` |
| Store screenshots | `scripts/app-store-screenshots/capture-and-compose.mjs` → `docs/app-store-screenshots/` |
| Demo / preview video | `scripts/app-store-screenshots/capture-preview-video.mjs` → `docs/app-store-screenshots/preview/` |
| Asset generator (icon/splash) | `scripts/generate-assets.mjs` (Playwright-rendered) |
| CI | `.github/workflows/android-release.yml`, `.github/workflows/ios-signing.yml` |
| Store listing copy | `docs/store-listing.md` |
| Privacy policy | `docs/privacy-policy.md` |

## Product flow

1. **Onboarding quiz** (Cal AI-style personalization): subjects → level → goal
   → pain points → explanation style.
2. **"Setting up your tutor"** animated checklist → **paywall** (3-day trial,
   yearly/weekly plans, simulated `Test valid purchase` without store keys).
3. **Home**: big scan card, quick typed-problem input, subject chips, recents.
4. **Scanner**: camera viewfinder with brackets, torch, gallery import.
   On web/e2e a `TEST` button feeds a bundled handwritten problem.
5. **Analyzing**: rotating phases over the captured photo.
6. **Solution**: subject tag, verified answer hero, step-by-step cards with a
   **Reveal next step** button, SVG function graph, follow-up chat chips.
7. **History / Chat / Settings** tabs; every problem persists in AsyncStorage.

The backend returns strict JSON (`problemText`, `finalAnswer`, `steps[]`,
`graph {expression, xMin, xMax}`, `concepts[]`); the app's `GraphPlot`
compiles the expression safely (implicit `2x` → `2*x`, failures plot as NaN,
never crash).

## Local development

```bash
npm install

# 1. Start the AI API (reads api/.env — copy from api/.env.example)
#    OPENAI_API_KEY + OPENAI_MODEL (gpt-5.4-mini recommended)
node api/dev.mjs            # → http://localhost:3000

# 2. Start the app
cp .env.example .env        # EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
npm run web                 # → http://localhost:8081
```

Native: `npm run ios` / `npm run android` (camera needs a real device or
emulator).

### E2E & asset scripts

```bash
npx playwright test                            # full funnel (stubbed API)
npm run screenshots                            # store screenshots (3 size sets)
npm run demo                                   # demo video vs the real API
npm run demo -- --stub                         # …or the canned solution
npm run assets                                 # regenerate icon/splash/e2e photo
```

The screenshot script drives the real web UI through onboarding → scan →
solution → chat → history, then composes marketing frames with a device shell
at **exact** store sizes (1242×2688, 1320×2868, 1080×1920). The video script
records at 443×960 and ffmpeg-upscales to Apple's 886×1920 / 30fps / H.264.

## Backend deployment (Vercel)

Already deployed: **https://aimathapp.vercel.app** (Vercel project `aimathapp`,
linked to `man0l/mathly`, OpenAI key set as a Production env var). For a fresh
deployment:

```bash
npm i -g vercel
vercel                     # link project
vercel env add OPENAI_API_KEY production
vercel env add OPENAI_MODEL production   # gpt-5.4-mini
vercel deploy --prod
```

The deployment URL is already in `.env` (`EXPO_PUBLIC_API_BASE_URL`) and in the
gitHub secret of the same name. Notes: keep commit authors on a Vercel-verified
email — Hobby blocks deployments with `COMMIT_AUTHOR_REQUIRED` otherwise — and
make sure Deployment Protection → Vercel Authentication is off for public API
access. The OpenAI key lives **only** server-side — never in `EXPO_PUBLIC_*`.

## CI / release (same strategy as looxmaxxing)

- **Android** (`android-release.yml`): on every push → typecheck + lint; on
  `workflow_dispatch` → prebuild → `bundleRelease` with the uploaded keystore →
  GitHub Release + upload to the Play **internal** track (versionCode is
  queried from Play so it can never regress).
- **iOS** (`ios-signing.yml`): manual dispatch → `verify-signing` (import
  certificate into a temp keychain) or `testflight-release` (prebuild →
  archive with manual signing → export `.ipa` → `altool` upload to
  TestFlight).

### Required GitHub secrets

Android: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`,
`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `EXPO_PUBLIC_API_BASE_URL`,
`EXPO_PUBLIC_REVENUECAT_KEY`. Set them all in one pass with
`bash scripts/setup-android-secrets.sh` (generates the upload keystore if you
don't have one); how to obtain each is in `docs/android-release.md`. The
release job runs `scripts/check-android-secrets.sh` first and fails with the
names of anything missing before it starts a build.

iOS: `IOS_DIST_CERTIFICATE_P12`, `IOS_DIST_CERTIFICATE_PASSWORD`,
`IOS_DIST_PROVISIONING_PROFILE_BASE64`, `IOS_TEAM_ID`,
`IOS_PROVISIONING_PROFILE_NAME`, `APP_STORE_CONNECT_KEY_ID`,
`APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY_BASE64`,
`EXPO_PUBLIC_REVENUECAT_IOS_KEY`.

## Submission checklist

- [ ] Create the app in App Store Connect / Play Console
      (`com.balkanbit.mathly`)
- [ ] Deploy the API (above) and set `EXPO_PUBLIC_API_BASE_URL` everywhere
- [ ] RevenueCat: app + entitlement `Mathly Pro` + offering; set both SDK keys
      (without keys the paywall runs the simulated purchase flow)
- [ ] Store listing copy: `docs/store-listing.md`
- [ ] Screenshots: `docs/app-store-screenshots/` (6.5", 6.9", Play phone)
- [ ] Preview video: `docs/app-store-screenshots/preview/app-preview-886x1920.mp4`
- [ ] Host `docs/privacy-policy.md` at a public URL and set it in Settings
      (`openLink` in `src/screens/SettingsScreen.tsx`)
- [ ] Bump `versionCode` / build numbers happen automatically in CI
