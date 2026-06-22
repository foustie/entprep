import { describe, it, expect } from 'vitest';
import { emailMatches, lemonTxId } from '../lemon-reconcile.mjs';

describe('emailMatches (PAY-1: bind self-reconcile to the payer)', () => {
  it('matches identical emails', () => {
    expect(emailMatches('a@b.com', 'a@b.com')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(emailMatches('A@B.COM', 'a@b.com')).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    expect(emailMatches('  a@b.com ', 'a@b.com')).toBe(true);
  });

  it('rejects different emails', () => {
    expect(emailMatches('attacker@evil.com', 'victim@b.com')).toBe(false);
  });

  it('never treats two blanks as a match', () => {
    expect(emailMatches('', '')).toBe(false);
    expect(emailMatches('   ', '   ')).toBe(false);
  });

  it('rejects non-string / nullish inputs', () => {
    expect(emailMatches(undefined, 'a@b.com')).toBe(false);
    expect(emailMatches('a@b.com', null)).toBe(false);
    expect(emailMatches(undefined, undefined)).toBe(false);
    expect(emailMatches(123, 123)).toBe(false);
  });
});

describe('lemonTxId (PAY-1: canonical tx id collides with webhook)', () => {
  it('produces the same prefix the webhook uses (lemon_<id>)', () => {
    // lemon-webhook.mjs builds `lemon_${body.data.id}` — reconcile must match
    // so payments.kaspi_tx_id collides and one order is granted at most once.
    expect(lemonTxId('12345')).toBe('lemon_12345');
  });

  it('coerces numeric ids', () => {
    expect(lemonTxId(12345)).toBe('lemon_12345');
  });

  it('no longer uses the divergent lemon_reconcile_ prefix', () => {
    expect(lemonTxId('999')).not.toContain('reconcile');
  });
});
