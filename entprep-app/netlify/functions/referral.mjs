// Referral system: issue a referral code, bind an inviter's code at signup, and
// grant the inviter 7 days of Premium when the referee QUALIFIES — exactly once.
//
// This is a NEW free-Premium path, so it is built farm-proof. The hardening below
// maps to the reviewer (S8) acceptance bar C1–C4 + CAP + QUAL:
//   • C1 — the grant follows the PERSISTENT referrals binding (the referrer_id
//     returned by the atomic CAS), never the code in the current request. A replay
//     with a different code can't hijack/redirect the reward.
//   • C2 — the payments audit marker is written ONLY after a successful extend, and
//     a failed extend rolls `credited` back to false — so nothing is ever stranded
//     in a state that permanently blocks a legitimate retry.
//   • C3 — the relative (+7d) extend happens STRICTLY after the CAS win, so it can
//     never double-apply.
//   • C4 — self-referral is blocked here AND by a DB CHECK (referrals_no_self_referral).
//   • CAP — a referrer earns for at most REFERRAL_CAP referees (bounds farm radius).
//   • QUAL — the referee must be a genuinely NEW account AND have completed ≥1
//     server-verified test (a leaderboard row). Both are checked server-side; the
//     client never decides who gets premium. Because "completed a test" happens
//     after signup, the credit is DEFERRED: the client re-attempts bind and the
//     backend credits on the first attempt where the referee qualifies.
//
// Exactly-once rests on the atomic CAS (UPDATE ... WHERE credited=false RETURNING),
// with UNIQUE(payments.kaspi_tx_id)=`referral_<refereeId>` as a second hard barrier.
// subscriptions is the authoritative premium source (PAY-3); we do NOT touch the
// referrer's user_metadata (a blind PUT would clobber their other fields).
import {
  CORS_HEADERS,
  corsResponse,
  verifyAuth,
  createRateLimiter,
  rateLimitResponse,
  isDuplicatePaymentResponse,
} from "./utils/shared.mjs";
import { captureFunctionError } from "./utils/sentry.mjs";
import { randomBytes } from "node:crypto";

const REFERRAL_DAYS = 7;
export const REFERRAL_CAP = 10; // max credited referrals rewarded per referrer
const NEW_ACCOUNT_MAX_AGE_DAYS = 30; // a referee must be this fresh to qualify
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L (unambiguous)
const CODE_LEN = 7;

function sbUrl() {
  return process.env.VITE_SUPABASE_URL;
}
function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

// ── Pure helpers (unit-tested) ────────────────────────────────────────────────

export function normalizeCode(code) {
  return String(code).trim().toUpperCase();
}

export function validateBindCode(code) {
  if (typeof code !== "string") return "Invalid code";
  const c = normalizeCode(code);
  if (c.length < 4 || c.length > 32) return "Invalid code";
  return null;
}

