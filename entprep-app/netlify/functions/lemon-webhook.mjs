// LemonSqueezy webhook — grants premium on order/subscription created
import { createHmac, timingSafeEqual } from "node:crypto";
import { CORS_HEADERS, corsResponse, findUserByEmail, activatePremium } from "./utils/shared.mjs";

const WEBHOOK_SECRET = process.env.LEMON_WEBHOOK_SECRET;
// order_created = yearly season pass (one-time), subscription_created = monthly recurring.
// subscription_updated intentionally excluded — it would misclassify as yearly and re-grant premium on every renewal/status change.
const HANDLED_EVENTS = new Set(["order_created", "subscription_created"]);

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

    const plan = eventName === "subscription_created" ? "monthly" : "yearly";
    if (!body.data?.id) {
      return Response.json({ error: "Missing data.id" }, { status: 400, headers: CORS_HEADERS });
    }
    const txId = `lemon_${body.data.id}`;

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
