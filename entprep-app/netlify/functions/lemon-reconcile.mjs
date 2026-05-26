// Lemon Squeezy reconciliation — recover lost subscriptions where the webhook
// failed to match a user (email mismatch, late registration, dropped retries).
//
// Two modes:
//   POST /api/lemon-reconcile { mode: "manual", emails: ["a@b.com", ...] }
//     Admin-only. For each email: look up in auth.users → if no active
//     subscription → fetch latest paid order from Lemon API → activate.
//
//   POST /api/lemon-reconcile { mode: "self", lemonOrderId: "12345" }
//     Authenticated user. After paying with a different email than they registered
//     with, they paste their order ID — we verify it exists in Lemon, then
//     activate premium on their *current logged-in* user_id.
//
// Required env:
//   LEMON_API_KEY — Lemon Squeezy API key (Settings → API)
//   LEMON_STORE_ID — store ID (numeric, from Lemon dashboard URL)
//   ADMIN_EMAILS — comma-separated admin emails for `mode=manual`

import { CORS_HEADERS, corsResponse, verifyAuth, findUserByEmail, activatePremium } from "./utils/shared.mjs";

const LEMON_API_KEY = process.env.LEMON_API_KEY;
const LEMON_STORE_ID = process.env.LEMON_STORE_ID;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

const YEARLY_VARIANT_IDS = new Set(
  (process.env.LEMON_YEARLY_VARIANT_IDS || "").split(",").map(s => s.trim()).filter(Boolean)
);
const MONTHLY_VARIANT_IDS = new Set(
  (process.env.LEMON_MONTHLY_VARIANT_IDS || "").split(",").map(s => s.trim()).filter(Boolean)
);

