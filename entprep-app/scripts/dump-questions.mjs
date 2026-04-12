#!/usr/bin/env node
/**
 * Pre-build script: dump all questions from Supabase to static JSON in public/data/
 * These files are served by Netlify CDN — much faster than Supabase API from Kazakhstan.
 *
 * Usage: node scripts/dump-questions.mjs
 * Run BEFORE vite build. Vite copies public/ to dist/ automatically.
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (no dotenv dependency)
try {
  const envFile = readFileSync(join(__dirname, '..', '.env'), 'utf8');
  for (const line of envFile.split('\n')) {
    const m = line.match(/^\s*([^#\s=]+)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2];
  }
} catch {}
const OUT_DIR = join(__dirname, '..', 'public', 'data');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SUBJECTS = [
  'math', 'reading', 'history', 'geography', 'english',
  'math_profile', 'physics', 'biology', 'chemistry',
  'world_history', 'informatics', 'law',
  'literature_russian', 'literature_kazakh',
];

const COLS = 'idx,topic,subtopic,q,o,c,e,passage_group,passage_title,passage_text,type,correct_indices,pairs,difficulty,block,q_kk,o_kk,e_kk,pairs_kk,passage_title_kk,passage_text_kk';
const PAGE = 1000;

async function fetchAll(sid) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('questions')
      .select(COLS)
      .eq('subject', sid)
      .order('idx', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) { console.error(`  Error fetching ${sid} offset ${offset}:`, error.message); break; }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

const PREFIX_RE = /^[А-Га-гA-Da-d]\)\s*/;
function strip(s) { return s.replace(PREFIX_RE, ''); }
function cleanOpts(o) { return o.map(strip); }

function rowToQuestion(row) {
  const qType = row.type || 'single';
  const q = {
    q: row.q,
    o: cleanOpts(row.o),
    c: qType === 'multiple' && row.correct_indices ? row.correct_indices : row.c,
    e: row.e || '',
    _topic: row.topic,
  };
  if (row.subtopic) q._subtopic = row.subtopic;
  if (qType !== 'single') q.type = qType;
  if (row.pairs) q.pairs = row.pairs;
  if (row.difficulty) q.difficulty = row.difficulty;
  if (row.block) q.block = row.block;
  if (row.passage_title) q.pt = row.passage_title;
  if (row.passage_text) q.px = row.passage_text;
  // Kazakh
  if (row.q_kk) q.q_kk = row.q_kk;
  if (row.o_kk) q.o_kk = cleanOpts(row.o_kk);
  if (row.e_kk) q.e_kk = row.e_kk;
  if (row.pairs_kk) q.pairs_kk = row.pairs_kk;
  if (row.passage_title_kk) q.pt_kk = row.passage_title_kk;
  if (row.passage_text_kk) q.px_kk = row.passage_text_kk;
  return q;
}

function buildPassages(rows) {
  const groups = {};
  for (const row of rows) {
    const g = row.passage_group ?? 0;
    if (!groups[g]) {
      groups[g] = {
        t: row.passage_title || '',
        tx: row.passage_text || '',
        qs: [],
        ...(row.passage_title_kk ? { t_kk: row.passage_title_kk } : {}),
        ...(row.passage_text_kk ? { tx_kk: row.passage_text_kk } : {}),
      };
    }
    const q = {
      q: row.q,
      o: cleanOpts(row.o),
      c: row.c,
      e: row.e || '',
      _topic: row.topic,
    };
    if (row.subtopic) q._subtopic = row.subtopic;
    if (row.q_kk) q.q_kk = row.q_kk;
    if (row.o_kk) q.o_kk = cleanOpts(row.o_kk);
    if (row.e_kk) q.e_kk = row.e_kk;
    groups[g].qs.push(q);
  }
  return Object.values(groups);
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const manifest = {};
  console.log('Dumping questions from Supabase to public/data/...\n');

  for (const sid of SUBJECTS) {
    process.stdout.write(`  ${sid}...`);
    const rows = await fetchAll(sid);

    if (rows.length === 0) {
      console.log(' SKIP (0 rows)');
      continue;
    }

    let data;
    if (sid === 'reading') {
      data = buildPassages(rows);
      manifest[sid] = rows.length; // total questions, not passages
    } else {
      data = rows.map(rowToQuestion);
      manifest[sid] = data.length;
    }

    const json = JSON.stringify(data);
    const path = join(OUT_DIR, `${sid}.json`);
    writeFileSync(path, json);
    const kb = Math.round(json.length / 1024);
    console.log(` ${manifest[sid]} questions (${kb} KB)`);
  }

  // Write manifest
  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const total = Object.values(manifest).reduce((s, n) => s + n, 0);
  console.log(`\nDone! ${total} total questions in ${Object.keys(manifest).length} files.`);
  console.log(`Output: ${OUT_DIR}/`);
}

main().catch(err => { console.error(err); process.exit(1); });
