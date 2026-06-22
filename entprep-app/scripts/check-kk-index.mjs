#!/usr/bin/env node
/**
 * Predeploy GUARD — I18N-1 Kazakh answer-index mismatch.
 *
 * Run AFTER `node scripts/dump-questions.mjs` (which regenerates public/data/*.json),
 * BEFORE `vite build`. Fails the deploy chain if any dumped row has o_kk an exact
 * multiset permutation of o but the shared correct index misplaced — i.e. a Kazakh
 * student who picks the truly-correct answer would be graded WRONG.
 *
 * The data fix lives in scripts/fix-kk-answer-index.mjs (owner action: --apply
 * against Supabase, then re-dump). THIS script only blocks re-introduction.
 *
 * Usage (wired into the deploy chain):
 *   node scripts/dump-questions.mjs \
 *     && node scripts/check-kk-index.mjs \
 *     && node scripts/compute-quarantine.mjs \
 *     && ... vite build && node scripts/predeploy-check.mjs && netlify deploy ...
 *
 * Exit 0 = no mis-keyed rows. Exit 1 = mis-keyed rows present; DO NOT deploy.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { scanDataDir } from './utils/kk-index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

const { perSubject, total, samples } = scanDataDir(DATA_DIR);

if (total === 0) {
  console.log('✓ check-kk-index passed — no mis-keyed Kazakh answer indices in public/data.');
  process.exit(0);
}

console.error('\n✖ check-kk-index FAILED — DO NOT DEPLOY:');
console.error(`  ${total} Kazakh question(s) have o_kk as an exact permutation of o but a misplaced correct index.`);
console.error('  A Kazakh student picking the truly-correct answer would be graded WRONG.\n');
for (const s of Object.keys(perSubject).sort((a, b) => perSubject[b] - perSubject[a])) {
  if (perSubject[s]) console.error(`    ${s.padEnd(20)} ${perSubject[s]}`);
}
if (samples.length) {
  const s = samples[0];
  const c0 = Array.isArray(s.q.c) ? s.q.c[0] : s.q.c;
  console.error(`\n  e.g. [${s.subject}] ${String(s.q.q).slice(0, 70)}`);
  console.error(`       o[c]=${JSON.stringify(s.q.o[c0])}  o_kk[c]=${JSON.stringify(s.q.o_kk[c0])} (wrong)`);
}
console.error('\n  Fix: node scripts/fix-kk-answer-index.mjs --apply  (owner), then re-run dump-questions.mjs.\n');
process.exit(1);
