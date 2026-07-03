import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isReferralResolved,
  normalizeIncomingCode,
  getPendingReferral,
  savePendingReferral,
  clearPendingReferral,
  captureRefFromUrl,
  buildReferralLink,
} from '../referralHelpers';

// ── isReferralResolved — the deferred-retry decision (the tricky bit) ──────────
describe('isReferralResolved', () => {
  it('treats a self-referral / bad code (400) as terminal — never retried', () => {
    expect(isReferralResolved({ error: 'self_referral' }, 400)).toBe(true);
  });
  it('treats an unknown code (404) as terminal', () => {
    expect(isReferralResolved({ error: 'Code not found' }, 404)).toBe(true);
  });
  it('resolves once the referrer is credited / already credited / capped', () => {
    expect(isReferralResolved({ ok: true, credited: true }, 200)).toBe(true);
    expect(isReferralResolved({ ok: true, alreadyCredited: true }, 200)).toBe(true);
    expect(isReferralResolved({ ok: true, capped: true }, 200)).toBe(true);
  });
  it('does NOT resolve while the referee is unqualified (keep retrying after a test)', () => {
    expect(isReferralResolved({ ok: true, qualified: false, credited: false }, 200)).toBe(false);
  });
  it('does NOT resolve on a transient 5xx / empty body (retry next session)', () => {
    expect(isReferralResolved({ error: 'Server error' }, 500)).toBe(false);
    expect(isReferralResolved(null, 503)).toBe(false);
  });
});

// ── normalizeIncomingCode ─────────────────────────────────────────────────────
describe('normalizeIncomingCode', () => {
  it('trims + uppercases a valid code', () => {
    expect(normalizeIncomingCode('  abc23k ')).toBe('ABC23K');
  });
  it('rejects malformed / wrong-length / non-string input', () => {
    expect(normalizeIncomingCode('ab')).toBeNull();          // too short
    expect(normalizeIncomingCode('A'.repeat(40))).toBeNull(); // too long
    expect(normalizeIncomingCode('abc 23')).toBeNull();       // space
    expect(normalizeIncomingCode('abc-23')).toBeNull();       // punctuation
    expect(normalizeIncomingCode(null)).toBeNull();
    expect(normalizeIncomingCode(undefined)).toBeNull();
  });
});

describe('buildReferralLink', () => {
  it('builds an entprep.org link carrying the code', () => {
    expect(buildReferralLink('INVITE7')).toBe('https://entprep.org?ref=INVITE7');
  });
});

// ── pending-code storage ──────────────────────────────────────────────────────
describe('pending referral storage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('saves a valid code and reads it back', () => {
    savePendingReferral('invite7');
    expect(getPendingReferral()).toBe('INVITE7');
  });
  it('ignores a malformed code', () => {
    savePendingReferral('no');
    expect(getPendingReferral()).toBeNull();
  });
  it('keeps the FIRST captured code (does not overwrite)', () => {
    savePendingReferral('FIRST1');
    savePendingReferral('SECOND2');
    expect(getPendingReferral()).toBe('FIRST1');
  });
  it('clears the pending code', () => {
    savePendingReferral('INVITE7');
    clearPendingReferral();
    expect(getPendingReferral()).toBeNull();
  });
});

// ── captureRefFromUrl ─────────────────────────────────────────────────────────
describe('captureRefFromUrl', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });
  afterEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('captures ?ref= into pending storage and strips it from the URL', () => {
    window.history.replaceState({}, '', '/?ref=INVITE7&other=keep');
    captureRefFromUrl();
    expect(getPendingReferral()).toBe('INVITE7');
    expect(window.location.search).not.toContain('ref=');
    expect(window.location.search).toContain('other=keep'); // unrelated params preserved
  });
  it('does nothing when there is no ?ref=', () => {
    window.history.replaceState({}, '', '/?foo=bar');
    captureRefFromUrl();
    expect(getPendingReferral()).toBeNull();
  });
  it('ignores a malformed ?ref= value', () => {
    window.history.replaceState({}, '', '/?ref=x');
    captureRefFromUrl();
    expect(getPendingReferral()).toBeNull();
  });
});
