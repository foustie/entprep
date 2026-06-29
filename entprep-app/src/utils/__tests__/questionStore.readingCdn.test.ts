import { describe, it, expect, afterAll, vi } from 'vitest';
import { getPool, getPassages } from '../questionStore';

// PERF-2 / DEFECT B regression: reading.<lang>.json is passage-shape ([{t,tx,qs}]), not
// flat rows. The CDN tier must consume it DIRECTLY; the old flat-normalize path called
// cleanOptions(row.o) with row.o === undefined → TypeError → reading silently dropped to
// the Supabase tier, so the language-split saving never reached reading (a PERF in-scope
// subject). This mock feeds REAL passage-shape data — the unique titles prove the CDN
// passage path was used (a crash-to-fallback would yield the bundled static reading data,
// never these strings). The pre-existing questionStore.passages.test.ts mocks FLAT rows
// and so never exercised this path.

const readingPassagesRu = [
  {
    t: 'MOCK Passage One', tx: 'Body of passage one.',
    qs: [
      { q: 'P1 Q1?', o: ['a1', 'b1', 'c1', 'd1'], c: 2, e: 'e1', _topic: 'reading' },
      { q: 'P1 Q2?', o: ['a2', 'b2', 'c2', 'd2'], c: 0, e: 'e2', _topic: 'reading' },
    ],
  },
  {
    t: 'MOCK Passage Two', tx: 'Body of passage two.',
    qs: [
      { q: 'P2 Q1?', o: ['x', 'y', 'z', 'w'], c: 1, e: 'e3', _topic: 'reading' },
    ],
  },
];

const realFetch = global.fetch;
global.fetch = vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('quarantine')) return { ok: true, json: async () => [] } as Response;
  if (url.endsWith('/data/reading.ru.json')) return { ok: true, json: async () => readingPassagesRu } as Response;
  return { ok: false, json: async () => [] } as Response;
}) as typeof fetch;
afterAll(() => { global.fetch = realFetch; });

describe('getPool reading — passage-shape CDN consumption (DEFECT B)', () => {
  it('builds the flat pool from passage-shape reading.ru.json instead of crashing to fallback', async () => {
    const pool = await getPool('reading');
    expect(pool.length).toBe(3); // 2 + 1 questions
    // Content from the mock proves the CDN passage path was used (not static fallback).
    expect(pool[0].pt).toBe('MOCK Passage One');
    expect(pool[0].px).toBe('Body of passage one.');
    expect(pool[0].o).toEqual(['a1', 'b1', 'c1', 'd1']);
    expect(pool[0].c).toBe(2); // answer index carried verbatim
  });

  it('assigns _oi = passageIndex*5 + questionIndex (stable across the split)', async () => {
    const pool = await getPool('reading');
    expect(pool[0]._oi).toBe(0); // p0 q0
    expect(pool[1]._oi).toBe(1); // p0 q1
    expect(pool[2]._oi).toBe(5); // p1 q0
  });

  it('getPassages returns the passage-shaped data', async () => {
    const passages = await getPassages();
    expect(passages.length).toBe(2);
    expect(passages[0].t).toBe('MOCK Passage One');
    expect(passages[0].qs.length).toBe(2);
  });
});
