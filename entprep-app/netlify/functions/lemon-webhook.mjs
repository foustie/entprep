// LemonSqueezy webhook — grants premium on order/subscription created, extends on renewal
import { createHmac, timingSafeEqual } from "node:crypto";
import { CORS_HEADERS, corsResponse, findUserByEmail, activatePremium } from "./utils/shared.mjs";

const WEBHOOK_SECRET = process.env.LEMON_WEBHOOK_SECRET;
// order_created = yearly season pass (one-time)
// subscription_created = monthly — initial grant
// subscription_payment_success = monthly renewal charge. Only processed as renewal when user's
// current expires_at is within RENEWAL_WINDOW_DAYS of now — initial payment skipped here
// (subscription_created handles it) to avoid triple-logging in payments table.
const HANDLED_EVENTS = new Set(["order_created", "subscription_created", "subscription_payment_success"]);
const RENEWAL_WINDOW_DAYS = 3;

// Explicit variant→plan mapping. Set these env vars in Netlify to bullet-proof
// plan detection against Lemon firing subscription_created for yearly products
// (which would otherwise misclassify as monthly via event-name heuristic).
// Find variant IDs in Lemon dashboard → Products → variant edit URL.
const YEARLY_VARIANT_IDS = (process.env.LEMON_YEARLY_VARIANT_IDS || "")
  .split(",").map(s => s.trim()).filter(Boolean);
const MONTHLY_VARIANT_IDS = (process.env.LEMON_MONTHLY_VARIANT_IDS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

function detectPlan(eventName, attrs) {
  // Lemon payload shape:
  //   subscription_*: attrs.variant_id (number) + attrs.product_id
  //   order_created: attrs.first_order_item.variant_id (number)
  const rawVariant = attrs?.variant_id
    ?? attrs?.first_order_item?.variant_id
    ?? attrs?.first_subscription_item?.variant_id;
  const variantId = rawVariant != null ? String(rawVariant) : null;

  if (variantId) {
    if (YEARLY_VARIANT_IDS.includes(variantId)) return "yearly";
    if (MONTHLY_VARIANT_IDS.includes(variantId)) return "monthly";
  }

  // Fallback heuristic (preserved for backwards compat when env not set).
  // WARNING: assumes order_created = yearly, subscription events = monthly.
  // Misclassifies if yearly product is sold as a subscription on Lemon side.
  const isMonthlyEvent = eventName === "subscription_created"
    || eventName === "subscription_payment_success";
  return isMonthlyEvent ? "monthly" : "yearly";
}

function verifySignature(rawBody, signature) {
  if (!WEBHOOK_SECRET || !signature) return false;
  const digest = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  const sigBuf = Buffer.from(signature);
  const digestBuf = Buffer.from(digest);
  return sigBuf.length === digestBuf.length && timingSafeEqual(sigBuf, digestBuf);
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-signature");

  if (!verifySignature(rawBody, signature)) {
    return Response.json({ error: "Invalid signature" }, { status: 401, headers: CORS_HEADERS });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
  }

  const eventName = body.meta?.event_name;
  if (!HANDLED_EVENTS.has(eventName)) {
    return Response.json({ ok: true, skipped: eventName }, { status: 200, headers: CORS_HEADERS });
  }

  const email = body.data?.attributes?.user_email;
  if (!email) {
    return Response.json({ error: "No email in payload" }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      // Return 500 so LemonSqueezy retries — user may register after paying
      console.error(`Lemon webhook: user not found for ${email} — will retry`);
      return Response.json({ error: "User not found, retry later" }, { status: 500, headers: CORS_HEADERS });
    }

    const plan = detectPlan(eventName, body.data?.attributes);
    if (!body.data?.id) {
      return Response.json({ error: "Missing data.id" }, { status: 400, headers: CORS_HEADERS });
    }
    const txId = `lemon_${body.data.id}`;

    // subscription_payment_success fires on BOTH initial payment and renewals.
    // Skip initial (subscription_created handles it) — detect by checking if user's current
    // expires_at is within RENEWAL_WINDOW_DAYS of now. If far future → initial, skip. If near → renewal, process.
    if (eventName === "subscription_payment_success") {
      try {
        const subRes = await fetch(
          `${process.env.VITE_SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${user.id}&plan=eq.${plan}&select=expires_at&limit=1`,
          { headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } },
        );
        const subs = subRes.ok ? await subRes.json() : [];
        const currentExpiry = subs[0]?.expires_at ? new Date(subs[0].expires_at) : null;
        const windowMs = RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        const nowMs = Date.now();
        const isRenewal = currentExpiry && currentExpiry.getTime() - nowMs <= windowMs;
        if (!isRenewal) {
          console.log(`Lemon webhook: subscription_payment_success for ${email} treated as initial (expires_at=${currentExpiry?.toISOString() ?? 'none'}), skipping`);
          return Response.json({ ok: true, skipped: "not-renewal" }, { status: 200, headers: CORS_HEADERS });
        }
      } catch (e) {
        // Return 500 so LemonSqueezy retries — transient DB failure shouldn't silently drop a renewal
        console.error("Renewal detection failed, returning 500 for retry:", e);
        return Response.json({ error: "Renewal check failed, retry later" }, { status: 500, headers: CORS_HEADERS });
      }
    }

    // Idempotency: skip if this payment was already processed
    try {
      const existingRes = await fetch(
        `${process.env.VITE_SUPABASE_URL}/rest/v1/payments?kaspi_tx_id=eq.${encodeURIComponent(txId)}&select=id&limit=1`,
        { headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } },
      );
      const existing = existingRes.ok ? await existingRes.json() : [];
      if (existing.length > 0) {
        console.log(`Lemon webhook: duplicate tx ${txId}, skipping`);
        return Response.json({ ok: true, duplicate: true }, { status: 200, headers: CORS_HEADERS });
      }
    } catch { /* proceed if check fails */ }

    const premiumUntil = await activatePremium({
      userId: user.id,
      userMeta: user.user_metadata || {},
      plan,
      kaspiTxId: txId,
    });

    console.log(`Lemon webhook: premium granted to ${user.id} (${email}) until ${premiumUntil}`);
    return Response.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error("Lemon webhook error:", err);
    return Response.json({ error: "Internal error" }, { status: 500, headers: CORS_HEADERS });
  }
}
