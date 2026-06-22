// Delete user account: removes auth.users record, profile, avatar, and all related data.
// Called from Settings → Delete Account.

import { CORS_HEADERS, corsResponse, verifyAuth } from "./utils/shared.mjs";
import { captureFunctionError } from "./utils/sentry.mjs";

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function sbHeaders() {
  return {
    apikey: SB_SERVICE_KEY,
    Authorization: `Bearer ${SB_SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS });
  }

  // Verify the user is authenticated
  const user = await verifyAuth(req);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  try {
    // 1. Delete avatar files from storage (best-effort, but logged for admin cleanup)
    try {
      const listRes = await fetch(
        `${SB_URL}/storage/v1/object/list/avatars?prefix=${user.id}`,
        { headers: sbHeaders() },
      );
      if (!listRes.ok) {
        console.warn("delete-account: avatar list failed", user.id, listRes.status, await listRes.text());
      } else {
        const files = await listRes.json();
        if (files.length > 0) {
          const delRes = await fetch(`${SB_URL}/storage/v1/object/avatars`, {
            method: "DELETE",
            headers: sbHeaders(),
            body: JSON.stringify({ prefixes: files.map((f) => `${user.id}/${f.name}`) }),
          });
          if (!delRes.ok) {
            console.warn("delete-account: avatar delete failed", user.id, delRes.status, await delRes.text());
          }
        }
      }
    } catch (err) {
      console.warn("delete-account: avatar cleanup threw", user.id, err);
    }

    // 2. Delete profile + cascaded data (friendships, friend_requests, etc.)
    const profRes = await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${user.id}`, {
      method: "DELETE",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
    });
    if (!profRes.ok) {
      console.warn("delete-account: profile delete failed", user.id, profRes.status, await profRes.text());
    }

    // 3. Delete push subscriptions
    const pushRes = await fetch(`${SB_URL}/rest/v1/push_subscriptions?user_id=eq.${user.id}`, {
      method: "DELETE",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
    });
    if (!pushRes.ok) {
      console.warn("delete-account: push_subscriptions delete failed", user.id, pushRes.status, await pushRes.text());
    }

    // 4. Delete auth.users record (requires service_role key)
    const deleteRes = await fetch(`${SB_URL}/auth/v1/admin/users/${user.id}`, {
      method: "DELETE",
      headers: sbHeaders(),
    });

    if (!deleteRes.ok) {
      const msg = await deleteRes.text();
      console.error("Failed to delete auth user:", msg);
      return Response.json(
        { error: "Failed to delete account" },
        { status: 500, headers: CORS_HEADERS },
      );
    }

    return Response.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("delete-account error:", err);
    captureFunctionError(err, { fn: "delete-account" });
    return Response.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
