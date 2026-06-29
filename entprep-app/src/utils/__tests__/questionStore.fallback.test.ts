import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { getPool } from '../questionStore';

// Ф4 / TEST-7: multi-tier fallback (CDN → Supabase → localStorage → static). When the CDN
// tier 404s, getPool must fall through to the localStorage cache (Supabase is null in tests)
// and STILL resolve the active language from the combined rows — the Ф2 clonePool-on-fallback
// path. This proves the fallback chain is alive and the per-language cache key (`sid__lang`)
// did not break it.

const combinedRows = [
  {
    topic: 'org', subtopic: 'alkanes', q: 'RU chem q', o: ['a', 'b', 'c', 'd'], c: 2, e: 'RU e',
    q_kk: 'KK chem q', o_kk: ['а', 'б', 'в', 'г'], e_kk: 'KK e',
  },
];

const realFetch = global.fetch;
beforeEach(() => {
  // Every subject CDN file 404s (ok:false); quarantine returns empty → forces localStorage tier.
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('quarantine')) return { ok: true, json: async () => [] } as Response;
    return { ok: false, json: async () => [] } as Response;
  }) as typeof fetch;
  // Seed the localStorage cache (key entprep_qcache_<sid>) with combined Supabase-shaped rows.
  localStorage.setItem('entprep_qversion', '19');
  localStorage.setItem('entprep_qcache_chemistry', JSON.stringify(combinedRows));
});
afterAll(() => { global.fetch = realFetch; localStorage.clear(); });

describe('getPool — multi-tier fallback after CDN failure (Ф4 / TEST-7)', () => {
  it('falls back to localStorage and serves RU content when the CDN 404s', async () => {
    const pool = await getPool('chemistry');
    expect(pool.length).toBe(1);
    expect(pool[0].q).toBe('RU chem q');
    expect(pool[0].o).toEqual(['a', 'b', 'c', 'd']);
    expect(pool[0].c).toBe(2);
  });

  it('resolves KK content from the same localStorage rows (clonePool on the fallback path)', async () => {
    const pool = await getPool('chemistry', 'kk');
    expect(pool[0].q).toBe('KK chem q');
    expect(pool[0].o).toEqual(['а', 'б', 'в', 'г']);
    expect(pool[0].c).toBe(2); // answer index unchanged across languages
  });
});
