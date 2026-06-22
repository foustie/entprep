// Promo code system: redeem a code for Premium days
import { CORS_HEADERS, corsResponse, verifyAuth, createRateLimiter, rateLimitResponse } from "./utils/shared.mjs";
import { captureFunctionError } from "./utils/sentry.mjs";

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

function sbHeaders() {
  return {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    "Content-Type": "application/json",
  };
}

const limiter = createRateLimiter("promo", { max: 5, windowSec: 60 });

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS });
  }

  const user = await verifyAuth(req);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  const blocked = limiter(user.id);
  if (blocked) return rateLimitResponse(blocked);

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
  }

  const { code } = body;
  if (!code || typeof code !== "string" || code.length < 3 || code.length > 30) {
    return Response.json({ error: "Invalid code" }, { status: 400, headers: CORS_HEADERS });
  }

  const normalizedCode = code.trim().toUpperCase();

  try {
    // 1. Look up promo code
    const codeRes = await fetch(
      `${SB_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(normalizedCode)}&select=*&limit=1`,
      { headers: sbHeaders() }
    );
    if (!codeRes.ok) throw new Error("Failed to look up promo code");
    const codes = await codeRes.json();

    if (codes.length === 0) {
      return Response.json({ error: "Code not found" }, { status: 404, headers: CORS_HEADERS });
    }

    const promo = codes[0];

    // 2. Validate code
    if (!promo.is_active) {
      return Response.json({ error: "Code expired" }, { status: 410, headers: CORS_HEADERS });
    }
    if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
      return Response.json({ error: "Code fully redeemed" }, { status: 410, headers: CORS_HEADERS });
    }
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return Response.json({ error: "Code expired" }, { status: 410, headers: CORS_HEADERS });
    }

    // 3. Check if user already redeemed this code
    const usedRes = await fetch(
      `${SB_URL}/rest/v1/promo_redemptions?user_id=eq.${user.id}&promo_id=eq.${promo.id}&select=id&limit=1`,
      { headers: sbHeaders() }
    );
    if (usedRes.ok) {
      const used = await usedRes.json();
      if (used.length > 0) {
        return Response.json({ error: "Already redeemed" }, { status: 409, headers: CORS_HEADERS });
      }
    }

    // 4. Grant Premium days
    const days = promo.days || 7;
    const premiumUntil = await grantPremiumDays(user.id, days);

    // 5. Record redemption
    await fetch(`${SB_URL}/rest/v1/promo_redemptions`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({
        promo_id: promo.id,
        user_id: user.id,
        code: normalizedCode,
      }),
    });

    // 6. Increment used_count
    await fetch(`${SB_URL}/rest/v1/promo_codes?id=eq.${promo.id}`, {
      method: "PATCH",
      headers: sbHeaders(),
      body: JSON.stringify({ used_count: promo.used_count + 1 }),
    });

    return Response.json({
      ok: true,
      days,
      premium_until: premiumUntil,
    }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("Promo error:", err);
    captureFunctionError(err, { fn: "promo" });
    return Response.json({ error: "Server error" }, { status: 500, headers: CORS_HEADERS });
  }
}

async function grantPremiumDays(userId, days) {
  let premiumUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  // Check existing subscription — extend if active
  const subRes = await fetch(
    `${SB_URL}/rest/v1/subscriptions?user_id=eq.${userId}&select=is_active,expires_at`,
    { headers: sbHeaders() }
  );
  if (subRes.ok) {
    const rows = await subRes.json();
    const existing = rows[0];
    if (existing?.is_active && existing.expires_at) {
      const existingEnd = new Date(existing.expires_at);
      if (existingEnd > new Date()) {
        premiumUntil = new Date(existingEnd.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
      }
    }
  }

  // Upsert subscription
  await fetch(`${SB_URL}/rest/v1/subscriptions`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: userId,
      is_active: true,
      plan: "promo",
      expires_at: premiumUntil,
      updated_at: new Date().toISOString(),
    }),
  });

  // Update user_metadata cache
  await fetch(`${SB_URL}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: sbHeaders(),
    body: JSON.stringify({
      user_metadata: { is_premium: true, premium_until: premiumUntil },
    }),
  });

  return premiumUntil;
}
