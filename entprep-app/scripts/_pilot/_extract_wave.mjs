// Transform a completed scale-up workflow output file into per-subject batch JSON
// files ready for ingest-batch.mjs. Usage:
//   node scripts/_pilot/_extract_wave.mjs <path-to-workflow-output-file>
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const src = process.argv[2];
if (!src) { console.error('usage: node _extract_wave.mjs <output-file>'); process.exit(1); }
const __dirname = dirname(fileURLToPath(import.meta.url));

const obj = JSON.parse(readFileSync(src, 'utf8'));
const r0 = obj.result || {};

if (Array.isArray(r0.passages)) {
  // Reading/passage format: { subject, passages: [...] }
  const subject = r0.subject || 'reading';
  const out = { subject, type: 'reading', count: r0.passages.length, passages: r0.passages };
  const path = join(__dirname, `batch.${subject}.json`);
  writeFileSync(path, JSON.stringify(out, null, 2), 'utf8');
  console.log(`${subject.padEnd(15)} wrote ${String(out.count).padStart(4)} passages (${out.count * 5} questions) -> batch.${subject}.json`);
  console.log('\nNext: node scripts/_pilot/ingest-passages.mjs --file=scripts/_pilot/batch.' + subject + '.json --subject=' + subject + ' --source=ai_gen_2026-06 --dry-run');
} else {
  // Single-choice wave format: { results: [{ subject, kept, dropped }] }
  const results = r0.results || [];
  if (!results.length) { console.error('No result.results or result.passages found in output file.'); process.exit(1); }
  for (const r of results) {
    const questions = r.kept || [];
    const out = { subject: r.subject, type: 'wave', count: questions.length, questions };
    const path = join(__dirname, `batch.${r.subject}.json`);
    writeFileSync(path, JSON.stringify(out, null, 2), 'utf8');
    console.log(`${r.subject.padEnd(15)} wrote ${String(out.count).padStart(4)} questions -> batch.${r.subject}.json  (dropped ${r.dropped || 0})`);
  }
  console.log('\nNext: for each subject run');
  console.log('  node scripts/_pilot/ingest-batch.mjs --file=scripts/_pilot/batch.<subject>.json --subject=<subject> --source=ai_gen_2026-06 --dry-run');
}
