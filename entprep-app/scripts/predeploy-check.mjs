#!/usr/bin/env node
/**
 * Pre-deploy gate — run AFTER `vite build`, BEFORE `netlify deploy --prod`.
 *
 * Asserts the built bundle in dist/ actually contains the critical runtime env
 * that Vite must inline at build time. A build that ran without these produces a
 * bundle where `supabase = null` (config/supabase.ts) → auth, cloud sync, and
 * leaderboard are silently dead in production with NO error at build or deploy.
 *
 * This exact failure shipped once (the 2026-06 auth break: prod build was made
 * without VITE_SUPABASE_ANON_KEY in the environment). This gate makes that
 * un-deployable: it fails the command before `netlify deploy` ever runs.
 *
 * Usage (chained into the deploy command — same shell, so the build env is the
 * env we verify against):
 *   VITE_SUPABASE_URL=… VITE_SUPABASE_ANON_KEY=… vite build \
 *     && node scripts/predeploy-check.mjs \
 *     && netlify deploy --prod --dir=dist --no-build
 *
 * Exit 0 = safe to deploy. Exit 1 = bundle is missing critical env; DO NOT deploy.
 *
 * LIMITATION: this checks dist/ as it is on disk — it cannot tell a fresh build
 * from a stale one. Always run it immediately after `vite build` IN THE SAME
 * command chain (as above), never standalone against a pre-existing dist/.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const ASSETS = join(DIST, 'assets');

// Default prod Supabase host. Overridden when VITE_SUPABASE_URL is set in the
// environment (e.g. a preview/staging build pointing at a different project).
const DEFAULT_SUPABASE_URL = 'https://api.entprep.org';

// A Supabase anon key is a JWT: three base64url segments. The build inlines it
// as a plain string literal; if supabase=null (no key) no such literal exists.
const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}/;

const problems = [];
const fail = (msg) => problems.push(msg);

// ── 1. dist/ exists and isn't an empty/garbage build ────────────────────────
if (!existsSync(ASSETS)) {
  console.error('\n✖ predeploy-check FAILED: no dist/assets/ — run `vite build` first.\n');
  process.exit(1);
}
const bundle = readdirSync(ASSETS)
  .filter((f) => f.endsWith('.js'))
  .map((f) => readFileSync(join(ASSETS, f), 'utf8'))
  .join('\n');

if (bundle.length < 50_000) {
  console.error(`\n✖ predeploy-check FAILED: dist JS is only ${bundle.length} bytes — build looks broken/empty.\n`);
  process.exit(1);
}

// ── 2. Supabase host literal present (env-independent floor) ────────────────
const expectedHost = new URL(process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).host;
if (!bundle.includes(expectedHost)) {
  fail(`Supabase host "${expectedHost}" is ABSENT from the bundle — the build ran without VITE_SUPABASE_URL. Auth + cloud sync would be dead in prod.`);
}

// ── 3. A Supabase anon key (JWT) present (env-independent floor) ─────────────
if (!JWT_RE.test(bundle)) {
  fail('No Supabase anon key (JWT) found in the bundle — the build ran without VITE_SUPABASE_ANON_KEY. The Supabase client would be null in prod.');
}

// ── 4. When env is set at check time, verify the EXACT value reached the bundle
//      (catches stale dist / a build made with different env than this shell).
const EXACT = [
  ['VITE_SUPABASE_URL', 'Supabase URL'],
  ['VITE_SUPABASE_ANON_KEY', 'Supabase anon key'],
  ['VITE_RC_API_KEY_APPLE', 'RevenueCat key (iOS paywall — money flow)'],
];
for (const [name, label] of EXACT) {
  const val = process.env[name];
  if (val && !bundle.includes(val)) {
    fail(`${label}: ${name} is set in this shell but its value is ABSENT from the bundle — the dist was built with different (or no) env. Rebuild in this shell, then re-check.`);
  }
}

// ── Verdict ─────────────────────────────────────────────────────────────────
if (problems.length) {
  console.error('\n✖ predeploy-check FAILED — DO NOT DEPLOY:');
  for (const p of problems) console.error(`  • ${p}`);
  console.error('');
  process.exit(1);
}

console.log(`✓ predeploy-check passed — Supabase host (${expectedHost}) + anon key present in dist bundle.`);
