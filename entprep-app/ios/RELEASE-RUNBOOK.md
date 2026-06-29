# ENTprep — iOS Release Archive Runbook (Mac)

> Prepared by the iOS build stream on **Windows**. Everything doable on Windows is done and
> committed on branch **`fleet/ios`**. This file covers the **Mac-only** steps: install, build,
> sync, archive, upload. Goal: a working App Store build — no surprises.
> Last verified against code: **2026-06-29**.

## 0. Identity (verified against code, not docs)

| Item | Value | Source |
|---|---|---|
| Bundle ID | `kz.entprep.app` | `capacitor.config.ts`, `project.pbxproj` (`PRODUCT_BUNDLE_IDENTIFIER`) |
| Apple Team ID | `85MH8SWD4T` | `project.pbxproj` (`DEVELOPMENT_TEAM`) |
| App Store ID | `6760261689` | App Store Connect record |
| Marketing version | `1.1.0` | `project.pbxproj` (`MARKETING_VERSION`) |
| **Build number** | **`18`** (bumped from 17 this release) | `project.pbxproj` (`CURRENT_PROJECT_VERSION`) |
| IAP product IDs | `entprep_monthly`, `entprep_yearly` | `src/config/payment.ts` (`RC_PRODUCT_IDS`) — **code is source of truth**, ignore docs that say `entprep_pro_*` |
| IAP engine | RevenueCat StoreKit, `@revenuecat/purchases-capacitor@12.2.2` | `package.json`, resolved by `cap sync` |
| Signing | Automatic, Apple Distribution under team `85MH8SWD4T` | `project.pbxproj` (`CODE_SIGN_STYLE = Automatic`) |

