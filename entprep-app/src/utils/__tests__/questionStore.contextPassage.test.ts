import { describe, it, expect, afterAll, vi } from 'vitest';
import { getPool } from '../questionStore';

// Regression: non-reading "context" (reading-comprehension) questions carry their
// passage in the CDN JSON under pt/px (the dump's field names, = the final Question
// fields), but supabaseRowToQuestion read passage_text/passage_title (the Supabase
// column names). For CDN-loaded rows those are undefined → q.px never set → isR=false
// → the passage block is not rendered. Students saw a question referencing a text they
// couldn't see. Reproduces for english (9 context questions) and any non-reading subject.

const englishRows = [
  {
    q: 'Choose the option that fits the text.',
    o: ['a', 'b', 'c', 'd'],
    c: 0,
    e: 'expl',
    _topic: 'reading',
    block: 'context',
    pt: 'Conditionals',
    px: 'If I had known, I would have come — third conditional passage body.',
    pt_kk: 'Шартты сөйлемдер',
    px_kk: 'Қазақша мәтін.',
  },
  { q: 'A plain non-context question.', o: ['a', 'b', 'c', 'd'], c: 1, e: 'e2', _topic: 'grammar' },
];

const realFetch = global.fetch;
global.fetch = vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('quarantine')) return { ok: true, json: async () => [] } as Response;
  if (url.includes('english')) return { ok: true, json: async () => englishRows } as Response;
  return { ok: false, json: async () => [] } as Response;
}) as typeof fetch;
afterAll(() => { global.fetch = realFetch; });

describe('getPool — CDN passage mapping for non-reading context questions', () => {
  it('carries pt/px from the CDN JSON onto the Question (RU)', async () => {
    const pool = await getPool('english');
    const ctx = pool.find(q => q.block === 'context');
    expect(ctx).toBeTruthy();
    expect(ctx!.px).toBe('If I had known, I would have come — third conditional passage body.');
    expect(ctx!.pt).toBe('Conditionals');
  });

  it('resolves the Kazakh passage for lang="kk"', async () => {
    const pool = await getPool('english', 'kk');
    const ctx = pool.find(q => q.block === 'context');
    expect(ctx!.px).toBe('Қазақша мәтін.');
    expect(ctx!.pt).toBe('Шартты сөйлемдер');
  });
});
