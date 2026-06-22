// RevenueCat webhook — grants/revokes premium based on subscription events
import { CORS_HEADERS, corsResponse, activatePremium } from "./utils/shared.mjs";
import { timingSafeEqual } from "node:crypto";

export const config = { path: "/api/revenuecat-webhook" };

const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

function sbHeaders() {
  return {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    "Content-Type": "application/json",
  };
}

// Events that grant premium
const GRANT_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
]);

// Events that revoke premium
const REVOKE_EVENTS = new Set([
  "EXPIRATION",
  "BILLING_ISSUE",
]);

async function findUserById(userId) {
  const res = await fetch(`${SB_URL}/auth/v1/admin/users/${userId}`, {
    headers: sbHeaders(),
  });
  if (!res.ok) return null;
  return await res.json();
}

async function findUserByEmail(email) {
  const res = await fetch(
    `${SB_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&page=1&per_page=1`,
    { headers: sbHeaders() },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return (data.users || []).find(u => u.email === email) || null;
}

async function revokePremium(userId, userMeta) {
  // Keep user_metadata write as cache (backwards compatibility)
  const res = await fetch(`${SB_URL}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: sbHeaders(),
    body: JSON.stringify({
      user_metadata: { ...userMeta, is_premium: false, premium_until: null },
    }),
  });
  if (!res.ok) throw new Error("Failed to revoke premium: " + await res.text());

  // Upsert subscriptions table (authoritative source)
  try {
    await fetch(`${SB_URL}/rest/v1/subscriptions`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        user_id: userId,
        is_active: false,
        expires_at: null,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error("Failed to upsert subscriptions on revoke:", e);
  }
}

async function resolveUser(event) {
  const appUserID = event.app_user_id;
  const email = event.subscriber_attributes?.$email?.value;

  // appUserID is set to Supabase user ID during loginPurchases
  if (appUserID && !appUserID.startsWith("$RCAnonymousID:")) {
    const user = await findUserById(appUserID);
    if (user) return user;
  }

  // Fallback: look up by email subscriber attribute
  if (email) {
    return await findUserByEmail(email);
  }

  return null;
}

export function determinePlan(event) {
  const productId = event.product_id || "";
  if (productId.includes("yearly") || productId.includes("annual")) return "yearly";
  return "monthly";
}

// Idempotency key for the payments table. RC delivers at-least-once, so replays
// must collapse to the same kaspi_tx_id. Returns null when event.id is missing —
// we must NOT fabricate an id from the event type, which would collapse every
// event of that type to one row (and silently drop legitimate distinct events).
export function deriveRcTxId(event) {
  return event && event.id ? `rc_${event.id}` : null;
}

// Timing-safe verification of the `Authorization: Bearer <secret>` header.
// Pure + env-independent so it can be unit-tested; the handler passes
// WEBHOOK_SECRET as `secret`. Returns false when secret is missing/empty,
// on length mismatch, or on timingSafeEqual failure.
export function verifyBearer(authHeader, secret) {
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  const headerBuf = Buffer.from(authHeader || "");
  const expectedBuf = Buffer.from(expected);
  return headerBuf.length === expectedBuf.length && timingSafeEqual(headerBuf, expectedBuf);
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS });
  }

  // Verify webhook secret (timing-safe comparison)
  const authHeader = req.headers.get("authorization") || "";
  if (!verifyBearer(authHeader, WEBHOOK_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
  }

  const event = body.event;
  if (!event) {
    return Response.json({ error: "No event" }, { status: 400, headers: CORS_HEADERS });
  }

  const eventType = event.type;
  const isGrant = GRANT_EVENTS.has(eventType);
  const isRevoke = REVOKE_EVENTS.has(eventType);

  if (!isGrant && !isRevoke) {
    // Event we don't handle (e.g., CANCELLATION — still active until period ends)
    return Response.json({ ok: true, skipped: eventType }, { status: 200, headers: CORS_HEADERS });
  }

  try {
    const user = await resolveUser(event);
    if (!user) {
      console.error(`RC webhook: user not found for event ${eventType}`, event.app_user_id);
      return Response.json({ error: "User not found" }, { status: 404, headers: CORS_HEADERS });
    }

    if (isGrant) {
      const plan = determinePlan(event);

      // Without a stable event id we cannot dedupe a replay — skip rather than
      // fabricate an id from eventType (which would collapse all such events).
      const txId = deriveRcTxId(event);
      if (!txId) {
        console.error(`RC webhook: event ${eventType} has no id, skipping grant for ${user.id}`);
        return Response.json({ ok: true, skipped: "no-event-id" }, { status: 200, headers: CORS_HEADERS });
      }

      // Idempotency: RC delivers at-least-once. Skip if this tx already processed
      // (mirrors lemon-webhook) to avoid double-granting / double-inserting payments.
      try {
        const existingRes = await fetch(
          `${SB_URL}/rest/v1/payments?kaspi_tx_id=eq.${encodeURIComponent(txId)}&select=id&limit=1`,
          { headers: sbHeaders() },
        );
        const existing = existingRes.ok ? await existingRes.json() : [];
        if (existing.length > 0) {
          console.log(`RC webhook: duplicate tx ${txId}, skipping`);
          return Response.json({ ok: true, duplicate: true }, { status: 200, headers: CORS_HEADERS });
        }
      } catch { /* proceed if check fails */ }

      const premiumUntil = await activatePremium({
        userId: user.id,
        userMeta: user.user_metadata || {},
        plan,
        kaspiTxId: txId,
      });
      // Also store RC customer ID in subscriptions table
      try {
        const rcCustomerId = event.app_user_id || event.original_app_user_id || null;
        if (rcCustomerId) {
          await fetch(`${SB_URL}/rest/v1/subscriptions`, {
            method: "POST",
            headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify({
              user_id: user.id,
              is_active: true,
              plan,
              expires_at: premiumUntil,
              rc_customer_id: rcCustomerId,
              updated_at: new Date().toISOString(),
            }),
          });
        }
      } catch (e) {
        console.error("Failed to update rc_customer_id in subscriptions:", e);
      }
      console.log(`RC webhook: premium granted to ${user.id} until ${premiumUntil}`);
    } else {
      await revokePremium(user.id, user.user_metadata || {});
      console.log(`RC webhook: premium revoked for ${user.id}`);
    }

    return Response.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error("RC webhook error:", err);
    return Response.json({ error: "Internal error" }, { status: 500, headers: CORS_HEADERS });
  }
}