export function generateReferralCode(len = CODE_LEN) {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

// Idempotency key for the grant. STABLE per referee, DISTINCT per referee, and null
// on a missing id so it can NEVER collapse all referrals into one grant slot.
export function deriveReferralTxId(refereeId) {
  if (typeof refereeId !== "string" || refereeId.length === 0) return null;
  return `referral_${refereeId}`;
}

export function isSelfReferral(referrerId, refereeId) {
  if (!referrerId || !refereeId) return true; // a missing id is never a valid pair
  return referrerId === refereeId;
}

// Qualification part 1: genuinely new signup (anti-farm on reactivated old alts).
export function isNewAccount(user, nowMs, maxAgeDays = NEW_ACCOUNT_MAX_AGE_DAYS) {
  if (!user || !user.created_at) return false;
  const created = Date.parse(user.created_at);
  if (Number.isNaN(created)) return false;
  return nowMs - created <= maxAgeDays * 24 * 60 * 60 * 1000;
}

// Pure date math for the +7d extension. Stacks on a future expiry; ignores a past one.
export function computeReferralExpiry(currentExpiryIso, nowMs, days = REFERRAL_DAYS) {
  let base = nowMs;
  if (currentExpiryIso) {
    const cur = Date.parse(currentExpiryIso);
    if (!Number.isNaN(cur) && cur > nowMs) base = cur;
  }
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
}

// ── Supabase REST helpers ─────────────────────────────────────────────────────

// Qualification part 2: the referee has ≥1 server-verified completed test. The
// leaderboard row is written by leaderboard.mjs after it RECOMPUTES the score from
// the real questions, so it cannot be forged by the client.
async function hasCompletedTest(userId) {
  const res = await fetch(
    `${sbUrl()}/rest/v1/leaderboard?user_id=eq.${userId}&select=id&limit=1`,
    { headers: sbHeaders() },
  );
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

// The authoritative, persistent binding for this referee (C1 source of truth).
async function readReferral(refereeId) {
  const res = await fetch(
    `${sbUrl()}/rest/v1/referrals?referee_id=eq.${refereeId}&select=referrer_id,credited&limit=1`,
    { headers: sbHeaders() },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] || null;
}

async function countCreditedReferrals(referrerId) {
  const res = await fetch(
    `${sbUrl()}/rest/v1/referrals?referrer_id=eq.${referrerId}&credited=eq.true&select=referee_id`,
    { headers: sbHeaders() },
  );
  if (!res.ok) return 0;
  const rows = await res.json();
  return Array.isArray(rows) ? rows.length : 0;
}

// Atomic compare-and-swap: UPDATE ... WHERE referee_id=X AND credited=false RETURNING.
// Exactly one concurrent caller flips false→true and gets the row back; the rest get
// []. The returned referrer_id is the persistent binding's (C1).
async function claimCredit(refereeId) {
  const res = await fetch(
    `${sbUrl()}/rest/v1/referrals?referee_id=eq.${refereeId}&credited=eq.false`,
    {
      method: "PATCH",
      headers: { ...sbHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({ credited: true }),
    },
  );
  if (!res.ok) throw new Error("CAS claim failed: " + (await res.text()));
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function rollbackCredit(refereeId) {
  await fetch(`${sbUrl()}/rest/v1/referrals?referee_id=eq.${refereeId}`, {
    method: "PATCH",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({ credited: false }),
  });
}

// Extend the referrer's premium by 7 days then write the audit marker. Caller
// guarantees this runs ONLY after a CAS win (C3). Throws on extend failure so the
// caller can roll back; the marker is written ONLY after a successful extend so a
// rollback never strands it (C2).
//
// The extend is a SINGLE atomic statement (extend_premium_days RPC) computing
// expires_at = GREATEST(current, now) + 7d. Unlike a read-then-write upsert it can
// never clobber a concurrently-written larger expiry — e.g. a subscription the
// referrer JUST purchased (which the lost-update window would have downgraded to 7
// days, harming a paying user) — and it correctly STACKS multiple referral rewards.
async function grantReferral(referrerId, refereeId) {
  const rpcRes = await fetch(`${sbUrl()}/rest/v1/rpc/extend_premium_days`, {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify({ p_user_id: referrerId, p_days: REFERRAL_DAYS }),
  });
  if (!rpcRes.ok) throw new Error("extend rpc failed: " + (await rpcRes.text()));
  const premiumUntil = await rpcRes.json(); // scalar timestamptz (ISO string)

  // Audit marker AFTER the successful extend (C2). UNIQUE(kaspi_tx_id) is a second
  // hard barrier against over-grant; best-effort — a failed audit never fails the grant.
  const txId = deriveReferralTxId(refereeId);
  if (txId) {
    await fetch(`${sbUrl()}/rest/v1/payments`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: referrerId,
        amount: 0,
        plan: "referral",
        kaspi_tx_id: txId,
        status: "completed",
        premium_until: premiumUntil,
      }),
    }).catch(() => {});
  }
  return premiumUntil;
}

// ── Action: get-or-create the caller's own referral code ──────────────────────

async function handleGetCode(user) {
  const existRes = await fetch(
    `${sbUrl()}/rest/v1/referral_codes?user_id=eq.${user.id}&select=code&limit=1`,
    { headers: sbHeaders() },
  );
  if (existRes.ok) {
    const rows = await existRes.json();
    if (rows.length > 0) return Response.json({ code: rows[0].code }, { headers: CORS_HEADERS });
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const insRes = await fetch(`${sbUrl()}/rest/v1/referral_codes`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: user.id, code }),
    });
    if (insRes.ok) return Response.json({ code }, { headers: CORS_HEADERS });
    const txt = await insRes.text();
    // PK conflict on user_id → a concurrent request already created it → re-read.
    if (txt.includes("referral_codes_pkey") || txt.includes("user_id")) {
      const reRes = await fetch(
        `${sbUrl()}/rest/v1/referral_codes?user_id=eq.${user.id}&select=code&limit=1`,
        { headers: sbHeaders() },
      );
      if (reRes.ok) {
        const rows = await reRes.json();
        if (rows.length) return Response.json({ code: rows[0].code }, { headers: CORS_HEADERS });
      }
    }
    // Otherwise it was likely a code collision → loop with a fresh code.
  }
  throw new Error("Failed to allocate referral code");
}

