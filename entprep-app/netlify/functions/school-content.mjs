// School content API: import / list / assign question packs (school-125 WL MVP)
import { CORS_HEADERS, corsResponse, verifyAuth, createRateLimiter, rateLimitResponse } from "./utils/shared.mjs";

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const TENANT_ID = (process.env.TENANT_ID || process.env.VITE_TENANT_ID || "125").trim();

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

async function sbPatch(table, filter, patch) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: sbHeaders,
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function parseTeacherEmails() {
  return (process.env.TEACHER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function assertTeacherAllowed(user) {
  const allow = parseTeacherEmails();
  if (!allow.length) return null;
  const email = (user.email || "").toLowerCase();
  if (!allow.includes(email)) {
    return Response.json({ error: "Нет доступа учителя" }, { status: 403, headers: CORS_HEADERS });
  }
  return null;
}

/** Validate Question-like objects: q, o[], c in range. */
function validateQuestions(raw) {
  const list = Array.isArray(raw) ? raw : raw?.questions;
  if (!Array.isArray(list) || !list.length) {
    return { ok: false, error: "questions must be a non-empty array" };
  }
  const cleaned = [];
  for (let i = 0; i < list.length; i++) {
    const q = list[i];
    if (!q || typeof q.q !== "string" || !q.q.trim()) {
      return { ok: false, error: `Question ${i + 1}: missing text (q)` };
    }
    if (!Array.isArray(q.o) || q.o.length < 2) {
      return { ok: false, error: `Question ${i + 1}: need options array (o) with ≥2 items` };
    }
    const c = q.c;
    if (typeof c !== "number" || c < 0 || c >= q.o.length) {
      return { ok: false, error: `Question ${i + 1}: correct index (c) out of range` };
    }
    cleaned.push(q);
  }
  return { ok: true, questions: cleaned };
}

async function teacherOwnsClass(userId, classId) {
  const rows = await sbGet("classes", `id=eq.${classId}&teacher_id=eq.${userId}&select=id`);
  return rows.length > 0;
}

const rateLimit = createRateLimiter("school-content", { max: 40, windowSec: 60 });

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsResponse();

  const user = await verifyAuth(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });

  const wait = rateLimit(user.id);
  if (wait) return rateLimitResponse(wait);

  const url = new URL(req.url, "https://entprep.org");
  const action = url.searchParams.get("action");

  try {
    switch (action) {
      case "import_pack": {
        const denied = assertTeacherAllowed(user);
        if (denied) return denied;
        const body = await req.json();
        const { subject, title, questions } = body || {};
        if (!subject || typeof subject !== "string") {
          return Response.json({ error: "subject required" }, { status: 400, headers: CORS_HEADERS });
        }
        const validated = validateQuestions(questions);
        if (!validated.ok) {
          return Response.json({ error: validated.error }, { status: 400, headers: CORS_HEADERS });
        }
        const rows = await sbInsert("school_questions", {
          tenant_id: TENANT_ID,
          subject: subject.trim().slice(0, 80),
          title: (title || subject).toString().trim().slice(0, 120),
          payload: validated.questions,
          created_by: user.id,
          assigned_class_ids: [],
        });
        return Response.json({
          pack: rows[0],
          imported: validated.questions.length,
          skipped: 0,
        }, { status: 201, headers: CORS_HEADERS });
      }

      case "list_packs": {
        const packs = await sbGet(
          "school_questions",
          `tenant_id=eq.${encodeURIComponent(TENANT_ID)}&or=(created_by.eq.${user.id})&select=id,subject,title,created_at,assigned_class_ids,created_by&order=created_at.desc`,
        );
        // Also include packs assigned to teacher's classes
        const classes = await sbGet("classes", `teacher_id=eq.${user.id}&select=id`);
        const classIds = classes.map((c) => c.id);
        let assigned = [];
        if (classIds.length) {
          // PostgREST: overlap operator cs / ov — use contains any via or filter is hard;
          // fetch tenant packs and filter in memory for MVP.
          const all = await sbGet(
            "school_questions",
            `tenant_id=eq.${encodeURIComponent(TENANT_ID)}&select=id,subject,title,created_at,assigned_class_ids,created_by&order=created_at.desc`,
          );
          assigned = all.filter(
            (p) =>
              p.created_by === user.id ||
              (Array.isArray(p.assigned_class_ids) && p.assigned_class_ids.some((id) => classIds.includes(id))),
          );
        } else {
          assigned = packs.filter((p) => p.created_by === user.id);
        }
        return Response.json({ packs: assigned }, { headers: CORS_HEADERS });
      }

      case "assign_pack": {
        const denied = assertTeacherAllowed(user);
        if (denied) return denied;
        const body = await req.json();
        const { pack_id, class_id } = body || {};
        if (!pack_id || !class_id) {
          return Response.json({ error: "pack_id and class_id required" }, { status: 400, headers: CORS_HEADERS });
        }
        if (!(await teacherOwnsClass(user.id, class_id))) {
          return Response.json({ error: "Класс не найден" }, { status: 404, headers: CORS_HEADERS });
        }
        const packs = await sbGet("school_questions", `id=eq.${pack_id}&select=*`);
        if (!packs.length) return Response.json({ error: "Пакет не найден" }, { status: 404, headers: CORS_HEADERS });
        const pack = packs[0];
        if (pack.created_by !== user.id && pack.tenant_id !== TENANT_ID) {
          return Response.json({ error: "Нет доступа" }, { status: 403, headers: CORS_HEADERS });
        }
        const ids = Array.isArray(pack.assigned_class_ids) ? [...pack.assigned_class_ids] : [];
        if (!ids.includes(class_id)) ids.push(class_id);
        const updated = await sbPatch("school_questions", `id=eq.${pack_id}`, { assigned_class_ids: ids });
        return Response.json({ pack: updated[0] || { ...pack, assigned_class_ids: ids } }, { headers: CORS_HEADERS });
      }

      case "get_pack": {
        const packId = url.searchParams.get("pack_id");
        if (!packId) return Response.json({ error: "pack_id required" }, { status: 400, headers: CORS_HEADERS });
        const packs = await sbGet("school_questions", `id=eq.${packId}&select=*`);
        if (!packs.length) return Response.json({ error: "Пакет не найден" }, { status: 404, headers: CORS_HEADERS });
        const pack = packs[0];
        // Teacher who created OR student in assigned class OR teacher of assigned class
        const isCreator = pack.created_by === user.id;
        let allowed = isCreator;
        if (!allowed) {
          const memberships = await sbGet("class_members", `student_id=eq.${user.id}&select=class_id`);
          const myClasses = memberships.map((m) => m.class_id);
          if (Array.isArray(pack.assigned_class_ids) && pack.assigned_class_ids.some((id) => myClasses.includes(id))) {
            allowed = true;
          }
        }
        if (!allowed) {
          const owned = await sbGet("classes", `teacher_id=eq.${user.id}&select=id`);
          const ownedIds = owned.map((c) => c.id);
          if (Array.isArray(pack.assigned_class_ids) && pack.assigned_class_ids.some((id) => ownedIds.includes(id))) {
            allowed = true;
          }
        }
        if (!allowed) return Response.json({ error: "Нет доступа" }, { status: 403, headers: CORS_HEADERS });
        return Response.json({ pack }, { headers: CORS_HEADERS });
      }

      case "get_assigned": {
        const memberships = await sbGet("class_members", `student_id=eq.${user.id}&select=class_id`);
        if (!memberships.length) return Response.json({ packs: [] }, { headers: CORS_HEADERS });
        const classIds = memberships.map((m) => m.class_id);
        const all = await sbGet(
          "school_questions",
          `tenant_id=eq.${encodeURIComponent(TENANT_ID)}&select=id,subject,title,created_at,assigned_class_ids&order=created_at.desc`,
        );
        const packs = all.filter(
          (p) => Array.isArray(p.assigned_class_ids) && p.assigned_class_ids.some((id) => classIds.includes(id)),
        );
        return Response.json({ packs }, { headers: CORS_HEADERS });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400, headers: CORS_HEADERS });
    }
  } catch (err) {
    console.error(`School content API error [${action}]:`, err);
    return Response.json({ error: "Произошла ошибка. Попробуйте позже." }, { status: 500, headers: CORS_HEADERS });
  }
}
