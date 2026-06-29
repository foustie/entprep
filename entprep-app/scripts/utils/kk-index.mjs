/**
 * Shared detection logic for I18N-1 — Kazakh answer-index mismatch.
 *
 * SINGLE SOURCE OF TRUTH for the rule "o_kk is an exact-text permutation of o but
 * the shared correct-index c is misplaced". Imported by:
 *   - scripts/fix-kk-answer-index.mjs  (reports / realigns the data)
 *   - scripts/check-kk-index.mjs       (predeploy guard — fails the build)
 *   - scripts/__tests__/kk-index.test.ts (vitest regression test)
 *
 * Do NOT duplicate this logic anywhere — import from here.
 * No shebang — this module is imported, never executed directly (a shebang makes
 * vitest fail to parse it; same fix applied to lang-split.mjs / meta.mjs).
 */
import fs from 'fs';
import path from 'path';

export function correctIndices(c) {
  return Array.isArray(c) ? c : [c];
}

export function isMatching(q) {
  if (q.type === 'matching') return true;
  if (!q.type && Array.isArray(q.pairs) && q.pairs.length > 0) return true;
  return false;
}

/** True iff o and o_kk hold the identical multiset of strings (exact, no normalization). */
export function isExactPermutation(o, oKk) {
  if (!Array.isArray(o) || !Array.isArray(oKk)) return false;
  if (o.length === 0 || o.length !== oKk.length) return false;
  const a = [...o].sort();
  const b = [...oKk].sort();
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * If this row is a fixable I18N-1 case, return the realigned o_kk; otherwise null.
 * Realigned o_kk === [...o] (same strings, o's order) so the shared `c` is correct again.
 */
export function computeFix(q) {
  const { o, o_kk: oKk, c } = q;
  if (isMatching(q)) return null;
  if (!Array.isArray(o) || !Array.isArray(oKk) || oKk.length === 0) return null;
  if (!isExactPermutation(o, oKk)) return null; // translated/different options -> out of scope (I18N-2)
  const idxs = correctIndices(c).filter((i) => Number.isInteger(i) && i >= 0 && i < o.length);
  if (idxs.length === 0) return null;
  const misplaced = idxs.some((i) => oKk[i] !== o[i]);
  if (!misplaced) return null;
  return [...o];
}

/** True iff this row is a mis-keyed Kazakh question (I18N-1). */
export function isMisKeyed(q) {
  return computeFix(q) !== null;
}

/**
 * Yield every question object from a dumped data file, flattening the
 * reading.json passages shape ({ qs: [...] }) into individual questions.
 */
function questionsOf(arr) {
  const out = [];
  if (!Array.isArray(arr)) return out;
  for (const item of arr) {
    if (item && Array.isArray(item.qs)) {
      out.push(...item.qs); // passages shape (reading.json)
    } else {
      out.push(item);
    }
  }
  return out;
}

/**
 * Scan every public/data/<subject>.json (skipping manifest/quarantine) and return
 * { perSubject: {subject: count}, total, samples: [{subject, idx, q, fixed}] }.
 */
export function scanDataDir(dataDir, { sampleLimit = 6 } = {}) {
  const files = fs
    .readdirSync(dataDir)
    .filter((f) => f.endsWith('.json') && f !== 'manifest.json' && f !== 'quarantine.json');

  const perSubject = {};
  let total = 0;
  const samples = [];

  for (const file of files) {
    const subject = file.replace(/\.json$/, '');
    const arr = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
    let count = 0;
    questionsOf(arr).forEach((q, idx) => {
      const fixed = computeFix(q);
      if (fixed) {
        count++;
        if (samples.length < sampleLimit) samples.push({ subject, idx, q, fixed });
      }
    });
    perSubject[subject] = count;
    total += count;
  }

  return { perSubject, total, samples };
}
