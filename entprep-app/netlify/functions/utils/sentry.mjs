// OPS-2 — error reporting for Netlify Functions.
//
// Functions had ZERO error reporting: a failing payment webhook returned 500 and
// vanished (you'd hear about it from angry users, not an alert). captureFunctionError
// sends caught errors to Sentry. It is a no-op unless SENTRY_DSN_FUNCTIONS is set,
// inits lazily once per cold start, and NEVER throws — error reporting must not be
// able to break the function it is reporting from.

import * as Sentry from "@sentry/node";

let initState = null; // null = unchecked, false = no DSN / failed, true = ready

function ready() {
  if (initState !== null) return initState;
  const dsn = process.env.SENTRY_DSN_FUNCTIONS;
  if (!dsn) { initState = false; return false; }
  try {
    Sentry.init({
      dsn,
      environment: process.env.CONTEXT || "production", // Netlify sets CONTEXT (production/deploy-preview/branch-deploy)
      tracesSampleRate: 0, // errors only — no performance tracing
    });
    initState = true;
  } catch {
    initState = false;
  }
  return initState;
}

/**
 * Report a caught error from a Netlify Function. Safe to call unconditionally:
 * no-ops without SENTRY_DSN_FUNCTIONS and never throws.
 * @param {unknown} err     the caught error
 * @param {Record<string, unknown>} [context]  e.g. { fn: "lemon-webhook", event: "..." }
 */
export function captureFunctionError(err, context = {}) {
  try {
    if (!ready()) return;
    Sentry.captureException(err, { extra: context });
  } catch {
    /* swallow — reporting must never break the caller */
  }
}
