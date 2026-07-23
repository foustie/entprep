import { describe, it, expect, vi, beforeEach } from 'vitest';

// QLI-1 regression: a profile section's "single" block (count 25) filters by type
// 'single', and context questions ARE type 'single' (they carry block='context' + a
// passage). The "context" block (count 5) then re-selected from block==='context'
// with no exclusion of questions already chosen, so the same context question could
// land in BOTH blocks — a duplicate inside one 40-question section. The fix excludes
// already-picked questions (by _oi) from every block's candidates.

vi.mock('../questionStore', () => ({ getPool: vi.fn(), resolveLiteratureCdnSid: vi.fn(() => 'literature_russian') }));

import { assembleProfileSection } from '../questionAssembler';
import { getPool } from '../questionStore';
import { PROFILE_BLOCKS } from '../../config/ent';
import type { Question } from '../../types/index';

const mk = (oi: number, extra: Partial<Question>): Question =>
  ({ _oi: oi, q: `q${oi}`, o: ['a', 'b', 'c', 'd'], c: 0, e: 'e', ...extra } as Question);

// 5 context questions (type 'single' + block 'context') placed FIRST so the single
// block greedily grabs them, then 40 plain single questions for the remaining slots.
const pool: Question[] = [
  ...Array.from({ length: 5 }, (_, i) => mk(i, { block: 'context', pt: 'P', px: 'passage body' })),
  ...Array.from({ length: 40 }, (_, i) => mk(5 + i, {})),
];

beforeEach(() => {
  (getPool as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(pool);
});

describe('assembleProfileSection — cross-block dedup (QLI-1)', () => {
  it('never places the same question in two blocks of one profile section', async () => {
    const section = await assembleProfileSection('x', PROFILE_BLOCKS, false);
    const ois = section.map(q => q._oi);
    expect(new Set(ois).size).toBe(ois.length); // no duplicate _oi
  });

  it('still fills the full 40-question section', async () => {
    const total = PROFILE_BLOCKS.reduce((s, b) => s + b.count, 0);
    const section = await assembleProfileSection('x', PROFILE_BLOCKS, false);
    expect(section.length).toBe(total);
  });
});
