// Referral system: claim referral reward (7 days Premium for both referrer and referee)
import { CORS_HEADERS, corsResponse, verifyAuth, createRateLimiter, rateLimitResponse } from "./utils/shared.mjs";

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

function sbHeaders() {
  return {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    "Content-Type": "application/json",
  };
}

const limiter = createRateLimiter("referral", { max: 5, windowSec: 60 });

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

  const { referrer_nickname } = body;
  if (!referrer_nickname || typeof referrer_nickname !== "string" || referrer_nickname.length < 3) {
    return Response.json({ error: "Invalid referrer nickname" }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    // 1. Look up referrer by nickname
    const profileRes = await fetch(
      `${SB_URL}/rest/v1/profiles?nickname=ilike.${encodeURIComponent(referrer_nickname)}&select=id,nickname&limit=1`,
      { headers: sbHeaders() }
    );
    if (!profileRes.ok) throw new Error("Failed to look up referrer");
    const profiles = await profileRes.json();
    if (profiles.length === 0) {
      return Response.json({ error: "Referrer not found" }, { status: 404, headers: CORS_HEADERS });
    }

    const referrerId = profiles[0].id;

    // Can't refer yourself
    if (referrerId === user.id) {
      return Response.json({ error: "Cannot refer yourself" }, { status: 400, headers: CORS_HEADERS });
    }

    // 2. Check if referee already has a referral
    const existingRes = await fetch(
      `${SB_URL}/rest/v1/referrals?referee_id=eq.${user.id}&select=id&limit=1`,
      { headers: sbHeaders() }
    );
    if (!existingRes.ok) throw new Error("Failed to check existing referral");
    const existing = await existingRes.json();
    if (existing.length > 0) {
      return Response.json({ error: "Already referred" }, { status: 409, headers: CORS_HEADERS });
    }

    // 3. Insert referral record
    const insertRes = await fetch(`${SB_URL}/rest/v1/referrals`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({
        referrer_id: referrerId,
        referee_id: user.id,
        credited: true,
      }),
    });
    if (!insertRes.ok) {
      const errText = await insertRes.text();
      // Unique constraint violation = already referred
      if (errText.includes("unique") || errText.includes("duplicate")) {
        return Response.json({ error: "Already referred" }, { status: 409, headers: CORS_HEADERS });
      }
      throw new Error("Failed to insert referral: " + errText);
    }

    // 4. Grant 7 days Premium to both users
    const premiumUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await Promise.all([
      grantPremiumDays(referrerId, premiumUntil),
      grantPremiumDays(user.id, premiumUntil),
    ]);

    return Response.json({ ok: true, premium_until: premiumUntil }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("Referral error:", err);
    return Response.json({ error: "Server error" }, { status: 500, headers: CORS_HEADERS });
  }
}

async function grantPremiumDays(userId, premiumUntil) {
  // Check if user already has active premium that extends beyond the referral bonus
  const subRes = await fetch(
    `${SB_URL}/rest/v1/subscriptions?user_id=eq.${userId}&select=is_active,expires_at`,
    { headers: sbHeaders() }
  );
  if (subRes.ok) {
    const rows = await subRes.json();
    const existing = rows[0];
    if (existing?.is_active && existing.expires_at) {
      const existingEnd = new Date(existing.expires_at);
      const newEnd = new Date(premiumUntil);
      // Extend existing subscription by 7 days instead of overwriting
      if (existingEnd > new Date()) {
        premiumUntil = new Date(existingEnd.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      }
    }
  }

  // Upsert subscriptions table
  await fetch(`${SB_URL}/rest/v1/subscriptions`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: userId,
      is_active: true,
      plan: "referral",
      expires_at: premiumUntil,
      updated_at: new Date().toISOString(),
    }),
  });

  // Update user_metadata (cache)
  await fetch(`${SB_URL}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: sbHeaders(),
    body: JSON.stringify({
      user_metadata: { is_premium: true, premium_until: premiumUntil },
    }),
  });
}
