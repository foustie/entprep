import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the AI adapter so we can drive callAI / aiConfigured per test. verifyAuth is
// exercised for real via a mocked global.fetch (it hits the Supabase /auth/v1/user
// endpoint); the in-memory rate limiter in shared.mjs is left REAL so we can assert
// real 429 behavior.
const ai = vi.hoisted(() => ({ callAI: vi.fn(), aiConfigured: vi.fn(() => true) }));
vi.mock("../utils/ai.mjs", () => ({ callAI: ai.callAI, aiConfigured: ai.aiConfigured }));

import handler, {
  validateFocusInput,
  buildFocusMessages,
  parseFocusResponse,
  chunkWeeks,
  mergeFocusResponses,
  mergeFocusIntoWeeks,
  MAX_WEEKS_PER_CALL,
} from "../study-plan-focus.mjs";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeWeeks = (n) =>
  Array.from({ length: n }, (_, i) => ({
    weekNum: i + 1,
    phase: i < 2 ? "foundation" : i < 4 ? "build" : "review",
    subjects: ["math", "physics"],
    topics: ["algebra"],
  }));

const baseBody = (over = {}) => ({
  lang: "ru",
  target: 120,
  examDate: "2026-08-01",
  weeks: makeWeeks(4),
  weak: [{ name: "Математика", avg: 40, pct: 60, trend: "declining" }],
  strong: [{ name: "История", avg: 85 }],
  ...over,
});

let userId = "user-1";
const aiResponse = (weeks) => ({ ok: true, status: 200, text: JSON.stringify({ weeks }) });

