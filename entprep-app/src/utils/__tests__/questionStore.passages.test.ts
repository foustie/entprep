import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getPool, getPassages } from '../questionStore';

// Regression test for TS-5: getPassages(lang) ignored its lang argument, so Kazakh
// reading questions (title, body, question, options, explanation) were served in Russian.
// Also covers o_kk prefix-cleaning (buildPassagesFromRows previously left "А)" prefixes on KK options).

const readingRows = [
  {
    passage_group: 1,
    passage_title: 'Russian Title',
    passage_text: 'Russian passage body.',
    passage_title_kk: 'Қазақша тақырып',
    passage_text_kk: 'Қазақша мәтін.',
    q: 'Russian question?',
    o: ['А) opt-one', 'opt-two', 'opt-three', 'opt-four'],
    c: 0,
    e: 'Russian explanation',
    q_kk: 'Қазақша сұрақ?',
    o_kk: ['А) қаз-бір', 'қаз-екі', 'қаз-үш', 'қаз-төрт'],
    e_kk: 'Қазақша түсіндірме',
  },
];

const realFetch = global.fetch;

beforeAll(async () => {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('quarantine')) {
      return { ok: true, json: async () => [] } as Response;
    }
    if (url.includes('reading')) {
      return { ok: true, json: async () => readingRows } as Response;
    }
    return { ok: false, json: async () => [] } as Response;
  }) as typeof fetch;
  // Populate passageCache via the CDN branch of getPool.
  await getPool('reading');
});

afterAll(() => {
  global.fetch = realFetch;
});

describe('getPassages — language resolution (TS-5)', () => {
  it('serves Russian content by default (no lang)', async () => {
    const [p] = await getPassages();
    expect(p.t).toBe('Russian Title');
    expect(p.tx).toBe('Russian passage body.');
    expect(p.qs[0].q).toBe('Russian question?');
    expect(p.qs[0].e).toBe('Russian explanation');
  });

  it('serves Russian content for lang="ru"', async () => {
    const [p] = await getPassages('ru');
    expect(p.t).toBe('Russian Title');
    expect(p.qs[0].q).toBe('Russian question?');
    expect(p.qs[0].o).toEqual(['opt-one', 'opt-two', 'opt-three', 'opt-four']);
  });

  it('serves Kazakh passage title, body, question, options and explanation for lang="kk"', async () => {
    const [p] = await getPassages('kk');
    expect(p.t).toBe('Қазақша тақырып');
    expect(p.tx).toBe('Қазақша мәтін.');
    expect(p.qs[0].q).toBe('Қазақша сұрақ?');
    expect(p.qs[0].e).toBe('Қазақша түсіндірме');
  });

  it('strips A)/Б) prefixes from Kazakh options (o_kk cleaning)', async () => {
    const [p] = await getPassages('kk');
    expect(p.qs[0].o).toEqual(['қаз-бір', 'қаз-екі', 'қаз-үш', 'қаз-төрт']);
  });

  it('does not mutate the cached Russian passage when serving Kazakh', async () => {
    await getPassages('kk');
    const [ru] = await getPassages('ru');
    expect(ru.t).toBe('Russian Title');
    expect(ru.qs[0].q).toBe('Russian question?');
  });
});
