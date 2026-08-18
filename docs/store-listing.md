# Mathly — Store listing copy

## App Store (US)

**App name:** Mathly — AI Math Tutor

**Subtitle:** Snap a problem. Learn every step.

**Promotional text:** Your AI tutor now explains graphs, too.

**Description:** the exact text lives in
`docs/app-store-metadata/en-US/description.txt` — it is what
`npm run metadata:push` writes into App Store Connect, so edit it there rather
than copying the copy around. It ends with the Terms of Use (EULA) and Privacy
Policy links that Apple's automated Guideline 3.1.2 check scans for; removing
them fails `npm run metadata:check` and the CI quality job.

**Keywords:** math, solver, tutor, algebra, calculus, homework, scan, step by step, camera, physics, chemistry, statistics, graphing, study, education

**Category:** Education

---

## Google Play (US)

**App name:** Mathly — AI Math Tutor
**Short description:** Snap any math problem. Get verified, step-by-step help.
**Full description:** same text — `docs/app-store-metadata/en-US/description.txt`

**Category:** Education
**Content rating:** PEGI 3 / Everyone
**Tagline:** Learn the steps, not just the answer.

---

## Screenshots supplied

| Folder | Size | Target |
| --- | --- | --- |
| `docs/app-store-screenshots/en-US/` | 1242×2688 | App Store 6.5" |
| `docs/app-store-screenshots/en-US-6.9in/` | 1320×2868 | App Store 6.9" |
| `docs/app-store-screenshots/play-phone/` | 1080×1920 | Play phone |

Frames: 01 hero · 02 scanner · 03 solution · 04 graph · 05 chat · 06 history.

Preview video: `docs/app-store-screenshots/preview/app-preview-886x1920.mp4`
(H.264, 886×1920, 30fps, 18s — inside Apple's 15–30s window).
