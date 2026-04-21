#!/usr/bin/env node
/**
 * Compute per-question accuracy from user_data and generate quarantine list.
 * Questions with accuracy < THRESHOLD and enough attempts get quarantined.
 *
 * Usage:
 *   node scripts/compute-quarantine.mjs                    # analyze + write quarantine.json
 *   node scripts/compute-quarantine.mjs --threshold=0.15   # custom threshold (default 0.20)
 *   node scripts/compute-quarantine.mjs --min-attempts=5   # custom min attempts (default 10)
 *   node scripts/compute-quarantine.mjs --dry-run          # analyze only, don't write
 *
 * Output: public/data/quarantine.json
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// CLI
const ARGS = process.argv.slice(2);
const THRESHOLD = parseFloat(ARGS.find(a => a.startsWith('--threshold='))?.split('=')[1] || '0.20');
const MIN_ATTEMPTS = parseInt(ARGS.find(a => a.startsWith('--min-attempts='))?.split('=')[1] || '10');
const DRY_RUN = ARGS.includes('--dry-run');

// Env
const envFile = readFileSync(join(__dirname, '..', '.env'), 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const supabase = createClient(
  env.SUPABASE_URL || env.VITE_SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY,
);

// Fetch all user_data
async function fetchAllUserData() {
  const PAGE = 500;
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('user_data')
      .select('hist')
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`Fetch error: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

async function main() {
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║         ENTprep Question Accuracy Analysis            ║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
  console.log(`  Threshold: ${(THRESHOLD * 100).toFixed(0)}% accuracy`);
  console.log(`  Min attempts: ${MIN_ATTEMPTS}`);

  // Fetch user data
  console.log('\n  Fetching user_data...');
  const users = await fetchAllUserData();
  console.log(`  ${users.length} users loaded`);

  // Aggregate per-question stats: key = "subject:idx"
  const stats = {}; // { "math_profile:42": { attempts: N, correct: N } }
  let totalResults = 0;
  let totalQd = 0;

  for (const user of users) {
    const hist = user.hist;
    if (!Array.isArray(hist)) continue;

    for (const result of hist) {
      if (!result.qd || !Array.isArray(result.qd)) continue;
      totalResults++;

      const subject = result.su;
      if (!subject) continue;

      for (const qd of result.qd) {
        if (qd.oi === undefined || qd.oi === null) continue;
        totalQd++;

        const key = `${subject}:${qd.oi}`;
        if (!stats[key]) stats[key] = { subject, idx: qd.oi, attempts: 0, correct: 0 };
        stats[key].attempts++;
        if (qd.ok) stats[key].correct++;
      }
    }
  }

  console.log(`  ${totalResults} test results, ${totalQd} question-answers processed`);
  console.log(`  ${Object.keys(stats).length} unique questions with data`);

  // Find questions below threshold
  const allEntries = Object.values(stats);
  const withEnoughAttempts = allEntries.filter(s => s.attempts >= MIN_ATTEMPTS);
  const quarantined = withEnoughAttempts
    .map(s => ({ ...s, accuracy: s.correct / s.attempts }))
    .filter(s => s.accuracy < THRESHOLD)
    .sort((a, b) => a.accuracy - b.accuracy);

  // Summary by subject
  console.log(`\n  ━━━ Per-Subject Summary ━━━`);
  const bySubject = {};
  for (const s of withEnoughAttempts) {
    if (!bySubject[s.subject]) bySubject[s.subject] = { questions: 0, quarantined: 0, totalAttempts: 0 };
    bySubject[s.subject].questions++;
    bySubject[s.subject].totalAttempts += s.attempts;
  }
  for (const q of quarantined) {
    if (bySubject[q.subject]) bySubject[q.subject].quarantined++;
  }

  console.log(`  ${'Subject'.padEnd(17)} | Questions | Quarantined | Avg attempts`);
  console.log('  ' + '-'.repeat(60));
  for (const [subj, data] of Object.entries(bySubject).sort((a, b) => b[1].quarantined - a[1].quarantined)) {
    const avg = (data.totalAttempts / data.questions).toFixed(1);
    console.log(`  ${subj.padEnd(17)} | ${String(data.questions).padStart(9)} | ${String(data.quarantined).padStart(11)} | ${avg}`);
  }

  // Show worst questions
  if (quarantined.length > 0) {
    console.log(`\n  ━━━ Quarantined Questions (${quarantined.length}) ━━━`);
    console.log(`  ${'Subject'.padEnd(15)} | idx  | Attempts | Correct | Accuracy`);
    console.log('  ' + '-'.repeat(60));
    for (const q of quarantined.slice(0, 30)) {
      console.log(`  ${q.subject.padEnd(15)} | ${String(q.idx).padStart(4)} | ${String(q.attempts).padStart(8)} | ${String(q.correct).padStart(7)} | ${(q.accuracy * 100).toFixed(1)}%`);
    }
    if (quarantined.length > 30) console.log(`  ... and ${quarantined.length - 30} more`);
  }

  // Also show near-misses (20-30% accuracy) for monitoring
  const nearMisses = withEnoughAttempts
    .map(s => ({ ...s, accuracy: s.correct / s.attempts }))
    .filter(s => s.accuracy >= THRESHOLD && s.accuracy < 0.30)
    .sort((a, b) => a.accuracy - b.accuracy);

  if (nearMisses.length > 0) {
    console.log(`\n  ⚠ Near-misses (${THRESHOLD * 100}%-30% accuracy): ${nearMisses.length} questions`);
  }

  // Write quarantine.json
  const output = quarantined.map(q => ({ s: q.subject, i: q.idx }));

  if (!DRY_RUN) {
    const outPath = join(__dirname, '..', 'public', 'data', 'quarantine.json');
    writeFileSync(outPath, JSON.stringify(output));
    console.log(`\n  📁 Quarantine list written: ${outPath} (${output.length} questions)`);
  } else {
    console.log(`\n  DRY RUN — no files written. ${output.length} questions would be quarantined.`);
  }

  console.log(`\n  Total: ${quarantined.length} quarantined, ${nearMisses.length} near-misses\n`);
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
