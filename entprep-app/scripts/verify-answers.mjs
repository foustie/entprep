#!/usr/bin/env node
/**
 * Verify question answer correctness via Claude AI.
 * Claude solves each question independently step-by-step, then we compare with stored answer.
 *
 * Usage:
 *   node scripts/verify-answers.mjs --subject=math_profile                    # dry run, all
 *   node scripts/verify-answers.mjs --subject=math_profile --sample=20        # test 20
 *   node scripts/verify-answers.mjs --subject=math_profile --apply            # fix in Supabase
 *   node scripts/verify-answers.mjs --subject=math_profile --offset=500       # start from idx 500
 *   node scripts/verify-answers.mjs --all-stem                                # all STEM subjects
 *   node scripts/verify-answers.mjs --subject=history --model=haiku           # factual with Haiku
 *
 * Cost estimates (per 2000 questions):
 *   Haiku:  ~$2-3
 *   Sonnet: ~$8-10
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI ─────────────────────────────────────────────────────────────────────
const ARGS = process.argv.slice(2);
const SUBJECT = ARGS.find(a => a.startsWith('--subject='))?.split('=')[1];
const ALL_STEM = ARGS.includes('--all-stem');
const SAMPLE = parseInt(ARGS.find(a => a.startsWith('--sample='))?.split('=')[1] || '0');
const OFFSET = parseInt(ARGS.find(a => a.startsWith('--offset='))?.split('=')[1] || '0');
const APPLY = ARGS.includes('--apply');
const MODEL_FLAG = ARGS.find(a => a.startsWith('--model='))?.split('=')[1] || 'haiku';
const CONCURRENCY = parseInt(ARGS.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '5');
const RESUME = ARGS.includes('--resume');

const MODELS = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-20250514',
};
const MODEL = MODELS[MODEL_FLAG] || MODEL_FLAG;

const STEM_SUBJECTS = ['math_profile', 'math', 'physics', 'chemistry', 'informatics'];
const ALL_SUBJECTS = [...STEM_SUBJECTS, 'history', 'geography', 'biology', 'world_history', 'english', 'law', 'reading'];
const subjects = ALL_STEM ? STEM_SUBJECTS : SUBJECT ? [SUBJECT] : [];

if (subjects.length === 0) {
  console.error('Usage: --subject=math_profile  or  --all-stem');
  console.error('Flags: --sample=N  --apply  --model=haiku|sonnet  --concurrency=N  --resume  --offset=N');
  process.exit(1);
}

// ── Env ─────────────────────────────────────────────────────────────────────
const envPath = join(__dirname, '..', '.env');
const envFile = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE env vars'); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Fetch questions ─────────────────────────────────────────────────────────
async function fetchQuestions(subject) {
  const PAGE = 1000;
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('questions')
      .select('id,idx,subject,topic,q,o,c,e,type')
      .eq('subject', subject)
      .eq('type', 'single')
      .order('idx')
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`Fetch error: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

// ── Claude API ──────────────────────────────────────────────────────────────
let totalInputTokens = 0;
let totalOutputTokens = 0;

async function askClaude(question, options, subject, retries = 3) {
  const subjectNames = {
    math_profile: 'Профильная математика',
    math: 'Математическая грамотность',
    physics: 'Физика',
    chemistry: 'Химия',
    informatics: 'Информатика',
    history: 'История Казахстана',
    geography: 'География',
    biology: 'Биология',
    world_history: 'Всемирная история',
    english: 'Английский язык',
    law: 'Основы права',
    reading: 'Грамотность чтения',
  };

  const optionsText = options.map((o, i) => `${i}) ${o}`).join('\n');

  const prompt = `Ты проверяешь вопросы для ЕНТ (Казахстан). Предмет: ${subjectNames[subject] || subject}.

РЕШИ ЗАДАЧУ ПОШАГОВО. Покажи ход решения. В самом конце напиши ответ в формате "ОТВЕТ: N" где N — номер правильного варианта (0, 1, 2 или 3).

Вопрос: ${question}

Варианты:
${optionsText}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      if (res.status === 429 && retries > 0) {
        const wait = retries === 3 ? 10000 : retries === 2 ? 30000 : 60000;
        console.log(`\n  Rate limited, waiting ${wait/1000}s...`);
        await new Promise(r => setTimeout(r, wait));
        return askClaude(question, options, subject, retries - 1);
      }
      if (res.status === 529 && retries > 0) {
        console.log(`\n  API overloaded, waiting 30s...`);
        await new Promise(r => setTimeout(r, 30000));
        return askClaude(question, options, subject, retries - 1);
      }
      const err = await res.text();
      throw new Error(`API error ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    totalInputTokens += data.usage?.input_tokens || 0;
    totalOutputTokens += data.usage?.output_tokens || 0;

    const text = data.content?.[0]?.text || '';
    return text;
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 5000));
      return askClaude(question, options, subject, retries - 1);
    }
    throw err;
  }
}

function parseAnswer(text) {
  // Look for "ОТВЕТ: N" pattern (primary)
  const match = text.match(/ОТВЕТ:\s*(\d)/i);
  if (match) return parseInt(match[1]);

  // Fallback: "ответ — N", "правильный ответ: N"
  const fallback = text.match(/(?:ответ|answer|правильный)[:\s—-]*(\d)\s*\)?/i);
  if (fallback) return parseInt(fallback[1]);

  return null;
}

// ── Results file ────────────────────────────────────────────────────────────
function getResultsPath(subject) {
  return join(__dirname, '..', `verify-${subject}.json`);
}

function loadExistingResults(subject) {
  const path = getResultsPath(subject);
  if (RESUME && existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch { return []; }
  }
  return [];
}

function saveResults(subject, results) {
  writeFileSync(getResultsPath(subject), JSON.stringify(results, null, 2));
}

// ── Process ─────────────────────────────────────────────────────────────────
async function processSubject(subject) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Verifying: ${subject} (model: ${MODEL_FLAG})`);
  console.log('═'.repeat(60));

  // Fetch
  let questions = await fetchQuestions(subject);
  console.log(`  Loaded ${questions.length} single-choice questions`);

  // Offset
  if (OFFSET > 0) {
    questions = questions.filter(q => q.idx >= OFFSET);
    console.log(`  After offset=${OFFSET}: ${questions.length} questions`);
  }

  // Sample
  if (SAMPLE > 0) {
    // Take evenly spaced sample for better coverage
    const step = Math.floor(questions.length / SAMPLE);
    const sampled = [];
    for (let i = 0; i < questions.length && sampled.length < SAMPLE; i += Math.max(step, 1)) {
      sampled.push(questions[i]);
    }
    questions = sampled;
    console.log(`  Sampled ${questions.length} questions (evenly spaced)`);
  }

  // Resume — skip already verified
  const existing = loadExistingResults(subject);
  const verifiedIds = new Set(existing.map(r => r.id));
  if (RESUME && verifiedIds.size > 0) {
    questions = questions.filter(q => !verifiedIds.has(q.id));
    console.log(`  Resuming — skipping ${verifiedIds.size} already verified, ${questions.length} remaining`);
  }

  const results = [...existing];
  let mismatches = existing.filter(r => !r.match);
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < questions.length; i += CONCURRENCY) {
    const batch = questions.slice(i, i + CONCURRENCY);

    const batchResults = await Promise.allSettled(
      batch.map(async (q) => {
        const text = await askClaude(q.q, q.o, q.subject);
        const aiAnswer = parseAnswer(text);

        return {
          id: q.id,
          idx: q.idx,
          subject: q.subject,
          topic: q.topic,
          question: q.q.slice(0, 150),
          options: q.o,
          storedAnswer: q.c,
          aiAnswer,
          match: aiAnswer === q.c,
          reasoning: text,
        };
      })
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value);
        if (!r.value.match) {
          mismatches.push(r.value);
          if (r.value.aiAnswer !== null) {
            console.log(`\n  ✗ MISMATCH [${r.value.idx}] stored=${r.value.storedAnswer} ai=${r.value.aiAnswer}`);
            console.log(`    Q: ${r.value.question}`);
            console.log(`    Stored: ${r.value.options[r.value.storedAnswer]}`);
            if (r.value.aiAnswer >= 0 && r.value.aiAnswer <= 3) {
              console.log(`    AI says: ${r.value.options[r.value.aiAnswer]}`);
            }
          } else {
            console.log(`\n  ? PARSE_FAIL [${r.value.idx}] — couldn't extract answer`);
            errors++;
          }
        }
      } else {
        console.log(`\n  ⚠ ERROR: ${r.reason?.message?.slice(0, 100)}`);
        errors++;
      }
    }

    // Progress
    const done = Math.min(i + CONCURRENCY, questions.length) + verifiedIds.size;
    const total = questions.length + verifiedIds.size;
    const pct = (done / total * 100).toFixed(1);
    const verified = results.length;
    const matchCount = results.filter(r => r.match).length;
    const matchRate = verified > 0 ? (matchCount / verified * 100).toFixed(1) : '0';
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const eta = verified > verifiedIds.size
      ? ((Date.now() - startTime) / (verified - verifiedIds.size) * (total - verified) / 1000).toFixed(0)
      : '?';

    process.stdout.write(
      `\r  [${done}/${total}] ${pct}% | ✓${matchCount} ✗${mismatches.length} ?${errors} | accuracy: ${matchRate}% | ${elapsed}s elapsed, ~${eta}s left    `
    );

    // Save periodically (every 50 questions)
    if (verified % 50 < CONCURRENCY) {
      saveResults(subject, results);
    }

    // Small delay between batches
    await new Promise(r => setTimeout(r, 200));
  }

  // Final save
  saveResults(subject, results);

  // ── Summary ─────────────────────────────────────────────────────────────
  const verified = results.length;
  const matchCount = results.filter(r => r.match).length;
  const mismatchCount = mismatches.filter(m => m.aiAnswer !== null).length;
  const parseFailCount = mismatches.filter(m => m.aiAnswer === null).length;

  console.log(`\n\n  ━━━ ${subject} Results ━━━`);
  console.log(`  Total verified: ${verified}`);
  console.log(`  ✓ Correct:     ${matchCount} (${(matchCount/verified*100).toFixed(1)}%)`);
  console.log(`  ✗ Mismatch:    ${mismatchCount} (${(mismatchCount/verified*100).toFixed(1)}%)`);
  console.log(`  ? Parse fail:  ${parseFailCount}`);
  console.log(`  Errors:        ${errors}`);
  console.log(`  Results saved: ${getResultsPath(subject)}`);

  // Cost estimate
  const inputCost = MODEL_FLAG === 'haiku'
    ? totalInputTokens / 1_000_000 * 0.80
    : totalInputTokens / 1_000_000 * 3;
  const outputCost = MODEL_FLAG === 'haiku'
    ? totalOutputTokens / 1_000_000 * 4
    : totalOutputTokens / 1_000_000 * 15;
  console.log(`  Tokens: ${totalInputTokens} in + ${totalOutputTokens} out ≈ $${(inputCost + outputCost).toFixed(2)}`);

  // ── Apply fixes ───────────────────────────────────────────────────────────
  const confirmedMismatches = mismatches.filter(m => m.aiAnswer !== null && m.aiAnswer >= 0 && m.aiAnswer <= 3);

  if (APPLY && confirmedMismatches.length > 0) {
    console.log(`\n  Applying ${confirmedMismatches.length} fixes to Supabase...`);
    let fixed = 0;
    for (const m of confirmedMismatches) {
      const { error } = await supabase
        .from('questions')
        .update({ c: m.aiAnswer })
        .eq('id', m.id);
      if (error) {
        console.log(`  ERROR fixing ${m.id}: ${error.message}`);
      } else {
        fixed++;
      }
    }
    console.log(`  Fixed: ${fixed}/${confirmedMismatches.length}`);
  } else if (confirmedMismatches.length > 0) {
    console.log(`\n  ${confirmedMismatches.length} questions need fixing. Run with --apply to update Supabase.`);
  }

  return { verified, matchCount, mismatchCount, parseFailCount, errors };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║         ENTprep Answer Verification                  ║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
  console.log(`  Model: ${MODEL} (${MODEL_FLAG})`);
  console.log(`  Subjects: ${subjects.join(', ')}`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log(`  Apply: ${APPLY}`);
  if (SAMPLE) console.log(`  Sample: ${SAMPLE}`);
  if (RESUME) console.log(`  Resume: enabled`);

  const grandResults = [];

  for (const subject of subjects) {
    const result = await processSubject(subject);
    grandResults.push({ subject, ...result });
  }

  if (subjects.length > 1) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log('  GRAND SUMMARY');
    console.log('═'.repeat(60));
    for (const r of grandResults) {
      const rate = r.verified > 0 ? (r.matchCount / r.verified * 100).toFixed(1) : '0';
      console.log(`  ${r.subject.padEnd(15)} ${rate}% correct | ${r.mismatchCount} mismatches`);
    }
  }

  console.log(`\n  Total API cost: ~$${((totalInputTokens / 1_000_000 * (MODEL_FLAG === 'haiku' ? 0.80 : 3)) + (totalOutputTokens / 1_000_000 * (MODEL_FLAG === 'haiku' ? 4 : 15))).toFixed(2)}`);
  console.log('');
}

main().catch(err => {
  console.error(`\nFatal: ${err.message}`);
  process.exit(1);
});
