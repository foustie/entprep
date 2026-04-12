#!/usr/bin/env node
/**
 * Fix q_kk for English subject — translate only Russian instructions to Kazakh,
 * preserve ALL English content (sentences, words, quotes) exactly as-is.
 *
 * Also fixes o_kk for translation-type questions where English words were wrongly
 * translated to Kazakh in options.
 *
 * Usage:
 *   node scripts/fix-english-kk.mjs              # fix all
 *   node scripts/fix-english-kk.mjs --dry-run    # preview only
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
try {
  const envFile = readFileSync(join(__dirname, '..', '.env'), 'utf8');
  for (const line of envFile.split('\n')) {
    const m = line.match(/^\s*([^#\s=]+)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2];
  }
} catch {}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }

const dryRun = process.argv.includes('--dry-run');
const BATCH_SIZE = 25;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callClaude(systemPrompt, userPrompt) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          temperature: 0.3,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        if (err.includes('429') || err.includes('rate_limit')) {
          console.log(`    Rate limited, waiting ${30 + attempt * 15}s...`);
          await sleep((30 + attempt * 15) * 1000);
          continue;
        }
        throw new Error(`API ${res.status}: ${err.slice(0, 200)}`);
      }
      const data = await res.json();
      const raw = data.content?.[0]?.text?.trim();
      if (!raw) throw new Error('Empty response');

      // Extract JSON
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found');
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      if (attempt < 3) {
        console.log(`    Retry ${attempt + 1}/3: ${e.message.slice(0, 60)}`);
        await sleep(3000);
      } else throw e;
    }
  }
}

const SYSTEM_PROMPT = `Ты переводчик с русского на казахский для теста по АНГЛИЙСКОМУ ЯЗЫКУ (ЕНТ).

КРИТИЧЕСКИЕ ПРАВИЛА:
1. Переведи ТОЛЬКО русскую часть вопроса на казахский
2. ВСЕ английские слова, предложения, цитаты ОСТАВЬ БЕЗ ИЗМЕНЕНИЙ
3. Английские слова в кавычках ('beautiful', "environment") — НЕ ПЕРЕВОДИ
4. Английские предложения (She ___ to school, The book was written...) — НЕ ПЕРЕВОДИ
5. Пиши грамотный, естественный казахский
6. Сохрани формат: кавычки, двоеточия, знаки пунктуации

Примеры:
- "Выберите правильный вариант: She ___ to school every day." → "Дұрыс нұсқаны таңдаңыз: She ___ to school every day."
- "Как переводится 'beautiful'?" → "'beautiful' сөзінің аудармасын таңдаңыз"
- "Выберите правильный предлог: I live ___ Almaty." → "Дұрыс предлогты таңдаңыз: I live ___ Almaty."
- "Множественное число слова 'child'?" → "'child' сөзінің көпше түрі?"
- "Выберите перевод: 'environment'" → "Аударманы таңдаңыз: 'environment'"
- "В тексте автор использует 'extraordinary'" → "Мәтінде автор 'extraordinary' сөзін қолданады"

Верни JSON массив строк, по одному переводу для каждого вопроса. Количество элементов = количество вопросов.`;

async function fetchAllEnglish() {
  const PAGE = 1000;
  let rows = [], offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, idx, q, q_kk, o, o_kk')
      .eq('subject', 'english')
      .order('idx')
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    rows = rows.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

async function main() {
  console.log(`Fix English q_kk translations`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  const rows = await fetchAllEnglish();
  console.log(`Total English questions: ${rows.length}\n`);

  let fixed = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
    process.stdout.write(`Batch ${batchNum}/${totalBatches} (${batch.length}q)...`);

    const qList = batch.map((r, j) => `${j + 1}. ${r.q}`).join('\n');

    try {
      const translations = await callClaude(SYSTEM_PROMPT, `Переведи ${batch.length} вопросов:\n\n${qList}`);

      if (!Array.isArray(translations) || translations.length !== batch.length) {
        console.log(` ✗ got ${translations?.length || 0} translations, expected ${batch.length}`);
        errors += batch.length;
        await sleep(2000);
        continue;
      }

      if (dryRun) {
        // Show first 3 from batch
        for (let j = 0; j < Math.min(3, batch.length); j++) {
          console.log(`\n  RU: ${batch[j].q.slice(0, 80)}`);
          console.log(`  OLD KK: ${(batch[j].q_kk || 'NONE').slice(0, 80)}`);
          console.log(`  NEW KK: ${translations[j].slice(0, 80)}`);
        }
        fixed += batch.length;
      } else {
        // Update each question
        for (let j = 0; j < batch.length; j++) {
          const newKK = translations[j];
          if (!newKK || typeof newKK !== 'string' || newKK.length < 5) continue;

          const { error } = await supabase
            .from('questions')
            .update({ q_kk: newKK })
            .eq('id', batch[j].id);

          if (error) {
            console.log(`\n  ✗ DB error idx=${batch[j].idx}: ${error.message}`);
            errors++;
          } else {
            fixed++;
          }
        }
        console.log(` ✓ ${batch.length} updated`);
      }

      await sleep(1500);
    } catch (err) {
      console.log(` ✗ ${err.message.slice(0, 80)}`);
      errors += batch.length;
      await sleep(5000);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`DONE: ${fixed} fixed, ${errors} errors`);
  if (!dryRun) {
    console.log(`\n⚠ Run: node scripts/dump-questions.mjs english && build && deploy`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
