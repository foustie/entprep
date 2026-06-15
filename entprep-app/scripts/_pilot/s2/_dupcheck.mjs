import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '..', '..', '..', '.env'), 'utf8');
env.split('\n').forEach(l => { const [k, ...v] = l.split('='); if (k && !k.trim().startsWith('#') && v.length) process.env[k.trim()] = v.join('=').trim(); });
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
for (const subj of ['chemistry', 'geography', 'english', 'literature']) {
  const out = []; let off = 0;
  while (true) { const { data } = await sb.from('questions').select('q').eq('subject', subj).eq('source', 'ai_gen_s2_2026-06').range(off, off + 999); if (!data || !data.length) break; out.push(...data); if (data.length < 1000) break; off += 1000; }
  const seen = new Map();
  for (const r of out) { const q = (r.q || '').trim().toLowerCase(); seen.set(q, (seen.get(q) || 0) + 1); }
  let dups = 0; const examples = [];
  for (const [q, c] of seen) { if (c > 1) { dups += c - 1; if (examples.length < 4) examples.push(`(${c}x) ${q.slice(0, 75)}`); } }
  console.log(`${subj}: ${out.length} s2 rows, ${seen.size} distinct stems, ${dups} exact-duplicate extra rows`);
  examples.forEach(e => console.log('   ', e));
}
