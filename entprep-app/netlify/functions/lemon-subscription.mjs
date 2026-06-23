// Lemon Squeezy subscription self-management — lets a logged-in web user view and
// cancel (or resume) their own recurring subscription, entirely on entprep.org.
//
// POST /api/lemon-subscription  { mode: "status" | "cancel" | "resume" }
//   Authenticated. We NEVER trust a client-supplied subscription id: we look the
//   subscription up in the Lemon API by the caller's *account email* (same security
//   model as lemon-reconcile self mode) and act only on a record whose user_email
//   matches the caller. A user can therefore only ever cancel their own subscription.
//
//   status → returns { found, status, cancelled, renewsAt, endsAt, cardBrand, cardLast4 }
//   cancel → DELETE the subscription(s) = Lemon "cancel at period end". The user keeps
//            PRO until ends_at, no further charges. Reversible via resume. Idempotent.
//            Cancels EVERY still-billing sub for the email so a duplicate-subscription
//            state can't leave the user charged.
//   resume → PATCH cancelled:false to undo a pending cancellation before it lapses.
//
//   On cancel/resume we also reconcile the access-governing subscriptions.expires_at
//   with Lemon's authoritative date, so the in-app PRO cutoff matches what the UI shows.
//
// Only the MONTHLY plan is a recurring Lemon subscription. The yearly "season pass"
// is a one-time order (no subscription record) → status returns found:false and the
// client explains there is nothing to auto-cancel. Native (RevenueCat) purchases also
// have no Lemon subscription → found:false → client points the user to the store.
//
// Required env (already used by lemon-reconcile / lemon-webhook):
//   LEMON_API_KEY        — Lemon Squeezy API key (Settings → API)
//   LEMON_STORE_ID       — numeric store id (OPTIONAL; scopes the lookup to our store)
//   VITE_SUPABASE_URL    — Supabase project URL (for the expires_at reconcile write)
//   SUPABASE_SERVICE_KEY — service role key (subscriptions table is service-write only)

import { CORS_HEADERS, corsResponse, verifyAuth, createRateLimiter, rateLimitResponse } from "./utils/shared.mjs";
import { emailMatches } from "./lemon-reconcile.mjs";
import { captureFunctionError } from "./utils/sentry.mjs";

const LEMON_API_KEY = process.env.LEMON_API_KEY;
const LEMON_STORE_ID = process.env.LEMON_STORE_ID;
const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

// Lemon subscription statuses: on_trial, active, paused, past_due, unpaid, cancelled, expired.
// "Live" = still grants (or recently granted) access, so it's relevant to show/act on.
// "expired" is excluded — fully lapsed, nothing to manage.
const LIVE_STATUSES = new Set(["on_trial", "active", "past_due", "unpaid", "paused", "cancelled"]);

// Health ranking — a healthy renewing sub must win over a stale dunning/cancelled
// one regardless of the order Lemon returns them in. Lower = healthier.
const STATUS_PRIORITY = { active: 0, on_trial: 0, paused: 1, past_due: 2, unpaid: 3, cancelled: 4 };

// Per-user limiter (in-memory, per instance) — consistent with sibling functions.
const limit = createRateLimiter("lemon-subscription", { max: 12, windowSec: 60 });

function json(obj, status = 200) {
  return Response.json(obj, { status, headers: CORS_HEADERS });
}