async function lemonFetch(path) {
  if (!LEMON_API_KEY) throw new Error("LEMON_API_KEY not set");
  const res = await fetch(`https://api.lemonsqueezy.com/v1${path}`, {
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${LEMON_API_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Lemon API ${res.status}: ${await res.text()}`);
  return res.json();
}

function classifyPlan(variantId) {
  const vid = variantId != null ? String(variantId) : null;
  if (vid && YEARLY_VARIANT_IDS.has(vid)) return "yearly";
  if (vid && MONTHLY_VARIANT_IDS.has(vid)) return "monthly";
  return null; // unknown — caller decides fallback
}

async function hasActivePremium(userId) {
  const res = await fetch(
    `${SB_URL}/rest/v1/subscriptions?user_id=eq.${userId}&select=is_active,expires_at&limit=1`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } },
  );
  if (!res.ok) return false;
  const rows = await res.json();
  const row = rows[0];
  if (!row || !row.is_active) return false;
  if (!row.expires_at) return true;
  return new Date(row.expires_at) > new Date();
}

// Pull all paid orders for a given email from Lemon (most recent first)
async function findLemonOrdersByEmail(email) {
  if (!LEMON_STORE_ID) throw new Error("LEMON_STORE_ID not set");
  const params = new URLSearchParams({
    "filter[store_id]": LEMON_STORE_ID,
    "filter[user_email]": email,
    "page[size]": "10",
  });
  const data = await lemonFetch(`/orders?${params}`);
  return (data.data || []).filter(o => o.attributes?.status === "paid");
}

async function findLemonOrderById(orderId) {
  const data = await lemonFetch(`/orders/${orderId}`);
  return data.data;
}

async function activateFromLemonOrder(user, order) {
  const attrs = order.attributes || {};
  const variantId = attrs.first_order_item?.variant_id;
  const plan = classifyPlan(variantId)
    // Fallback: Lemon order interval — "year" / "month" — present on subscriptions
    || (attrs.first_order_item?.product_name?.toLowerCase().includes("year") ? "yearly" : "monthly");

  const txId = `lemon_reconcile_${order.id}`;
  const premiumUntil = await activatePremium({
    userId: user.id,
    userMeta: user.user_metadata || {},
    plan,
    kaspiTxId: txId,
  });
  return { plan, premiumUntil, orderId: order.id, paidAt: attrs.created_at };
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS });
  }

  let body;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
  }

  const mode = body.mode;

  // ── Mode: self ────────────────────────────────────────────────────────────
  // User pasted their Lemon order ID after paying with a different email.
  if (mode === "self") {
    const authUser = await verifyAuth(req);
    if (!authUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }
    const orderId = String(body.lemonOrderId || "").trim();
    if (!orderId || !/^\d+$/.test(orderId)) {
      return Response.json({ error: "Invalid orderId" }, { status: 400, headers: CORS_HEADERS });
    }
    try {
      const order = await findLemonOrderById(orderId);
      if (!order) {
        return Response.json({ error: "Order not found" }, { status: 404, headers: CORS_HEADERS });
      }
      if (order.attributes?.status !== "paid") {
        return Response.json({ error: "Order not paid", status: order.attributes?.status }, { status: 400, headers: CORS_HEADERS });
      }
      // Sanity: store must match — block claiming someone else's order from another shop
      if (LEMON_STORE_ID && String(order.attributes?.store_id) !== String(LEMON_STORE_ID)) {
        return Response.json({ error: "Order from different store" }, { status: 400, headers: CORS_HEADERS });
      }
      // Fetch fresh user record (verifyAuth returns shallow user without user_metadata field guarantee)
      const userRes = await fetch(`${SB_URL}/auth/v1/admin/users/${authUser.id}`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      });
      if (!userRes.ok) {
        return Response.json({ error: "Failed to load user" }, { status: 500, headers: CORS_HEADERS });
      }
      const fullUser = await userRes.json();
      const result = await activateFromLemonOrder(fullUser, order);
      console.log(`lemon-reconcile (self): activated ${authUser.id} from order ${orderId} (${result.plan})`);
      return Response.json({ ok: true, ...result }, { status: 200, headers: CORS_HEADERS });
    } catch (err) {
      console.error("lemon-reconcile (self) error:", err);
      return Response.json({ error: "Internal error", detail: String(err.message || err) }, { status: 500, headers: CORS_HEADERS });
    }
  }

  // ── Mode: manual (admin batch reconcile by email) ─────────────────────────
  if (mode === "manual") {
    const authUser = await verifyAuth(req);
    if (!authUser || !ADMIN_EMAILS.includes((authUser.email || "").toLowerCase())) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: CORS_HEADERS });
    }
    const emails = Array.isArray(body.emails) ? body.emails : [];
    if (emails.length === 0 || emails.length > 50) {
      return Response.json({ error: "emails: 1-50 strings" }, { status: 400, headers: CORS_HEADERS });
    }
    const results = [];
    for (const rawEmail of emails) {
      const email = String(rawEmail || "").trim().toLowerCase();
      if (!email) continue;
      try {
        const user = await findUserByEmail(email);
        if (!user) {
          results.push({ email, status: "user_not_found" });
          continue;
        }
        if (await hasActivePremium(user.id)) {
          results.push({ email, status: "already_active" });
          continue;
        }
        const orders = await findLemonOrdersByEmail(email);
        if (orders.length === 0) {
          results.push({ email, status: "no_lemon_orders" });
          continue;
        }
        // Most recent paid order — Lemon returns by created_at desc by default
        const result = await activateFromLemonOrder(user, orders[0]);
        results.push({ email, status: "activated", ...result });
      } catch (err) {
        console.error(`lemon-reconcile (manual) error for ${email}:`, err);
        results.push({ email, status: "error", detail: String(err.message || err) });
      }
    }
    return Response.json({ ok: true, results }, { status: 200, headers: CORS_HEADERS });
  }

  return Response.json({ error: "Unknown mode (use 'self' or 'manual')" }, { status: 400, headers: CORS_HEADERS });
}
