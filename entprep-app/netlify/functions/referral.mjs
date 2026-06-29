// Referral system: issue a referral code, bind an inviter's code at signup, and
// grant the inviter 7 days of Premium when the referee QUALIFIES — exactly once.
//
// This is a NEW free-Premium path, so it is built farm-proof. The whole fraud-
// critical grant — exactly-once per referee, a per-referrer cap, and the premium
// extend — runs in ONE atomic DB transaction (the grant_referral_reward RPC). That
// single transaction is what makes it safe:
//   • Exactly-once (F2): the referee's referrals row is locked FOR UPDATE and its
//     credited flag flipped inside the same tx as the extend. A perceived failure
//     after a server commit is idempotent on retry ('already'); a real failure rolls
//     the whole tx back for a clean retry. No flip-then-separately-rollback window,
//     so the +7 can never double-apply.
//   • Cap (F1): a row-locked per-referrer counter (referral_credits) serializes
//     concurrent grants, so the cap can't be raced past (no read-then-act here).
//   • Referrer identity (C1): taken from the PERSISTENT referrals row, never a code.
//   • Extend: GREATEST(current, now)+7d never clobbers a just-purchased larger expiry
//     and stacks (R2); a paid plan label is preserved.
//
// QUAL is gated in the function (genuinely new account + a server-verified completed
// test). The credit is DEFERRED: an unqualified referee binds and earns nothing until
// they qualify; the client re-attempts bind and the backend credits on the first
// qualifying attempt. The client never decides who gets premium.
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
  // Enforce the code alphabet (A–Z, 0–9) and length, not length alone — mirrors the
  // frontend CODE_RE so malformed codes are rejected before any DB lookup.
  if (!/^[A-Z0-9]{4,32}$/.test(c)) return "Invalid code";
  return null;
}

export function generateReferralCode(len = CODE_LEN) {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function isSelfReferral(referrerId, refereeId) {
  if (!referrerId || !refereeId) return true; // a missing id is never a valid pair
  return referrerId === refereeId;
}

// Qualification part 1: genuinely new signup (anti-farm on reactivated old alts).
// created_at comes from the verified JWT user, so it cannot be forged by the client.
export function isNewAccount(user, nowMs, maxAgeDays = NEW_ACCOUNT_MAX_AGE_DAYS) {
  if (!user || !user.created_at) return false;
  const created = Date.parse(user.created_at);
  if (Number.isNaN(created)) return false;
  return nowMs - created <= maxAgeDays * 24 * 60 * 60 * 1000;
}

// ── Supabase REST helpers ─────────────────────────────────────────────────────

// Qualification part 2: the referee has ≥1 server-verified completed test. The
// leaderboard row is written ONLY by leaderboard.mjs after it RECOMPUTES the score
// from the real questions, and client writes to leaderboard are revoked (see the
// migration), so the row cannot be forged via a direct PostgREST INSERT.
async function hasCompletedTest(userId) {
  const res = await fetch(
    `${sbUrl()}/rest/v1/leaderboard?user_id=eq.${userId}&select=id&limit=1`,
    { headers: sbHeaders() },
  );
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

// The entire fraud-critical grant in one atomic transaction (see the RPC in the
// migration). Returns { result: 'granted'|'already'|'capped'|'no_binding', premium_until }.
async function grantReferralReward(refereeId) {
  const res = await fetch(`${sbUrl()}/rest/v1/rpc/grant_referral_reward`, {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify({ p_referee: refereeId, p_days: REFERRAL_DAYS, p_cap: REFERRAL_CAP }),
  });
  if (!res.ok) throw new Error("grant rpc failed: " + (await res.text()));
  const rows = await res.json();
  return (Array.isArray(rows) ? rows[0] : rows) || { result: "no_binding" };
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

  // No self-referral (app guard; DB CHECK referrals_no_self_referral is the backstop).
  if (isSelfReferral(codeReferrerId, refereeId)) {
    return Response.json({ error: "self_referral" }, { status: 400, headers: CORS_HEADERS });
  }

  // Bind — idempotent via UNIQUE(referee_id). The FIRST binding wins; a 23505/409
  // means "already bound" (possibly to a different referrer) → fall through. The
  // grant always follows the PERSISTENT binding (resolved inside the RPC), not this code.
  const bindRes = await fetch(`${sbUrl()}/rest/v1/referrals`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({ referrer_id: codeReferrerId, referee_id: refereeId, credited: false }),
  });
  if (!bindRes.ok) {
    const txt = await bindRes.text();
    if (!isDuplicatePaymentResponse(bindRes.status, txt)) throw new Error("bind failed: " + txt);
  }

  // QUAL — genuinely new referee AND ≥1 server-verified completed test. Deferred:
  // an unqualified referee binds (credited:false) and earns nothing until they qualify.
  const qualified =
    isNewAccount(user, Date.now(), NEW_ACCOUNT_MAX_AGE_DAYS) && (await hasCompletedTest(refereeId));
  if (!qualified) {
    return Response.json({ ok: true, qualified: false, credited: false }, { headers: CORS_HEADERS });
  }

  // Atomic grant: exactly-once + per-referrer cap + extend, all in one transaction.
  const { result } = await grantReferralReward(refereeId);
  if (result === "granted") {
    return Response.json({ ok: true, qualified: true, credited: true }, { headers: CORS_HEADERS });
  }
  if (result === "already") {
    return Response.json({ ok: true, credited: true, alreadyCredited: true }, { headers: CORS_HEADERS });
  }
  if (result === "capped") {
    return Response.json({ ok: true, capped: true, credited: false }, { headers: CORS_HEADERS });
  }
  // 'no_binding' should be impossible (we just bound); surface as a server error.
  throw new Error("grant returned unexpected result: " + result);
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
