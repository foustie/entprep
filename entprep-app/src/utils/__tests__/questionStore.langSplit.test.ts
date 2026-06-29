import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { getPool } from '../questionStore';

// PERF-2 regression: the CDN is language-split, so a RU session must fetch ONLY
// <sid>.ru.json and never download the KK half (and vice-versa). The `literature`
// alias must still resolve to literature_russian. This is the core "RU does not
// download Kazakh" guarantee S2 gates Phase 2 on.

// Realistic split files: ru.json has RU content (no _kk fields); kk.json has KK baked in.
const mathRu = [{ q: 'RU вопрос', o: ['a', 'b', 'c', 'd'], c: 1, e: 'RU объяснение', _topic: 'algebra' }];
const mathKk = [{ q: 'KK сұрақ', o: ['a', 'b', 'c', 'd'], c: 1, e: 'KK түсіндірме', _topic: 'algebra' }];

const requested: string[] = [];
const realFetch = global.fetch;
global.fetch = vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  requested.push(url);
  if (url.includes('quarantine')) return { ok: true, json: async () => [] } as Response;
  if (url.endsWith('/data/math.ru.json')) return { ok: true, json: async () => mathRu } as Response;
  if (url.endsWith('/data/math.kk.json')) return { ok: true, json: async () => mathKk } as Response;
  if (url.endsWith('/data/literature_russian.ru.json')) return { ok: true, json: async () => mathRu } as Response;
  return { ok: false, json: async () => [] } as Response;
}) as typeof fetch;
afterAll(() => { global.fetch = realFetch; });

beforeEach(() => { requested.length = 0; });

const subjectUrls = () => requested.filter(u => !u.includes('quarantine'));

describe('getPool — language-split CDN (PERF-2)', () => {
  it('RU session fetches only <sid>.ru.json, never the KK file', async () => {
    const pool = await getPool('math');
    expect(pool[0].q).toBe('RU вопрос');
    const urls = subjectUrls();
    expect(urls.some(u => u.endsWith('/data/math.ru.json'))).toBe(true);
    expect(urls.some(u => u.endsWith('/data/math.kk.json'))).toBe(false);
  });

  it('explicit lang="ru" also fetches only the RU file', async () => {
    const pool = await getPool('math', 'ru');
    expect(pool[0].q).toBe('RU вопрос');
    expect(subjectUrls().some(u => u.endsWith('/data/math.kk.json'))).toBe(false);
  });

  it('KK session fetches the KK file and serves Kazakh content', async () => {
    const pool = await getPool('math', 'kk');
    expect(pool[0].q).toBe('KK сұрақ');
    expect(pool[0].e).toBe('KK түсіндірме');
    expect(subjectUrls().some(u => u.endsWith('/data/math.kk.json'))).toBe(true);
  });

  it('preserves _oi (array index) identically across languages', async () => {
    const ru = await getPool('math', 'ru');
    const kk = await getPool('math', 'kk');
    expect(ru[0]._oi).toBe(0);
    expect(kk[0]._oi).toBe(0);
    expect(ru[0].c).toBe(kk[0].c); // correct-index unchanged
  });

  it('literature alias resolves to literature_russian.ru.json', async () => {
    await getPool('literature');
    expect(subjectUrls().some(u => u.endsWith('/data/literature_russian.ru.json'))).toBe(true);
  });
});
