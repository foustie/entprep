// Export every question added this effort (by source marker) from the live
// Supabase bank into a /new-questions folder: one JSON per subject, a combined
// file, and a README summary. Read-only against the DB.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, '..', '..');   // entprep-app
const repoRoot = join(appRoot, '..');           // entprep
const env = readFileSync(join(appRoot, '.env'), 'utf8');
env.split('\n').forEach(l => { const [k, ...v] = l.split('='); if (k && !k.trim().startsWith('#') && v.length) process.env[k.trim()] = v.join('=').trim(); });
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const SOURCES = ['ai_gen_2026-06', 'ai_gen_s2_2026-06'];
const subjects = ['math', 'reading', 'history', 'math_profile', 'physics', 'biology', 'chemistry', 'geography', 'english', 'world_history', 'informatics', 'law', 'literature'];
const outDir = join(repoRoot, 'new-questions');
mkdirSync(outDir, { recursive: true });

const cols = 'idx,subject,topic,subtopic,q,o,c,e,q_kk,o_kk,e_kk,pairs,pairs_kk,passage_group,passage_title,passage_text,passage_title_kk,passage_text_kk,type,difficulty,source';

async function fetchSubject(s) {
  const out = []; let off = 0; const P = 1000;
  while (true) {
    const { data, error } = await sb.from('questions').select(cols).eq('subject', s).in('source', SOURCES).order('idx', { ascending: true }).range(off, off + P - 1);
    if (error) throw new Error(s + ': ' + error.message);
    if (!data || !data.length) break;
    out.push(...data); if (data.length < P) break; off += P;
  }
  return out;
}

const summary = []; let total = 0; const combined = [];
console.log('subject'.padEnd(15), 'new');
for (const s of subjects) {
  const rows = await fetchSubject(s);
  if (rows.length) {
    writeFileSync(join(outDir, s + '.json'), JSON.stringify({ subject: s, count: rows.length, sources: SOURCES, questions: rows }, null, 2), 'utf8');
    combined.push(...rows);
  }
  summary.push({ subject: s, count: rows.length });
  total += rows.length;
  console.log(s.padEnd(15), String(rows.length).padStart(5));
}

writeFileSync(join(outDir, 'all-new-questions.json'), JSON.stringify({ total, exported: new Date().toISOString(), sources: SOURCES, questions: combined }, null, 2), 'utf8');

const readme = [
  '# New ENTprep questions — generation effort (June 2026)',
  '',
  `**Total new questions: ${total}**`,
  '',
  'All are original, bilingual (RU + KK), 4-option single-choice (reading = passage groups), each independently re-solved by a verifier and deduped (Jaccard 0.70) before insert. They are live in the Supabase question bank.',
  '',
  `Source markers: \`${SOURCES.join('`, `')}\``,
  '- `ai_gen_2026-06` — math, reading, history, math_profile, physics, biology, chemistry(part), geography(part), world_history, informatics, law, literature(part)',
  '- `ai_gen_s2_2026-06` — literature, chemistry, geography, english (parallel session)',
  '',
  '| Subject | New questions |',
  '|---|--:|',
  ...summary.map(r => `| ${r.subject} | ${r.count} |`),
  `| **TOTAL** | **${total}** |`,
  '',
  '## Files',
  '- `<subject>.json` — new questions for that subject',
  '- `all-new-questions.json` — every new question combined',
  '',
  '## Rollback (if ever needed)',
  '```',
  "DELETE FROM questions WHERE source IN ('ai_gen_2026-06','ai_gen_s2_2026-06');",
  '```',
].join('\n');
writeFileSync(join(outDir, 'README.md'), readme, 'utf8');

console.log('----------------------');
console.log('TOTAL'.padEnd(15), String(total).padStart(5), '->', outDir);
