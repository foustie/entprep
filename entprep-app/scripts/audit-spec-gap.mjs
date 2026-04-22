// Cross-reference current CDN questions against official ENT specs.
// Reports off-spec topics (questions on wrong topics) and missing topics (gaps in coverage).
// Run: node scripts/audit-spec-gap.mjs
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
  // history_kz spec → 'history' subject file in CDN
  const sid = s.subject === 'history_kz' ? 'history' : s.subject;
  specBySubject[sid] = s;
}

const subjects = readdirSync(dataDir)
  .filter(f => f.endsWith('.json') && !['manifest.json','quarantine.json'].includes(f))
  .map(f => f.replace('.json',''));

console.log('=== ENT spec gap analysis ===\n');
let totals = { offSpec: 0, missing: 0, nullTopic: 0, totalQ: 0 };

for (const sid of subjects) {
  const spec = specBySubject[sid];
  if (!spec) {
    console.log(`[${sid}] no spec — skip\n`);
    continue;
  }

  const data = JSON.parse(readFileSync(`${dataDir}/${sid}.json`));
  let qs = Array.isArray(data) ? data : data.questions || [];
  if (sid === 'reading') qs = qs.flatMap(p => p.qs || []);

  const specSections = new Set();
  const specTopics = new Set();
  for (const sec of spec.sections || []) {
    specSections.add(sec.id);
    for (const t of sec.topics || []) specTopics.add(t.id);
  }

  const currentTopicCounts = {};
  let nullTopic = 0;
  for (const q of qs) {
    const t = q._topic || q.topic;
    if (!t) { nullTopic++; continue; }
    currentTopicCounts[t] = (currentTopicCounts[t] || 0) + 1;
  }
  const currentTopicKeys = Object.keys(currentTopicCounts);
  const offSpec = currentTopicKeys.filter(t => !specTopics.has(t) && !specSections.has(t));
  const missing = [...specTopics].filter(t => !currentTopicKeys.includes(t));

  totals.totalQ += qs.length;
  totals.nullTopic += nullTopic;
  totals.offSpec += offSpec.reduce((s,t) => s + currentTopicCounts[t], 0);
  totals.missing += missing.length;

  console.log(`[${sid}] ${qs.length}q | spec ${spec.totalQuestions}/test, ${spec.sections?.length||0} sections, ${specTopics.size} topics`);
  console.log(`  null _topic: ${nullTopic} (${Math.round(nullTopic/qs.length*100)}%)`);
  console.log(`  CDN topics in use: ${currentTopicKeys.length}`);
  if (offSpec.length > 0) {
    console.log(`  ⚠ OFF-SPEC topics (${offSpec.length}, ${offSpec.reduce((s,t)=>s+currentTopicCounts[t],0)} questions):`);
    offSpec.slice(0,12).forEach(t => console.log(`     "${t}": ${currentTopicCounts[t]}q`));
    if (offSpec.length > 12) console.log(`     ... +${offSpec.length - 12} more`);
  }
  if (missing.length > 0) {
    console.log(`  ❌ MISSING spec topics (${missing.length} of ${specTopics.size}):`);
    missing.slice(0,12).forEach(t => console.log(`     ${t}`));
    if (missing.length > 12) console.log(`     ... +${missing.length - 12} more`);
  }
  console.log('');
}

console.log('=== TOTALS ===');
console.log(`questions: ${totals.totalQ}`);
console.log(`null _topic across all: ${totals.nullTopic}`);
console.log(`off-spec questions: ${totals.offSpec}`);
console.log(`missing spec topics across all: ${totals.missing}`);
