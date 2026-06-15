// Sample existing rows for my four subjects to learn the bilingual format.
// Read-only. Reads creds from entprep-app/.env (same as _check_live.mjs).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '..', '..', '.env');
const env = readFileSync(envPath, 'utf8');
env.split('\n').forEach(l => {
  const [k, ...v] = l.split('=');
  if (k && !k.trim().startsWith('#') && v.length) process.env[k.trim()] = v.join('=').trim();
});
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const subject = process.argv[2] || 'english';
const n = parseInt(process.argv[3] || '6', 10);
const { data, error } = await sb.from('questions')
  .select('idx, topic, subtopic, difficulty, q, o, c, e, q_kk, o_kk, e_kk, type')
  .eq('subject', subject)
  .order('idx', { ascending: true })
  .limit(n);
if (error) { console.error(error.message); process.exit(1); }
for (const r of data) {
  console.log('─'.repeat(70));
  console.log(`idx=${r.idx} type=${r.type} topic=${r.topic}/${r.subtopic} diff=${r.difficulty}`);
  console.log('Q   :', r.q);
  console.log('Q_kk:', r.q_kk);
  console.log('O   :', JSON.stringify(r.o));
  console.log('O_kk:', JSON.stringify(r.o_kk));
  console.log('c   :', r.c, '→', r.o[r.c]);
  console.log('E   :', r.e);
  console.log('E_kk:', r.e_kk);
}
console.log('─'.repeat(70));
console.log(`(${data.length} rows of ${subject})`);
