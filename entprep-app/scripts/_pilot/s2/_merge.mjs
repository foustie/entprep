// Merge per-cluster verified JSON files into one batch for a subject+round.
// Usage: node scripts/_pilot/s2/_merge.mjs <subject> <round>
// Reads s2/<subject>_r<round>_c*.json, writes s2/<subject>_r<round>_all.json
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const subject = process.argv[2];
const round = process.argv[3] || '1';
if (!subject) { console.error('Usage: _merge.mjs <subject> <round>'); process.exit(1); }

const prefix = `${subject}_r${round}_c`;
const files = readdirSync(__dirname).filter(f => f.startsWith(prefix) && f.endsWith('.json')).sort();
let all = [];
for (const f of files) {
  try {
    const data = JSON.parse(readFileSync(join(__dirname, f), 'utf8'));
    const qs = Array.isArray(data) ? data : (data.questions || []);
    all.push(...qs);
    console.log(`  ${f}: ${qs.length}`);
  } catch (e) {
    console.error(`  ${f}: PARSE ERROR ${e.message}`);
  }
}
const out = join(__dirname, `${subject}_r${round}_all.json`);
writeFileSync(out, JSON.stringify({ questions: all }, null, 0), 'utf8');
console.log(`Merged ${all.length} questions from ${files.length} files → ${subject}_r${round}_all.json`);
