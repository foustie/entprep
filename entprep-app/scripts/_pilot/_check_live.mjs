// One-off connectivity + schema + count probe for the live Supabase question bank.
// Reads creds from entprep-app/.env. Read-only.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '..', '.env');
try {
  const env = readFileSync(envPath, 'utf8');
  env.split('\n').forEach(l => {
    const [k, ...v] = l.split('=');
    if (k && !k.trim().startsWith('#') && v.length) process.env[k.trim()] = v.join('=').trim();
  });
} catch (e) {
  console.error('Could not read .env at', envPath, '-', e.message);
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const sb = createClient(url, key, { auth: { persistSession: false } });

const subjects = ['math','reading','history','math_profile','physics','biology','chemistry','geography','english','world_history','informatics','law','literature'];

let total = 0;
console.log('subject          count');
for (const s of subjects) {
  const { count, error } = await sb.from('questions').select('*', { count: 'exact', head: true }).eq('subject', s);
  if (error) { console.error(s.padEnd(16), 'ERROR', error.message); continue; }
  const c = count || 0; total += c;
  console.log(s.padEnd(16), String(c).padStart(6));
}
console.log('----------------------');
console.log('TOTAL'.padEnd(16), String(total).padStart(6));

const { data, error } = await sb.from('questions').select('*').eq('subject', 'biology').limit(1);
if (error) console.error('\nsample fetch error:', error.message);
else if (data && data[0]) console.log('\nquestions columns:', Object.keys(data[0]).sort().join(', '));
else console.log('\n(no biology rows to sample)');
