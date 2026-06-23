import { describe, it, expect } from 'vitest';
import { pickSubscription, summarizeSubscription, nonCancelledLiveSubs } from '../lemon-subscription.mjs';

const sub = (status, extra = {}) => ({ id: extra.id || '1', attributes: { status, ...extra } });

describe('pickSubscription', () => {
  it('returns null for an empty / nullish list', () => {
    expect(pickSubscription([])).toBeNull();
    expect(pickSubscription(undefined)).toBeNull();
  });

  it('ignores fully-expired subscriptions', () => {
    expect(pickSubscription([sub('expired')])).toBeNull();
  });

  it('prefers a still-renewing (not cancelled) sub over a cancelled one', () => {
    const picked = pickSubscription([
      sub('cancelled', { id: 'c', cancelled: true }),
      sub('active', { id: 'a' }),
    ]);
    expect(picked.id).toBe('a');
  });

  it('treats status=active + cancelled:true as not the renewing one', () => {
    const picked = pickSubscription([
      sub('active', { id: 'pendingCancel', cancelled: true }),
      sub('active', { id: 'live', cancelled: false }),
    ]);
    expect(picked.id).toBe('live');
  });

  it('falls back to a cancelled-but-live sub when none are renewing', () => {
    const picked = pickSubscription([sub('cancelled', { id: 'c', cancelled: true })]);
    expect(picked.id).toBe('c');
  });

  it('accepts on_trial / past_due / paused as live', () => {
    expect(pickSubscription([sub('on_trial', { id: 't' })]).id).toBe('t');
    expect(pickSubscription([sub('past_due', { id: 'p' })]).id).toBe('p');
    expect(pickSubscription([sub('paused', { id: 'z' })]).id).toBe('z');
  });

  it('prefers a healthy active sub over a stale past_due / unpaid one (any list order)', () => {
    expect(pickSubscription([sub('past_due', { id: 'pd' }), sub('active', { id: 'ok' })]).id).toBe('ok');
    expect(pickSubscription([sub('active', { id: 'ok' }), sub('unpaid', { id: 'up' })]).id).toBe('ok');
    expect(pickSubscription([sub('paused', { id: 'pz' }), sub('on_trial', { id: 'tr' })]).id).toBe('tr');
  });
});

describe('nonCancelledLiveSubs', () => {
  it('returns only still-billing subs (excludes cancelled, pending-cancel, expired)', () => {
    const list = [
      sub('active', { id: 'a' }),
      sub('past_due', { id: 'b' }),
      sub('cancelled', { id: 'c', cancelled: true }),
      sub('active', { id: 'd', cancelled: true }), // pending cancel
      sub('expired', { id: 'e' }),
    ];
    expect(nonCancelledLiveSubs(list).map(s => s.id)).toEqual(['a', 'b']);
  });

  it('is empty for a nullish list', () => {
    expect(nonCancelledLiveSubs(undefined)).toEqual([]);
  });
});

describe('summarizeSubscription', () => {
  it('maps an active subscription (not cancelled)', () => {
    const s = summarizeSubscription(sub('active', {
      renews_at: '2026-07-24T00:00:00Z', ends_at: null,
      card_brand: 'visa', card_last_four: '4242',
    }));
    expect(s).toMatchObject({
      status: 'active', cancelled: false,
      renewsAt: '2026-07-24T00:00:00Z', endsAt: null,
      cardBrand: 'visa', cardLast4: '4242',
    });
  });

  it('flags a cancelled subscription and surfaces ends_at', () => {
    const s = summarizeSubscription(sub('cancelled', { cancelled: true, ends_at: '2026-07-24T00:00:00Z' }));
    expect(s.cancelled).toBe(true);
    expect(s.endsAt).toBe('2026-07-24T00:00:00Z');
  });

  it('treats cancelled:true even when status has not flipped yet', () => {
    const s = summarizeSubscription(sub('on_trial', { cancelled: true }));
    expect(s.cancelled).toBe(true);
  });

  it('degrades gracefully on missing attributes', () => {
    expect(summarizeSubscription({})).toMatchObject({ status: null, cancelled: false, renewsAt: null, endsAt: null });
    expect(summarizeSubscription(null)).toMatchObject({ status: null, cancelled: false });
  });
});