## 1. Prerequisites on the Mac
- **Xcode** (latest stable). Project targets **iOS 15.0**, uses **Swift Package Manager**.
- **Node.js 20+ / npm** (built on Windows with Node 24 / npm 11; any recent LTS is fine).
- **Apple Developer** access under team `85MH8SWD4T` with a valid Apple Distribution certificate + provisioning. Automatic signing will fetch/create these.
- **No CocoaPods.** This project is **SPM-based** (`ios/App/CapApp-SPM`). There is **no `Podfile`** and **no `.xcworkspace`** — **do NOT run `pod install`.**
- **Build-time env from the owner.** You need `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
  (gitignored — not in the pulled repo) before building; see step 3. Without them the archived
  app has dead auth / cloud sync / leaderboard.

## 2. Pull the branch
```bash
git fetch origin
git checkout fleet/ios
git pull origin fleet/ios
```

## 3. Install deps + build the web bundle  ⚠️ env-critical

`node_modules/` and `dist/` are gitignored, so install fresh on the Mac. **Three `VITE_*`
env vars MUST be present at build time** — Vite inlines them into the bundle, and a build
without them compiles fine but ships a **broken app**:

| Var | If missing → silent failure in the shipped app |
|---|---|
| `VITE_SUPABASE_URL` | `supabase = null` → **auth, cloud sync, leaderboard dead** (this is the 2026-06 prod break) |
| `VITE_SUPABASE_ANON_KEY` | same as above |
| `VITE_RC_API_KEY_APPLE` | RevenueCat not configured → **StoreKit purchases silently fail** (money flow) |

`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are **not in the repo** (`.env*` is gitignored).
**Get their values from the project owner** (or copy the owner's `entprep-app/.env.local`).
The RC Apple key is public and fixed: `appl_hSiijbsNKsMxZEeQDZLYTtjSwmw`.

```bash
cd entprep-app
npm ci

# Export all three in THIS shell (so the post-build gate can verify their exact values):
export VITE_SUPABASE_URL='https://api.entprep.org'         # confirm with owner
export VITE_SUPABASE_ANON_KEY='<owner-provides-anon-key>'  # gitignored; from owner
export VITE_RC_API_KEY_APPLE='appl_hSiijbsNKsMxZEeQDZLYTtjSwmw'

npm run build
node scripts/predeploy-check.mjs   # ← GATE: must print "✓ predeploy-check passed"
```
> **Do not skip `predeploy-check.mjs`.** Run it in the **same shell** right after `npm run build`.
> It exits non-zero if the Supabase host / anon-key JWT (and the RC key, when exported here) are
> missing from `dist/` — i.e. it catches a build made without the env *before* you waste time
> archiving a dead binary. (Alternatively the three vars can live in `entprep-app/.env.local`,
> which `npm run build` auto-reads; exporting them also lets the gate exact-match each value.)

Expect from the build: `✓ built in …s`, then the PWA service-worker build, `precache NN entries`,
no errors; then `✓ predeploy-check passed — Supabase host (api.entprep.org) + anon key present`.

## 4. Sync web → iOS
```bash
npx cap sync ios
```
This copies `dist/` → `ios/App/App/public/`, writes `ios/App/App/capacitor.config.json`, and
regenerates the SPM manifest. Expect it to resolve **3 plugins**: `@capacitor/app`,
`@capacitor/browser`, `@revenuecat/purchases-capacitor`.

> ⚠️ **Package.swift path separators (the one real Windows gotcha).**
> `cap sync` regenerates `ios/App/CapApp-SPM/Package.swift` with the **OS path separator**.
> The committed version uses macOS **forward slashes** (`../../../node_modules/...`). Running
> `cap sync` **on macOS keeps forward slashes — correct, no action needed.** A Windows run
> would write **backslashes** which break SPM; that Windows artifact was reverted before push,
> so what you pulled is already correct. **Never commit a Windows-generated `Package.swift`.**
> If `git status` after `cap sync` on the Mac shows no change to `Package.swift`, you're good.

## 5. Open + archive in Xcode
```bash
open ios/App/App.xcodeproj   # .xcodeproj, NOT a workspace (SPM project)
```
- Scheme **App**; destination **Any iOS Device (arm64)**.
- Target **App → Signing & Capabilities**: Team `85MH8SWD4T`, **Automatic** signing. Confirm
  Bundle Identifier `kz.entprep.app`. Entitlements present: Sign in with Apple, Associated
  Domains (`applinks:entprep.org`).
- Target **App → General**: confirm **Version 1.1.0**, **Build 18**.
- **Product → Archive** (~3–5 min). Let SPM finish resolving packages first (if Xcode shows
  "Resolving Package Versions", wait for it).

## 6. Upload to App Store Connect
- Organizer opens with the archive → **Distribute App → App Store Connect → Upload**.
- Keep default distribution options (automatic signing) → Upload.
- Wait **5–15 min** for ASC processing. Build **18 (1.1.0)** then appears under the app
  (App Store ID `6760261689`) in TestFlight / for submission selection.

## 7. Sanity after upload
- ASC should not flag **Missing Compliance** — export compliance is declared in `Info.plist`
  (`ITSAppUsesNonExemptEncryption=false`).
- **TestFlight smoke:** install, open a paywall, confirm the **native StoreKit purchase sheet**
  appears (NOT a Lemon Squeezy web page). Lemon Squeezy on native = the platform bridge failed.

---

## Notes from the build stream (S5)
- **No source/logic changed** for this release — only the build number (17→18) and this runbook.
  The web build is the same code as web prod; correctness depends entirely on the three `VITE_*`
  env vars being inlined at build time (step 3) — that is the single biggest "silent failure"
  risk for this archive, hence the `predeploy-check.mjs` gate.
- **Stray duplicate file (pre-existing, left untouched):** `ios/App/App/AppleSignInPlugin.swift`
  exists alongside the compiled `ios/App/AppleSignInPlugin.swift`. Only the latter is in the
  Xcode **Sources** build phase, so the duplicate is inert and does not cause a duplicate-symbol
  error. Out of scope to remove here; flagged for awareness.
- The Windows machine can do everything **except** the Xcode Archive/Upload (steps 5–6) and any
  Sandbox/TestFlight IAP verification — those are Mac/device only.
