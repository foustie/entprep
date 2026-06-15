// Inspect idx distribution for a subject to detect NULLs / collisions. Read-only.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '..', '..', '.env'), 'utf8');
env.split('\n').forEach(l => { const [k, ...v] = l.split('='); if (k && !k.trim().startsWith('#') && v.length) process.env[k.trim()] = v.join('=').trim(); });
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const subject = process.argv[2] || 'biology';
const rows = [];
let off = 0; const P = 1000;
while (true) {
  const { data, error } = await sb.from('questions').select('idx,source').eq('subject', subject).range(off, off + P - 1);
  if (error) { console.error(error.message); process.exit(1); }
  if (!data || !data.length) break;
  rows.push(...data); if (data.length < P) break; off += P;
}
const nulls = rows.filter(r => r.idx === null || r.idx === undefined);
const nonNull = rows.filter(r => typeof r.idx === 'number').map(r => r.idx);
const max = nonNull.length ? Math.max(...nonNull) : null;
const min = nonNull.length ? Math.min(...nonNull) : null;
const counts = {}; for (const i of nonNull) counts[i] = (counts[i] || 0) + 1;
const dupIdx = Object.entries(counts).filter(([, c]) => c > 1);
const inLow = nonNull.filter(i => i >= 1 && i <= 24);
console.log(`subject=${subject} total=${rows.length}`);
console.log(`idx: nonNull=${nonNull.length} null=${nulls.length} min=${min} max=${max}`);
console.log(`distinct idx values that repeat (collisions): ${dupIdx.length}`);
if (dupIdx.length) console.log('  e.g.', dupIdx.slice(0, 10).map(([i, c]) => `${i}×${c}`).join(', '));
console.log(`rows with idx in 1..24: ${inLow.length}`);
const bySource = {}; for (const r of rows) bySource[r.source || '(null)'] = (bySource[r.source || '(null)'] || 0) + 1;
console.log('by source:', JSON.stringify(bySource));