async function lemonFetch(path, { method = "GET", body } = {}) {
  if (!LEMON_API_KEY) throw new Error("LEMON_API_KEY not set");
  const res = await fetch(`https://api.lemonsqueezy.com/v1${path}`, {
    method,
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${LEMON_API_KEY}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`Lemon API ${res.status}: ${await res.text()}`);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function findSubscriptionsByEmail(email) {
  // LEMON_STORE_ID is optional: when set it scopes the query to our store (and we
  // re-check store_id below); when unset we just filter by the caller's email. The
  // emailMatches re-bind in the handler is what actually guarantees a user can only
  // ever touch their own subscription, so store scoping is a nicety, not a gate.
  const params = new URLSearchParams({
    "filter[user_email]": email,
    "page[size]": "20",
  });
  if (LEMON_STORE_ID) params.set("filter[store_id]", LEMON_STORE_ID);
  const data = await lemonFetch(`/subscriptions?${params}`);
  return data?.data || [];
}

// Align the access-governing subscriptions.expires_at with Lemon's authoritative date
// so the in-app PRO cutoff (AuthContext/checkPremium read this row) matches the
// cancel/resume UI. Never SHORTENS an existing grant — takes the later of the two, so
// a separate promo grant can't be cut short by a monthly cancel. Non-fatal: the
// Lemon-side change already succeeded; a failed reconcile only leaves the pre-existing
// (slightly drifting) date behaviour, never strands the cancellation.
async function reconcileExpiry(userId, lemonDate) {
  if (!lemonDate || !SB_URL || !SB_KEY) return;
  try {
    const cur = await fetch(
      `${SB_URL}/rest/v1/subscriptions?user_id=eq.${userId}&select=expires_at&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } },
    );
    const rows = cur.ok ? await cur.json() : [];
    const existing = rows[0]?.expires_at ? new Date(rows[0].expires_at) : null;
    const lemon = new Date(lemonDate);
    const target = existing && existing > lemon ? existing.toISOString() : lemon.toISOString();
    await fetch(`${SB_URL}/rest/v1/subscriptions?user_id=eq.${userId}`, {
      method: "PATCH",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ expires_at: target, updated_at: new Date().toISOString() }),
    });
  } catch (e) {
    console.error("lemon-subscription: reconcileExpiry failed (non-fatal):", e);
  }
}

// ── Pure helpers (exported for unit tests) ──────────────────────────────────

// Subs the caller is still being billed for (excludes cancelled / pending-cancel).
export function nonCancelledLiveSubs(list) {
  return (list || []).filter(s => {
    const a = (s && s.attributes) || {};
    return LIVE_STATUSES.has(a.status) && a.status !== "cancelled" && a.cancelled !== true;
  });
}

// From the caller's Lemon subscriptions, pick the one to surface/act on. Ranks by
// health so a healthy active/on_trial sub beats a stale past_due/unpaid or a
// cancelled one, regardless of Lemon's list order. A pending-cancel (cancelled:true
// but status not yet flipped) sorts as cancelled. Returns null when none are live.
export function pickSubscription(list) {
  const live = (list || []).filter(s => LIVE_STATUSES.has(s?.attributes?.status));
  if (live.length === 0) return null;
  const rank = s => {
    const a = s.attributes || {};
    if (a.cancelled === true) return STATUS_PRIORITY.cancelled;
    return STATUS_PRIORITY[a.status] ?? 5;
  };
  return [...live].sort((x, y) => rank(x) - rank(y))[0];
}

// Shape the client UI needs — never leaks raw Lemon internals beyond what's shown.
export function summarizeSubscription(sub) {
  const a = (sub && sub.attributes) || {};
  return {
    status: a.status || null,
    cancelled: a.status === "cancelled" || a.cancelled === true,
    renewsAt: a.renews_at || null,
    endsAt: a.ends_at || null,
    cardBrand: a.card_brand || null,
    cardLast4: a.card_last_four || null,
  };
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authUser = await verifyAuth(req);
  if (!authUser) return json({ error: "Unauthorized" }, 401);
  const email = authUser.email;
  if (!email) return json({ error: "No email on account" }, 400);

  const retry = limit(authUser.id);
  if (retry) return rateLimitResponse(retry);

  let body;
  try { body = await req.json(); } catch { body = {}; }
  const mode = body.mode || "status";

  try {
    // Look up by email, then defensively re-bind to the caller: only act on a
    // record whose user_email equals the caller's and that belongs to our store.
    const subs = (await findSubscriptionsByEmail(email)).filter(s =>
      emailMatches(s?.attributes?.user_email, email)
      && (!LEMON_STORE_ID || String(s?.attributes?.store_id) === String(LEMON_STORE_ID)),
    );
    const sub = pickSubscription(subs);

    if (mode === "status") {
      if (!sub) return json({ found: false });
      return json({ found: true, ...summarizeSubscription(sub) });
    }

    if (mode === "cancel") {
      // Cancel EVERY still-billing sub so a duplicate-subscription state can't
      // leave the user charged. Normally there is exactly one.
      const billing = nonCancelledLiveSubs(subs);
      if (billing.length === 0) {
        // Already cancelled → idempotent success; otherwise nothing to cancel.
        if (sub && (sub.attributes.status === "cancelled" || sub.attributes.cancelled === true)) {
          return json({ ok: true, alreadyCancelled: true, endsAt: sub.attributes.ends_at || null });
        }
        return json({ error: "no_active_subscription" }, 404);
      }
      if (billing.length > 1) {
        console.warn(`lemon-subscription: ${email} has ${billing.length} billing subs — cancelling all`);
      }
      let latestEnds = null;
      for (const b of billing) {
        const result = await lemonFetch(`/subscriptions/${b.id}`, { method: "DELETE" });
        const ra = (result && result.data && result.data.attributes) || {};
        const ends = ra.ends_at || b.attributes.ends_at || b.attributes.renews_at || null;
        if (ends && (!latestEnds || new Date(ends) > new Date(latestEnds))) latestEnds = ends;
      }
      await reconcileExpiry(authUser.id, latestEnds);
      console.log(`lemon-subscription: cancelled ${billing.length} sub(s) for ${email} (ends ${latestEnds || "?"})`);
      return json({ ok: true, endsAt: latestEnds, status: "cancelled" });
    }

    if (mode === "resume") {
      if (!sub) return json({ error: "no_subscription" }, 404);
      const result = await lemonFetch(`/subscriptions/${sub.id}`, {
        method: "PATCH",
        body: { data: { type: "subscriptions", id: String(sub.id), attributes: { cancelled: false } } },
      });
      const ra = (result && result.data && result.data.attributes) || {};
      const renewsAt = ra.renews_at || sub.attributes.renews_at || null;
      await reconcileExpiry(authUser.id, renewsAt);
      console.log(`lemon-subscription: resumed sub ${sub.id} for ${email}`);
      return json({ ok: true, renewsAt, status: ra.status || "active" });
    }

    return json({ error: "Unknown mode (use 'status', 'cancel' or 'resume')" }, 400);
  } catch (err) {
    console.error("lemon-subscription error:", err);
    captureFunctionError(err, { fn: "lemon-subscription", mode });
    // A status read must never block the Settings UI with an error — degrade to
    // "no subscription found" (the user then sees the neutral "nothing to cancel"
    // message). The real cause is still captured above for the owner. cancel/resume
    // surface the error so a failed mutation is never silently swallowed.
    if (mode === "status") return json({ found: false });
    return json({ error: "Internal error" }, 500);
  }
}