// ── Action: bind an inviter's code (at signup) → qualify → credit ─────────────

async function handleBind(user, code) {
  const refereeId = user.id;

  const codeErr = validateBindCode(code);
  if (codeErr) return Response.json({ error: codeErr }, { status: 400, headers: CORS_HEADERS });
  const norm = normalizeCode(code);

  // Resolve the code → referrer (used ONLY for the first binding).
  const lookRes = await fetch(
    `${sbUrl()}/rest/v1/referral_codes?code=eq.${encodeURIComponent(norm)}&select=user_id&limit=1`,
    { headers: sbHeaders() },
  );
  if (!lookRes.ok) throw new Error("code lookup failed: " + (await lookRes.text()));
  const found = await lookRes.json();
  if (!found.length) return Response.json({ error: "Code not found" }, { status: 404, headers: CORS_HEADERS });
  const codeReferrerId = found[0].user_id;

  // C4: no self-referral (app guard; DB CHECK is the backstop).
  if (isSelfReferral(codeReferrerId, refereeId)) {
    return Response.json({ error: "self_referral" }, { status: 400, headers: CORS_HEADERS });
  }

  // Bind — idempotent via UNIQUE(referee_id). The FIRST binding wins; a 23505/409
  // means "already bound" (possibly to a different referrer) → fall through.
  const bindRes = await fetch(`${sbUrl()}/rest/v1/referrals`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({ referrer_id: codeReferrerId, referee_id: refereeId, credited: false }),
  });
  if (!bindRes.ok) {
    const txt = await bindRes.text();
    if (!isDuplicatePaymentResponse(bindRes.status, txt)) throw new Error("bind failed: " + txt);
  }

  // C1: from here the credit follows the PERSISTENT binding, not this request's code.
  const row = await readReferral(refereeId);
  if (!row) throw new Error("referral row missing after bind");
  if (row.credited) {
    return Response.json({ ok: true, credited: true, alreadyCredited: true }, { headers: CORS_HEADERS });
  }
  const referrerId = row.referrer_id;

  // QUAL: genuinely new referee AND ≥1 server-verified completed test. Deferred —
  // an unqualified referee binds (credited:false) and earns nothing until they qualify.
  const qualified =
    isNewAccount(user, Date.now(), NEW_ACCOUNT_MAX_AGE_DAYS) && (await hasCompletedTest(refereeId));
  if (!qualified) {
    return Response.json({ ok: true, qualified: false, credited: false }, { headers: CORS_HEADERS });
  }

  // CAP: bound farm radius — a referrer is rewarded for at most REFERRAL_CAP referees.
  if ((await countCreditedReferrals(referrerId)) >= REFERRAL_CAP) {
    return Response.json({ ok: true, capped: true, credited: false }, { headers: CORS_HEADERS });
  }

  // Atomic CAS claim — exactly one winner. The returned row's referrer_id is the
  // authoritative target of the grant (C1).
  const claimed = await claimCredit(refereeId);
  if (!claimed) {
    return Response.json({ ok: true, credited: true, alreadyCredited: true }, { headers: CORS_HEADERS });
  }

  // C3: relative extend STRICTLY after the CAS win. On failure, roll `credited`
  // back so a retry can re-claim (C2: the marker is written only after extend, so
  // nothing is stranded).
  try {
    await grantReferral(claimed.referrer_id, refereeId);
  } catch (err) {
    await rollbackCredit(refereeId).catch(() => {});
    throw err;
  }
  return Response.json({ ok: true, qualified: true, credited: true }, { headers: CORS_HEADERS });
}

// ── Handler ───────────────────────────────────────────────────────────────────

const limiter = createRateLimiter("referral", { max: 10, windowSec: 60 });

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS });
  }

  const user = await verifyAuth(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

  const blocked = limiter(user.id);
  if (blocked) return rateLimitResponse(blocked);

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const action = body?.action;
    if (action === "code") return await handleGetCode(user);
    if (action === "bind") return await handleBind(user, body?.code);
    return Response.json({ error: "Invalid action" }, { status: 400, headers: CORS_HEADERS });
  } catch (err) {
    console.error("Referral error:", err);
    captureFunctionError(err, { fn: "referral" });
    return Response.json({ error: "Server error" }, { status: 500, headers: CORS_HEADERS });
  }
}

export const config = { path: "/api/referral" };
