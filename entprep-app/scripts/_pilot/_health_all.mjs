// Whole-bank health check. Read-only. For each subject: count, idx min/max,
// null-idx count, duplicate-idx count, and a contiguity gap estimate.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '..', '..', '.env'), 'utf8');
env.split('\n').forEach(l => { const [k, ...v] = l.split('='); if (k && !k.trim().startsWith('#') && v.length) process.env[k.trim()] = v.join('=').trim(); });
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const subjects = ['math','reading','history','math_profile','physics','biology','chemistry','geography','english','world_history','informatics','law','literature'];

async function rows(subject) {
  const out = []; let off = 0; const P = 1000;
  while (true) {
    const { data, error } = await sb.from('questions').select('idx,type,q,o,c,q_kk,passage_group').eq('subject', subject).range(off, off + P - 1);
    if (error) throw new Error(subject + ': ' + error.message);
    if (!data || !data.length) break;
    out.push(...data); if (data.length < P) break; off += P;
  }
  return out;
}

console.log('subject'.padEnd(15), 'count'.padStart(6), 'idxMin'.padStart(7), 'idxMax'.padStart(7), 'nullIdx'.padStart(8), 'dupIdx'.padStart(7), 'badStruct'.padStart(10), 'noKK'.padStart(6));
let total = 0;
for (const s of subjects) {
  const r = await rows(s); total += r.length;
  const nn = r.filter(x => typeof x.idx === 'number').map(x => x.idx);
  const nulls = r.length - nn.length;
  const counts = {}; for (const i of nn) counts[i] = (counts[i] || 0) + 1;
  const dupIdx = Object.values(counts).filter(c => c > 1).reduce((a, c) => a + c, 0);
  const min = nn.length ? Math.min(...nn) : null, max = nn.length ? Math.max(...nn) : null;
  // structural sanity (single type): 4 options, c in 0..3
  const badStruct = r.filter(x => (x.type || 'single') === 'single' && (!Array.isArray(x.o) || x.o.length !== 4 || !Number.isInteger(x.c) || x.c < 0 || x.c > 3)).length;
  const noKK = r.filter(x => !x.q_kk).length;
  console.log(s.padEnd(15), String(r.length).padStart(6), String(min).padStart(7), String(max).padStart(7), String(nulls).padStart(8), String(dupIdx).padStart(7), String(badStruct).padStart(10), String(noKK).padStart(6));
}
console.log('-'.repeat(78));
console.log('TOTAL'.padEnd(15), String(total).padStart(6));
