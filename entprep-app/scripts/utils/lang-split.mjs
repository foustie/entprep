/**
 * PERF-2 — language split for the dumped question JSON.
 *
 * NOTE: no `#!/usr/bin/env node` shebang — this module is only ever IMPORTED
 * (dump-questions.mjs, split-lang.mjs, the vitest regression). With a shebang it is
 * checked out CRLF by git on Windows and esbuild/vitest then chokes on `#!...\r`
 * (`SyntaxError: Invalid or unexpected token`), silently disabling the invariant tests.
 *
 * SINGLE SOURCE OF TRUTH for turning a combined `<sid>.json` (RU + KK inline) into
 * two language-self-contained files:
 *   - `<sid>.ru.json` — every row with the `_kk` fields stripped.
 *   - `<sid>.kk.json` — every row with the KK overrides baked in (with RU fallback
 *     for untranslated fields, mirroring runtime `clonePool(pool,'kk')`), `_kk` stripped.
 *
 * Imported by:
 *   - scripts/dump-questions.mjs  (emits split alongside the combined file)
 *   - scripts/split-lang.mjs      (derives split files offline from existing combined dumps)
 *   - scripts/__tests__/lang-split.test.ts (vitest regression)
 *
 * INVARIANTS (must hold — reviewed by S2 as the stream's top correctness risk):
 *  1. Row ORDER and COUNT are identical across combined / ru / kk. Rows are mapped
 *     1:1 in place, never filtered — so the runtime array-index `_oi` (non-reading
 *     `_oi = i`, reading `_oi = pi*5+qi`) and the quarantine key `sid:_oi` never shift.
 *  2. The correct-index `c` is carried verbatim. KK options replace RU options
 *     (`o = o_kk`) exactly as `clonePool` does today, so the shared `c` keeps pointing
 *     at the truly-correct answer (the check-kk-index guard blocks misplaced o_kk).
 *  3. Do NOT duplicate this logic anywhere — import from here.
 */

// Question-level Kazakh fields (final dump field names — see dump-questions.mjs rowToQuestion).
export const KK_Q_FIELDS = ['q_kk', 'o_kk', 'e_kk', 'pairs_kk', 'pt_kk', 'px_kk'];
// Passage-level Kazakh fields (see dump-questions.mjs buildPassages).
export const KK_P_FIELDS = ['t_kk', 'tx_kk'];

/** A combined data array is the reading "passages" shape iff its items carry a `qs` array. */
export function isPassageShape(data) {
  return Array.isArray(data) && data.length > 0 && Array.isArray(data[0] && data[0].qs);
}

/** RU view of one question row: drop every `_kk` field, keep everything else verbatim. */
export function stripQuestionKk(q) {
  const out = {};
  for (const k of Object.keys(q)) {
    if (!KK_Q_FIELDS.includes(k)) out[k] = q[k];
  }
  return out;
}

/**
 * KK view of one question row: apply each present KK override onto its RU counterpart
 * (RU fallback when the KK field is absent/empty), then drop all `_kk` fields.
 * Mirrors runtime clonePool(pool,'kk') field-for-field.
 */
export function applyQuestionKk(q) {
  const out = stripQuestionKk(q);
  if (q.q_kk != null) out.q = q.q_kk;
  if (Array.isArray(q.o_kk) && q.o_kk.length) out.o = q.o_kk;
  if (q.e_kk != null) out.e = q.e_kk;
  if (q.pairs_kk != null) out.pairs = q.pairs_kk;
  if (q.pt_kk != null) out.pt = q.pt_kk;
  if (q.px_kk != null) out.px = q.px_kk;
  return out;
}

/** RU view of a passage: strip passage-level `_kk`, strip each question's `_kk`. */
function stripPassageKk(p) {
  const out = {};
  for (const k of Object.keys(p)) {
    if (k === 'qs' || KK_P_FIELDS.includes(k)) continue;
    out[k] = p[k];
  }
  out.qs = Array.isArray(p.qs) ? p.qs.map(stripQuestionKk) : [];
  return out;
}

/** KK view of a passage: apply passage-level KK (RU fallback), apply each question's KK. */
function applyPassageKk(p) {
  const out = {};
  for (const k of Object.keys(p)) {
    if (k === 'qs' || KK_P_FIELDS.includes(k)) continue;
    out[k] = p[k];
  }
  if (p.t_kk != null) out.t = p.t_kk;
  if (p.tx_kk != null) out.tx = p.tx_kk;
  out.qs = Array.isArray(p.qs) ? p.qs.map(applyQuestionKk) : [];
  return out;
}

/**
 * Split a combined dump array into { ru, kk } — both the same length/order as the input.
 * Auto-detects the reading "passages" shape vs flat question rows.
 */
export function splitData(data) {
  if (!Array.isArray(data)) return { ru: data, kk: data };
  if (isPassageShape(data)) {
    return { ru: data.map(stripPassageKk), kk: data.map(applyPassageKk) };
  }
  return { ru: data.map(stripQuestionKk), kk: data.map(applyQuestionKk) };
}
