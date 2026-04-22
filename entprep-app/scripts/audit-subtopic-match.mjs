// Verify _subtopic IDs in CDN match official spec topic IDs.
// Reports per-subject: matched / unmatched / missing.
import * as specs from './utils/ent-specs.mjs';
import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '..', 'public', 'data');

const specBySubject = {};
for (const k of Object.keys(specs)) {
  if (!k.startsWith('SPEC_')) continue;
  const s = specs[k];
  if (!s?.subject) continue;
  const sid = s.subject === 'history_kz' ? 'history' : s.subject;
  specBySubject[sid] = s;
}

const subjects = readdirSync(dataDir)
  .filter(f => f.endsWith('.json') && !['manifest.json','quarantine.json'].includes(f))
  .map(f => f.replace('.json',''));

console.log('=== Subtopic ID match audit (CDN vs spec) ===\n');

for (const sid of subjects) {
  const spec = specBySubject[sid];
  if (!spec) {
    console.log(`[${sid}] no spec — skip\n`);
    continue;
  }

  const data = JSON.parse(readFileSync(`${dataDir}/${sid}.json`));
  let qs = Array.isArray(data) ? data : data.questions || [];
  if (sid === 'reading') qs = qs.flatMap(p => p.qs || []);

  const specTopics = new Set();
  const specSections = new Set();
  for (const sec of spec.sections || []) {
    specSections.add(sec.id);
    for (const t of sec.topics || []) specTopics.add(t.id);
  }

  const subtopicCounts = {};
  let nullStp = 0;
  for (const q of qs) {
    const st = q._subtopic;
    if (!st) { nullStp++; continue; }
    subtopicCounts[st] = (subtopicCounts[st] || 0) + 1;
  }

  const matched = Object.keys(subtopicCounts).filter(t => specTopics.has(t));
  const unmatched = Object.keys(subtopicCounts).filter(t => !specTopics.has(t));
  const missing = [...specTopics].filter(t => !subtopicCounts[t]);

  const matchedQ = matched.reduce((s,t) => s + subtopicCounts[t], 0);
  const unmatchedQ = unmatched.reduce((s,t) => s + subtopicCounts[t], 0);

  console.log(`[${sid}] ${qs.length}q, spec topics: ${specTopics.size}`);
  console.log(`  matched IDs: ${matched.length} (${matchedQ} questions)`);
  console.log(`  null _subtopic: ${nullStp}`);
  if (unmatched.length > 0) {
    console.log(`  ⚠ unmatched IDs in CDN (${unmatched.length}, ${unmatchedQ}q):`);
    unmatched.slice(0,15).forEach(t => console.log(`     "${t}": ${subtopicCounts[t]}q`));
    if (unmatched.length > 15) console.log(`     ... +${unmatched.length - 15} more`);
  }
  if (missing.length > 0) {
    console.log(`  ❌ MISSING spec topics (${missing.length}):`);
    missing.slice(0,15).forEach(t => console.log(`     ${t}`));
    if (missing.length > 15) console.log(`     ... +${missing.length - 15} more`);
  }
  console.log('');
}
