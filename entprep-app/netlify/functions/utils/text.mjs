/**
 * Text robustness helpers for LLM (Qwen) output.
 *
 * Qwen does NOT reliably honor "no markdown / no LaTeX" instructions. It leaks
 * `$...$`, `\frac{a}{b}`, `\cdot`, etc. into JSON string values. Two problems:
 *   1. A lone backslash (`\cdot`) is an INVALID JSON escape → JSON.parse throws →
 *      callers fall back to showing the raw `{"short":...}` blob to the student.
 *   2. Even when it parses, `$...$` / `\frac` render as literal broken text in-app.
 *
 * sanitizeMath() converts the leaked LaTeX into plain readable Unicode and drops
 * `$` delimiters. parseLooseJson() runs it on the RAW string before parsing (which
 * also removes the crash-causing backslashes), then escapes any residual lone
 * backslash, then JSON.parse.
 */

// Convert leaked LaTeX/markdown math to plain Unicode. Safe to run on a raw JSON
// string: these patterns only ever appear inside string values, never in JSON
// structure (objects use bare `{`, not `\frac{`).
export function sanitizeMath(s) {
  return String(s == null ? "" : s)
    .replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)")
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)")
    .replace(/\\text(?:bf|it|rm)?\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\cdot\b/g, "·")
    .replace(/\\times\b/g, "×")
    .replace(/\\div\b/g, "÷")
    .replace(/\\pm\b/g, "±")
    .replace(/\\approx\b/g, "≈")
    .replace(/\\(?:rightarrow|to)\b/g, "→")
    .replace(/\\(?:leq|le)\b/g, "≤")
    .replace(/\\(?:geq|ge)\b/g, "≥")
    .replace(/\\neq\b/g, "≠")
    .replace(/\\(?:left|right|displaystyle|quad|qquad|,|;|!)\b/g, "")
    .replace(/\\[()[\]]/g, "")   // \( \) \[ \]
    .replace(/\$\$?/g, "")        // $ and $$ math delimiters
    .replace(/[ \t]{2,}/g, " ");
}

// Parse JSON from an LLM response defensively: strip code fences, clip to the
// outermost {...}, sanitize leaked LaTeX (also removes the lone backslashes that
// would crash the parse), escape any remaining lone backslash, then JSON.parse.
// Throws on genuinely malformed JSON so callers can retry / fall back.
export function parseLooseJson(raw) {
  let s = String(raw || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const first = s.indexOf("{"), last = s.lastIndexOf("}");
  if (first >= 0 && last > first) s = s.slice(first, last + 1);
  s = sanitizeMath(s);
  // Escape any backslash that is NOT a valid JSON escape (e.g. a stray \alpha).
  s = s.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
  return JSON.parse(s);
}
