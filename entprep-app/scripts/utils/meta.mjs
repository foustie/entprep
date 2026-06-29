/**
 * PERF-1 — per-subject meta (counts) for the dumped question data.
 *
 * SINGLE SOURCE OF TRUTH for the tiny `<sid>.meta.json` that SubjectDetail reads on
 * mount instead of downloading the whole multi-MB pool. Shape:
 *   { total, hasSubtopics, topicCounts:{topicId:n}, subtopicCounts:{subtopicId:n} }
 *
 * Counts are POST-QUARANTINE — they must equal what `getPool(sid) → filterQuarantined`
 * would yield, so SubjectDetail shows the same numbers it showed before (S2 criterion).
 * `_oi` is derived exactly like getPool (non-reading: array index; reading passages:
 * pi*5+qi) so the quarantine key `sid:_oi` lines up.
 *
 * Imported by: scripts/gen-meta.mjs (offline), scripts/dump-questions.mjs (deploy chain),
 * scripts/__tests__/meta.test.ts (vitest). No shebang — imported only (see lang-split.mjs).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { isPassageShape } from './lang-split.mjs';

/** Flatten a combined data array to questions carrying their runtime `_oi`. Mirrors getPool. */
export function flattenWithOi(data) {
  const out = [];
  if (isPassageShape(data)) {
    data.forEach((p, pi) => (p.qs || []).forEach((q, qi) => out.push({ ...q, _oi: pi * 5 + qi })));
  } else if (Array.isArray(data)) {
    data.forEach((q, i) => out.push({ ...q, _oi: i }));
  }
  return out;
}

/** Compute the meta object for one subject's combined data, excluding quarantined `_oi`. */
export function computeMeta(data, quarantinedOi = new Set()) {
  const flat = flattenWithOi(data).filter(q => !quarantinedOi.has(q._oi));
  const topicCounts = {};
  const subtopicCounts = {};
  let hasSubtopics = false;
  for (const q of flat) {
    if (q._topic) topicCounts[q._topic] = (topicCounts[q._topic] || 0) + 1;
    if (q._subtopic) {
      hasSubtopics = true;
      subtopicCounts[q._subtopic] = (subtopicCounts[q._subtopic] || 0) + 1;
    }
  }
  return { total: flat.length, hasSubtopics, topicCounts, subtopicCounts };
}

/** Parse quarantine.json (array of {s,i}) into { sid: Set(oi) }. */
export function loadQuarantineBySid(dataDir) {
  const map = {};
  const p = join(dataDir, 'quarantine.json');
  if (!existsSync(p)) return map;
  try {
    const arr = JSON.parse(readFileSync(p, 'utf8'));
    for (const row of arr) {
      if (!row || row.s == null || row.i == null) continue;
      (map[row.s] ||= new Set()).add(row.i);
    }
  } catch { /* malformed quarantine → treat as empty */ }
  return map;
}

const SKIP = new Set(['manifest.json', 'quarantine.json']);
/** True for a combined per-subject data file (skips manifest, quarantine, lang splits, meta). */
export function isCombinedSubjectFile(f) {
  return f.endsWith('.json') && !SKIP.has(f)
    && !f.endsWith('.ru.json') && !f.endsWith('.kk.json') && !f.endsWith('.meta.json');
}

/**
 * Write `<sid>.meta.json` for every combined subject file in dataDir, filtering by the
 * quarantine.json currently on disk. Returns a [{sid, bytes, total}] report.
 */
export function writeAllMeta(dataDir) {
  const quar = loadQuarantineBySid(dataDir);
  const files = readdirSync(dataDir).filter(isCombinedSubjectFile).sort();
  const report = [];
  for (const f of files) {
    const sid = f.replace(/\.json$/, '');
    const data = JSON.parse(readFileSync(join(dataDir, f), 'utf8'));
    const meta = computeMeta(data, quar[sid] || new Set());
    const json = JSON.stringify(meta);
    writeFileSync(join(dataDir, `${sid}.meta.json`), json);
    report.push({ sid, bytes: Buffer.byteLength(json), total: meta.total });
  }
  return report;
}
