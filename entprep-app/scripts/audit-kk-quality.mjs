#!/usr/bin/env node
/**
 * Audit quality of Kazakh translations via Claude Sonnet.
 * Samples random questions per subject and evaluates if KK translation is natural or literal.
 *
 * Usage:
 *   node scripts/audit-kk-quality.mjs                # 2 samples per subject = 20 total
 *   node scripts/audit-kk-quality.mjs --samples=5    # 5 per subject = 50 total
 *
 * Cost: ~$0.10-0.30 (Sonnet)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const supabase = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY;
const SAMPLES = parseInt(process.argv.find(a => a.startsWith('--samples='))?.split('=')[1] || '2');

const SUBJECTS = [
  'math', 'reading', 'history', 'geography', 'math_profile',
  'physics', 'biology', 'chemistry', 'world_history', 'informatics', 'law',
];

// ── Fetch sample questions ───────────────────────────────────────────────

console.log(`Sampling ${SAMPLES} questions per subject (${SUBJECTS.length} subjects = ${SAMPLES * SUBJECTS.length} total)...`);

const samples = [];
for (const subject of SUBJECTS) {
  const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', subject).not('q_kk', 'is', null);
  if (!count) continue;

  // Pick random offsets
  const offsets = [];
  for (let i = 0; i < SAMPLES; i++) {
    offsets.push(Math.floor(Math.random() * count));
  }

  for (const offset of offsets) {
    const { data } = await supabase
      .from('questions')
      .select('id, q, q_kk, o, o_kk, e, e_kk')
      .eq('subject', subject)
      .not('q_kk', 'is', null)
      .range(offset, offset)
      .limit(1);

    if (data && data[0]) samples.push({ subject, ...data[0] });
  }
}

console.log(`Fetched ${samples.length} questions\n`);

// ── Evaluate via Sonnet ──────────────────────────────────────────────────

const prompt = `Ты носитель казахского языка, эксперт по образованию в Казахстане.

Оцени качество казахских переводов ниже. Каждый вопрос содержит русский оригинал (RU) и казахский перевод (KK).

Задача для каждого:
1. Оцени по 4-балльной шкале:
   - NATURAL: звучит как настоящий казахский, носитель так бы сказал
   - OK: понятно, грамматически правильно, но немного формально/дословно
   - LITERAL: дословный перевод, калька с русского, звучит неестественно
   - BROKEN: грамматические ошибки, неправильные термины, или бессмыслица

2. Если OK/LITERAL/BROKEN — укажи КОНКРЕТНУЮ проблему в 1 предложении.

Ответь в формате JSON:
[
  { "id": 1, "subject": "chemistry", "quality": "NATURAL|OK|LITERAL|BROKEN", "issue": "..." },
  ...
]

Вопросы для оценки:

${samples.map((s, i) => `
=== ${i+1}. ${s.subject} ===
RU: ${s.q}
KK: ${s.q_kk}
${s.o && s.o_kk ? `RU options: ${s.o.slice(0,2).join(' / ')}\nKK options: ${s.o_kk.slice(0,2).join(' / ')}` : ''}
`).join('\n')}

Верни только JSON массив без markdown.`;

console.log('Analyzing via Claude Sonnet...\n');

const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': ANTHROPIC_KEY,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  }),
});

if (!res.ok) {
  console.error('Claude API error:', await res.text());
  process.exit(1);
}

const data = await res.json();
let raw = data.content?.[0]?.text?.trim() || '';
raw = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();

let results;
try {
  results = JSON.parse(raw);
} catch (e) {
  console.error('Parse error:', e.message);
  console.log('Raw:', raw.substring(0, 500));
  process.exit(1);
}

// ── Report ───────────────────────────────────────────────────────────────

const counts = { NATURAL: 0, OK: 0, LITERAL: 0, BROKEN: 0 };
const byLang = {};

for (const r of results) {
  counts[r.quality] = (counts[r.quality] || 0) + 1;
  if (!byLang[r.subject]) byLang[r.subject] = { NATURAL: 0, OK: 0, LITERAL: 0, BROKEN: 0 };
  byLang[r.subject][r.quality]++;
}

console.log('━━━ Overall ━━━');
console.log(`NATURAL: ${counts.NATURAL} (${Math.round(counts.NATURAL/results.length*100)}%)`);
console.log(`OK:      ${counts.OK} (${Math.round(counts.OK/results.length*100)}%)`);
console.log(`LITERAL: ${counts.LITERAL} (${Math.round(counts.LITERAL/results.length*100)}%)`);
console.log(`BROKEN:  ${counts.BROKEN} (${Math.round(counts.BROKEN/results.length*100)}%)`);

console.log('\n━━━ By Subject ━━━');
for (const [subj, c] of Object.entries(byLang)) {
  const good = c.NATURAL + c.OK;
  const bad = c.LITERAL + c.BROKEN;
  const total = good + bad;
  console.log(`${subj.padEnd(15)} good=${good}/${total} ${bad > 0 ? `⚠️ ${c.LITERAL} literal, ${c.BROKEN} broken` : ''}`);
}

console.log('\n━━━ Issues Detail ━━━');
for (const r of results) {
  if (r.quality === 'LITERAL' || r.quality === 'BROKEN') {
    const sample = samples[r.id - 1];
    console.log(`\n[${r.quality}] ${r.subject}:`);
    console.log(`  RU: ${sample?.q?.substring(0, 80)}`);
    console.log(`  KK: ${sample?.q_kk?.substring(0, 80)}`);
    console.log(`  Issue: ${r.issue}`);
  }
}

// Save report
fs.writeFileSync('kk-quality-report.json', JSON.stringify({
  sampledAt: new Date().toISOString(),
  totalSamples: results.length,
  counts,
  byLang,
  details: results.map((r, i) => ({ ...r, ru: samples[i]?.q, kk: samples[i]?.q_kk })),
}, null, 2));

console.log('\nSaved: kk-quality-report.json');