function makeReq(body, { method = "POST", auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) headers.Authorization = "Bearer test-token";
  return new Request("https://entprep.org/api/study-plan-focus", {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  ai.callAI.mockReset();
  ai.aiConfigured.mockReset();
  ai.aiConfigured.mockReturnValue(true);
  process.env.VITE_SUPABASE_URL = "https://stub.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "anon";
  // verifyAuth → returns { id: userId } for the /auth/v1/user lookup.
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes("/auth/v1/user")) {
      return new Response(JSON.stringify({ id: userId }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ── Prompt building ────────────────────────────────────────────────────────────

describe("buildFocusMessages — input serialization", () => {
  it("includes lang/target/examDate/weeks/weak/strong in the prompt", () => {
    const { system, user } = buildFocusMessages(baseBody());
    expect(system).toMatch(/репетитор/i);
    expect(user).toContain("120"); // target
    expect(user).toContain("2026-08-01"); // examDate
    expect(user).toContain("Математика"); // weak subject
    expect(user).toContain("История"); // strong subject
    expect(user).toContain("Неделя 1"); // serialized weeks
    expect(user).toContain("падает"); // declining trend translated (ru)
  });

  it("switches to Kazakh system/user text when lang=kk", () => {
    const { system, user } = buildFocusMessages(baseBody({ lang: "kk" }));
    expect(system).toMatch(/репетиторысың/);
    expect(user).toContain("Апта 1");
  });

  it("strips structural/injection chars from user-provided names", () => {
    const { user } = buildFocusMessages(baseBody({ weak: [{ name: "Math {evil} <x>", avg: 10, pct: 90, trend: "stable" }] }));
    expect(user).not.toContain("{evil}");
    expect(user).not.toContain("<x>");
    expect(user).toContain("Math evil x");
  });
});

// ── Parse / validate (sanitizeMath + parseLooseJson) ───────────────────────────

describe("parseFocusResponse", () => {
  it("parses a clean minified response into normalized weeks/tips", () => {
    const out = parseFocusResponse(
      '{"weeks":[{"weekNum":1,"focus":"Сфокусируйся на алгебре.","tips":[{"text":"Решить 10 задач"},{"text":"Повторить формулы"}]}]}',
    );
    expect(out.weeks).toHaveLength(1);
    expect(out.weeks[0].weekNum).toBe(1);
    expect(out.weeks[0].focus).toBe("Сфокусируйся на алгебре.");
    expect(out.weeks[0].tips).toEqual([
      { text: "Решить 10 задач", subject: null, topic: null },
      { text: "Повторить формулы", subject: null, topic: null },
    ]);
  });

  it("cleans leaked LaTeX/markdown/$ delimiters and code fences", () => {
    // Single-backslash LaTeX is the realistic Qwen failure mode (invalid JSON
    // escapes that parseLooseJson/sanitizeMath repair before JSON.parse).
    const dirty =
      '```json\n{"weeks":[{"weekNum":2,"focus":"Реши $x = \\frac{1}{2}$ и упрости","tips":[{"text":"### Дроби \\cdot практика"}]}]}\n```';
    const out = parseFocusResponse(dirty);
    expect(out.weeks[0].focus).toContain("(1)/(2)"); // \frac → (1)/(2)
    expect(out.weeks[0].focus).not.toContain("$");
    expect(out.weeks[0].tips[0].text).not.toContain("###");
    expect(out.weeks[0].tips[0].text).toContain("·"); // \cdot → ·
  });

  it("accepts string tips (not just {text}) and drops empty ones", () => {
    const out = parseFocusResponse('{"weeks":[{"weekNum":1,"focus":"x","tips":["Сделать тест","",null]}]}');
    expect(out.weeks[0].tips).toEqual([{ text: "Сделать тест", subject: null, topic: null }]);
  });

  it("throws on malformed JSON (so the caller can retry)", () => {
    expect(() => parseFocusResponse("not json at all")).toThrow();
  });

  it("throws when the shape lacks a weeks array", () => {
    expect(() => parseFocusResponse('{"foo":1}')).toThrow();
  });
});

// ── Validation ─────────────────────────────────────────────────────────────────

describe("validateFocusInput", () => {
  it("accepts a well-formed body", () => {
    expect(validateFocusInput(baseBody())).toBeNull();
  });
  it("rejects bad lang/target/examDate/weeks", () => {
    expect(validateFocusInput(baseBody({ lang: "en" }))).toMatch(/lang/);
    expect(validateFocusInput(baseBody({ target: 200 }))).toMatch(/target/);
    expect(validateFocusInput(baseBody({ examDate: "08/2026" }))).toMatch(/examDate/);
    expect(validateFocusInput(baseBody({ weeks: makeWeeks(1) }))).toMatch(/weeks/);
    expect(validateFocusInput(baseBody({ weeks: [{ weekNum: 1, phase: "x", subjects: [], topics: [] }, { weekNum: 2, phase: "build", subjects: [], topics: [] }] }))).toMatch(/phase/);
  });
});

// ── Chunking ───────────────────────────────────────────────────────────────────

describe("chunkWeeks", () => {
  it("returns a single batch when weeks <= MAX_WEEKS_PER_CALL", () => {
    expect(chunkWeeks(makeWeeks(14))).toHaveLength(1);
    expect(MAX_WEEKS_PER_CALL).toBe(14);
  });
  it("splits 16 weeks into 2 balanced batches, each <= 14", () => {
    const batches = chunkWeeks(makeWeeks(16));
    expect(batches).toHaveLength(2);
    expect(batches.every((b) => b.length <= 14)).toBe(true);
    expect(batches.reduce((n, b) => n + b.length, 0)).toBe(16);
  });
  it("splits 26 weeks into batches each <= 14", () => {
    const batches = chunkWeeks(makeWeeks(26));
    expect(batches.every((b) => b.length <= 14)).toBe(true);
    expect(batches.reduce((n, b) => n + b.length, 0)).toBe(26);
  });
});

// ── Merge helpers ──────────────────────────────────────────────────────────────

describe("mergeFocusResponses", () => {
  it("concatenates batches and sorts by weekNum (first wins on dup)", () => {
    const merged = mergeFocusResponses([
      { weeks: [{ weekNum: 2, focus: "b", tips: [] }, { weekNum: 1, focus: "a", tips: [] }] },
      { weeks: [{ weekNum: 3, focus: "c", tips: [] }] },
    ]);
    expect(merged.weeks.map((w) => w.weekNum)).toEqual([1, 2, 3]);
  });
});

describe("mergeFocusIntoWeeks — client merge contract", () => {
  it("sets Week.focus and prepends tip StudyTasks at week.tasks[0+]", () => {
    const planWeeks = [
      { weekNum: 1, startDate: "2026-06-29", tasks: [{ id: "week_1_0", type: "practice" }] },
      { weekNum: 2, startDate: "2026-07-06", tasks: [{ id: "week_2_0", type: "lesson" }] },
    ];
    const focusWeeks = [{ weekNum: 1, focus: "Алгебра", tips: [{ text: "Решить 10 задач" }, { text: "Формулы" }] }];
    const out = mergeFocusIntoWeeks(planWeeks, focusWeeks);

    expect(out[0].focus).toBe("Алгебра");
    expect(out[0].tasks[0]).toEqual({
      id: "week_1_tip_0",
      date: "2026-06-29",
      type: "tip",
      subject: undefined,
      topic: undefined,
      title: "Решить 10 задач",
      durationMin: 3,
      premium: false,
    });
    expect(out[0].tasks[1].id).toBe("week_1_tip_1");
    expect(out[0].tasks[2].id).toBe("week_1_0"); // original task preserved after tips
    // Week without a matching focus entry is untouched.
    expect(out[1].focus).toBeUndefined();
    expect(out[1].tasks).toHaveLength(1);
  });
});

// ── Handler: graceful fallback, retry, rate limit, chunking ─────────────────────

describe("handler — graceful fallback", () => {
  it("returns { weeks: [] } status 200 when AI is not configured (never blocks)", async () => {
    ai.aiConfigured.mockReturnValue(false);
    userId = "user-noai";
    const res = await handler(makeReq(baseBody()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ weeks: [] });
    expect(ai.callAI).not.toHaveBeenCalled();
  });

  it("retries once on AI failure, then returns { weeks: [] } status 200", async () => {
    ai.callAI.mockResolvedValue({ ok: false, status: 503, text: "", errorText: "down" });
    userId = "user-fail";
    const res = await handler(makeReq(baseBody()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ weeks: [] });
    expect(ai.callAI).toHaveBeenCalledTimes(2); // initial + one retry
  });

  it("retries once on malformed JSON, succeeding on the second attempt", async () => {
    userId = "user-retry";
    ai.callAI
      .mockResolvedValueOnce({ ok: true, status: 200, text: "garbage{" })
      .mockResolvedValueOnce(aiResponse([{ weekNum: 1, focus: "ok", tips: [{ text: "do" }] }]));
    const res = await handler(makeReq(baseBody()));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.weeks[0].focus).toBe("ok");
    expect(ai.callAI).toHaveBeenCalledTimes(2);
  });
});

describe("handler — auth", () => {
  it("401 when no bearer token", async () => {
    const res = await handler(makeReq(baseBody(), { auth: false }));
    expect(res.status).toBe(401);
  });
});

describe("handler — validation", () => {
  it("400 on invalid input", async () => {
    userId = "user-bad";
    const res = await handler(makeReq(baseBody({ target: 999 })));
    expect(res.status).toBe(400);
  });
});

describe("handler — rate limit", () => {
  it("allows 5 calls / 60s then 429s the 6th with Retry-After", async () => {
    userId = "user-rate"; // dedicated bucket so other tests don't consume it
    ai.callAI.mockResolvedValue(aiResponse([{ weekNum: 1, focus: "f", tips: [] }]));
    for (let i = 0; i < 5; i++) {
      const ok = await handler(makeReq(baseBody()));
      expect(ok.status).toBe(200);
    }
    const blocked = await handler(makeReq(baseBody()));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });
});

describe("handler — chunking", () => {
  it("makes 2 AI calls for a 16-week plan and merges the responses", async () => {
    userId = "user-chunk";
    ai.callAI
      .mockResolvedValueOnce(aiResponse([{ weekNum: 1, focus: "a", tips: [{ text: "t1" }] }]))
      .mockResolvedValueOnce(aiResponse([{ weekNum: 9, focus: "b", tips: [{ text: "t2" }] }]));
    const res = await handler(makeReq(baseBody({ weeks: makeWeeks(16) })));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(ai.callAI).toHaveBeenCalledTimes(2);
    expect(data.weeks.map((w) => w.weekNum)).toEqual([1, 9]);
  });

  it("emits minified single-line JSON (no pretty-printing)", async () => {
    userId = "user-min";
    ai.callAI.mockResolvedValue(aiResponse([{ weekNum: 1, focus: "f", tips: [{ text: "t" }] }]));
    const res = await handler(makeReq(baseBody()));
    const body = await res.text();
    expect(body).not.toContain("\n");
    expect(body.startsWith("{")).toBe(true);
  });
});
