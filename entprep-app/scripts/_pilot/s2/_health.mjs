import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '..', '..', '..', '.env'), 'utf8');
env.split('\n').forEach(l => { const [k, ...v] = l.split('='); if (k && !k.trim().startsWith('#') && v.length) process.env[k.trim()] = v.join('=').trim(); });
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

for (const subj of ['literature', 'chemistry', 'geography', 'english']) {
  const rows = []; let off = 0;
  while (true) { const { data, error } = await sb.from('questions').select('idx, source').eq('subject', subj).range(off, off + 999); if (error) { console.error(subj, error.message); break; } if (!data || !data.length) break; rows.push(...data); if (data.length < 1000) break; off += 1000; }
  const idxs = rows.map(r => r.idx).filter(i => i !== null && i !== undefined);
  const nulls = rows.length - idxs.length;
  const sorted = [...idxs].sort((a, b) => a - b);
  const uniq = new Set(idxs);
  const dups = idxs.length - uniq.size;
  // count gaps in idx sequence
  let gaps = 0;
  if (sorted.length) { for (let i = sorted[0]; i <= sorted[sorted.length - 1]; i++) if (!uniq.has(i)) gaps++; }
  const s2 = rows.filter(r => r.source === 'ai_gen_s2_2026-06').length;
  const otherGen = rows.filter(r => r.source === 'ai_gen_2026-06').length;
  console.log(`${subj.padEnd(11)} total=${String(rows.length).padStart(5)}  idx[min..max]=${sorted.length ? sorted[0] : '-'}..${sorted.length ? sorted[sorted.length - 1] : '-'}  nullIdx=${nulls}  dupIdx=${dups}  gaps=${gaps}  s2src=${s2}  otherGenSrc=${otherGen}`);
}
