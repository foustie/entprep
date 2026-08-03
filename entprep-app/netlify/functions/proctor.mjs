// Soft proctoring API — log + teacher read (never auto-fail)
import { CORS_HEADERS, corsResponse, verifyAuth, createRateLimiter, rateLimitResponse } from "./utils/shared.mjs";

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const TENANT_ID = (process.env.TENANT_ID || process.env.VITE_TENANT_ID || "125").trim();

const ALLOWED_TYPES = new Set([
  "visibility_hidden",
  "blur",
  "focus",
  "fullscreen_exit",
  "session_start",
  "session_end",
  "camera_consent_accepted",
  "camera_consent_declined",
  "camera_start",
  "camera_denied",
  "camera_stopped",
]);

const sbHeaders = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function sbGet(table, query) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, { headers: sbHeaders });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function sbInsert(table, row) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: sbHeaders,
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function teacherOwnsStudent(teacherId, studentId) {
  const classes = await sbGet("classes", `teacher_id=eq.${teacherId}&select=id`);
  if (!classes.length) return false;
  const classIds = classes.map((c) => c.id);
  const members = await sbGet(
    "class_members",
    `student_id=eq.${studentId}&class_id=in.(${classIds.join(",")})&select=class_id`,
  );
  return members.length > 0;
}

const isUUID = (s) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const rateLimit = createRateLimiter("proctor", { max: 120, windowSec: 60 });

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();

  const user = await verifyAuth(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

  const wait = rateLimit(user.id);
  if (wait) return rateLimitResponse(wait);

  const url = new URL(req.url, "https://entprep.org");
  const action = url.searchParams.get("action") || (req.method === "POST" ? "log" : null);

  try {
    if (req.method === "POST" && (action === "log" || !url.searchParams.get("action"))) {
      const body = await req.json();
      const events = Array.isArray(body?.events) ? body.events : [body];
      const rows = [];
      for (const ev of events) {
        if (!ev || !ev.session_id || !ALLOWED_TYPES.has(ev.event_type)) continue;
        rows.push({
          tenant_id: TENANT_ID,
          user_id: user.id,
          session_id: String(ev.session_id).slice(0, 80),
          event_type: ev.event_type,
          meta: ev.meta && typeof ev.meta === "object" ? ev.meta : {},
        });
      }
      if (!rows.length) {
        return Response.json({ error: "no valid events" }, { status: 400, headers: CORS_HEADERS });
      }
      const inserted = await sbInsert("proctor_events", rows.length === 1 ? rows[0] : rows);
      return Response.json({ ok: true, count: Array.isArray(inserted) ? inserted.length : 1 }, { status: 201, headers: CORS_HEADERS });
    }

    if (action === "student_events") {
      const studentId = url.searchParams.get("student_id");
      const sessionId = url.searchParams.get("session_id");
      if (!isUUID(studentId)) {
        return Response.json({ error: "Invalid student_id" }, { status: 400, headers: CORS_HEADERS });
      }
      if (!(await teacherOwnsStudent(user.id, studentId))) {
        return Response.json({ error: "Нет доступа" }, { status: 403, headers: CORS_HEADERS });
      }
      let q = `user_id=eq.${studentId}&select=id,session_id,event_type,meta,created_at&order=created_at.desc&limit=100`;
      if (sessionId) q = `user_id=eq.${studentId}&session_id=eq.${encodeURIComponent(sessionId)}&select=id,session_id,event_type,meta,created_at&order=created_at.desc&limit=100`;
      const events = await sbGet("proctor_events", q);
      return Response.json({ events }, { headers: CORS_HEADERS });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: CORS_HEADERS });
  } catch (err) {
    console.error(`Proctor API error [${action}]:`, err);
    return Response.json({ error: "Произошла ошибка. Попробуйте позже." }, { status: 500, headers: CORS_HEADERS });
  }
}
