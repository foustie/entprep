// Referral system: issue a referral code, bind an inviter's code at signup, and
// grant the inviter 7 days of Premium when the referee qualifies — EXACTLY ONCE.
//
// SECURITY — this is a NEW free-Premium path, so it must be farm-proof:
//   • No self-referral: the caller (referee) can never be the code owner (referrer)
//     — guarded here AND by a DB CHECK (referrer_id <> referee_id) in the migration.
//   • One reward per referee: UNIQUE(referrals.referee_id) makes binding idempotent.
//   • Exactly-once grant: the 7-day extension is gated by INSERTing a payments row
//     with kaspi_tx_id = `referral_<refereeId>`, UNIQUE(kaspi_tx_id). A replay or a
//     race loses the INSERT (Postgres 23505 / HTTP 409) and grants nothing extra.
//     The subscription is extended ONLY on the winning INSERT, so the *relative*
//     (+7d) extension can never double-apply.
//   • Qualification gate: only a confirmed referee account earns the reward.
//
// The subscriptions table is the authoritative premium source (PAY-3); we do NOT
// touch the referrer's user_metadata (a blind PUT would clobber their other fields).
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

// Idempotency key for the grant. STABLE per referee, DISTINCT per referee, and
// null on a missing id so it can NEVER collapse all referrals into one grant slot
// (the same failure mode deriveRcTxId guards against for webhooks).
export function deriveReferralTxId(refereeId) {
  if (typeof refereeId !== "string" || refereeId.length === 0) return null;
  return `referral_${refereeId}`;
}

export function isSelfReferral(referrerId, refereeId) {
  // A missing id is never a valid (non-self) pairing.
  if (!referrerId || !refereeId) return true;
  return referrerId === refereeId;
}

// Qualification gate: only a confirmed account earns the referrer a reward. OAuth
// signups (Google/Apple — the dominant path) are auto-confirmed; raw unconfirmed
// email signups earn nothing until they confirm. Swappable for a stricter gate
// (activity threshold / device / IP throttle) without touching the grant logic.
export function isQualifiedReferee(user) {
  if (!user || typeof user !== "object") return false;
  return !!(user.email_confirmed_at || user.confirmed_at);
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
  // Create — retry a few times to dodge a UNIQUE(code) collision.
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
    // Otherwise it was likely a code collision → loop and try a fresh code.
  }
  throw new Error("Failed to allocate referral code");
}

// ── Action: bind an inviter's code (at referee signup) + qualify + credit ─────

async function handleBind(user, code) {
  const refereeId = user.id;

  const codeErr = validateBindCode(code);
  if (codeErr) return Response.json({ error: codeErr }, { status: 400, headers: CORS_HEADERS });
  const norm = normalizeCode(code);

  // Resolve code → referrer.
  const lookRes = await fetch(
    `${sbUrl()}/rest/v1/referral_codes?code=eq.${encodeURIComponent(norm)}&select=user_id&limit=1`,
    { headers: sbHeaders() },
  );
  if (!lookRes.ok) throw new Error("code lookup failed: " + (await lookRes.text()));
  const found = await lookRes.json();
  if (!found.length) return Response.json({ error: "Code not found" }, { status: 404, headers: CORS_HEADERS });
  const referrerId = found[0].user_id;

  // Anti-fraud: no self-referral (also enforced by a DB CHECK constraint).
  if (isSelfReferral(referrerId, refereeId)) {
    return Response.json({ error: "self_referral" }, { status: 400, headers: CORS_HEADERS });
  }

  // Bind — idempotent via UNIQUE(referee_id). A 23505/409 means "already bound";
  // fall through to the (also idempotent) credit attempt rather than erroring.
  const bindRes = await fetch(`${sbUrl()}/rest/v1/referrals`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({ referrer_id: referrerId, referee_id: refereeId, credited: false }),
  });
  if (!bindRes.ok) {
    const txt = await bindRes.text();
    if (!isDuplicatePaymentResponse(bindRes.status, txt)) throw new Error("bind failed: " + txt);
  }

  // Qualification gate — an unconfirmed referee binds but earns the referrer nothing yet.
  if (!isQualifiedReferee(user)) {
    return Response.json({ ok: true, qualified: false, credited: false }, { headers: CORS_HEADERS });
  }

  const result = await creditReferrer(referrerId, refereeId);
  return Response.json({ ok: true, qualified: true, ...result }, { headers: CORS_HEADERS });
}

// ── Exactly-once 7-day grant to the referrer ──────────────────────────────────

async function creditReferrer(referrerId, refereeId) {
  const txId = deriveReferralTxId(refereeId);
  if (!txId) throw new Error("missing referee id for referral tx"); // defensive

  // Read the referrer's current expiry so the +7d stacks instead of overwriting.
  let currentExpiry = null;
  const subRes = await fetch(
    `${sbUrl()}/rest/v1/subscriptions?user_id=eq.${referrerId}&select=is_active,expires_at`,
    { headers: sbHeaders() },
  );
  if (subRes.ok) {
    const rows = await subRes.json();
    const existing = rows[0];
    if (existing?.is_active && existing.expires_at) currentExpiry = existing.expires_at;
  }
  const premiumUntil = computeReferralExpiry(currentExpiry, Date.now(), REFERRAL_DAYS);

  // EXACTLY-ONCE GATE: claim the grant via UNIQUE(payments.kaspi_tx_id). A replay
  // or a concurrent race loses this INSERT (23505/409) and returns without writing
  // the subscription — so the relative extension is applied by the winner only.
  const payRes = await fetch(`${sbUrl()}/rest/v1/payments`, {
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
  });
  if (!payRes.ok) {
    const txt = await payRes.text();
    if (isDuplicatePaymentResponse(payRes.status, txt)) {
      return { credited: true, alreadyCredited: true }; // idempotent — no double grant
    }
    throw new Error("grant claim failed: " + txt);
  }

  // We won the claim — extend the referrer's premium exactly once.
  const upsertRes = await fetch(`${sbUrl()}/rest/v1/subscriptions`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: referrerId,
      is_active: true,
      plan: "referral",
      expires_at: premiumUntil,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!upsertRes.ok) throw new Error("subscription extend failed: " + (await upsertRes.text()));

  // Bookkeeping: mark the referral credited (audit trail; the payments UNIQUE tx,
  // not this flag, is the idempotency gate).
  await fetch(
    `${sbUrl()}/rest/v1/referrals?referee_id=eq.${refereeId}&credited=eq.false`,
    {
      method: "PATCH",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ credited: true }),
    },
  );

  return { credited: true };
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
