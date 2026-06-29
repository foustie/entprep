// Referral frontend helper — isolated from App.tsx routing. Two jobs:
//   1. The referrer's "invite a friend" UI (InviteFriend.tsx) gets/creates their code.
//   2. A referee who arrived via a ?ref=<code> link has the code captured at load
//      (main.tsx) and flushed to the backend after sign-in. Because the reward is
//      DEFERRED server-side (the referee must complete a qualifying test first), the
//      pending code is kept and re-attempted until the backend reports a terminal
//      state — the server, never the client, decides if/when premium is granted.
import { supabase } from '../config/supabase';
import { API_BASE } from '../config/app';

const PENDING_KEY = 'entprep_ref_pending';
const CODE_RE = /^[A-Z0-9]{4,32}$/;

export interface BindResult {
  ok?: boolean;
  qualified?: boolean;
  credited?: boolean;
  alreadyCredited?: boolean;
  capped?: boolean;
  error?: string;
}

/**
 * Decide whether a pending referral code is fully resolved (stop retrying it).
 * Pure so it can be unit-tested without the network.
 *  - 400/404 (self-referral, unknown/invalid code) → terminal: it will never succeed.
 *  - credited / alreadyCredited / capped → terminal: the outcome is final.
 *  - qualified:false → NOT resolved: the referee hasn't completed a qualifying test
 *    yet, so keep the code and retry on a later session.
 *  - 5xx / network → NOT resolved: transient, retry later.
 */
export function isReferralResolved(res: BindResult | null, httpStatus: number): boolean {
  if (httpStatus === 400 || httpStatus === 404) return true;
  if (httpStatus < 200 || httpStatus >= 300) return false; // 5xx / transient
  if (!res) return false;
  return !!(res.credited || res.alreadyCredited || res.capped);
}

/** Normalize a raw code from a link (trim, uppercase) and validate its shape. */
export function normalizeIncomingCode(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const c = raw.trim().toUpperCase();
  return CODE_RE.test(c) ? c : null;
}

export function getPendingReferral(): string | null {
  try {
    return localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

export function savePendingReferral(rawCode: string | null | undefined): void {
  const code = normalizeIncomingCode(rawCode);
  if (!code) return;
  try {
    // First link wins — don't overwrite a code already captured.
    if (!localStorage.getItem(PENDING_KEY)) localStorage.setItem(PENDING_KEY, code);
  } catch {
    /* storage unavailable — ignore */
  }
}

export function clearPendingReferral(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Capture a ?ref=<code> from the current URL into pending storage, then strip it
 * from the address bar (mirrors how App.tsx scrubs utm_* params). Safe to call on
 * every load; only the first valid code is kept.
 */
export function captureRefFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('ref');
    if (!raw) return;
    savePendingReferral(raw);
    const url = new URL(window.location.href);
    url.searchParams.delete('ref');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  } catch {
    /* non-fatal */
  }
}

async function authHeader(): Promise<string | null> {
  if (!supabase) return null;
  const session = (await supabase.auth.getSession()).data.session;
  return session?.access_token ? `Bearer ${session.access_token}` : null;
}

/** Get-or-create the signed-in user's own referral code (for the invite UI). */
export async function getReferralCode(): Promise<string> {
  const auth = await authHeader();
  if (!auth) throw new Error('not_authenticated');
  const res = await fetch(`${API_BASE}/api/referral`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({ action: 'code' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.code) throw new Error(data.error || 'code_failed');
  return data.code as string;
}

/** Build the shareable invite link for a code. */
export function buildReferralLink(code: string): string {
  return `https://entprep.org?ref=${encodeURIComponent(code)}`;
}

/**
 * Flush the pending referral code to the backend (called after sign-in). Clears the
 * pending code only when the backend reports a terminal state; otherwise leaves it
 * for a later retry. Never throws — a failed attempt simply retries next session.
 */
export async function flushPendingReferral(): Promise<void> {
  const code = getPendingReferral();
  if (!code) return;
  const auth = await authHeader();
  if (!auth) return; // not signed in yet — try again after sign-in
  try {
    const res = await fetch(`${API_BASE}/api/referral`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ action: 'bind', code }),
    });
    const data: BindResult = await res.json().catch(() => ({}));
    if (isReferralResolved(data, res.status)) clearPendingReferral();
  } catch {
    /* transient — keep pending, retry next session */
  }
}
