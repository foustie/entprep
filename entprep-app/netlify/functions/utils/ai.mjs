/**
 * AI provider adapter for runtime Netlify Functions.
 *
 * One place that knows how to talk to either provider, so the AI functions
 * (ai-explain, ai-generate, ai-tutor, study-plan-focus) stay provider-agnostic.
 *
 * Provider is chosen at RUNTIME from the AI_PROVIDER env var (falls back to the
 * AI_PROVIDER constant). This means switching providers — or rolling back to
 * Claude if Qwen quality disappoints — is an env-var flip, not a code change:
 *
 *   AI_PROVIDER=openrouter   (default) → OpenRouter, OpenAI-compatible Chat API
 *   AI_PROVIDER=anthropic              → Anthropic Messages API
 *
 * Required env per provider:
 *   openrouter → OPENROUTER_API_KEY   (model override: OPENROUTER_MODEL)
 *   anthropic  → ANTHROPIC_API_KEY    (model override: AI_MODEL_OVERRIDE)
 */

import {
  AI_PROVIDER,
  AI_MODEL,
  ANTHROPIC_API_URL,
  OPENROUTER_API_URL,
  OPENROUTER_MODEL,
} from "./constants.mjs";

const SITE_URL = process.env.URL || "https://entprep.org";

/** Active provider id, lowercased. Env wins over the compiled default. */
export function aiProvider() {
  return (process.env.AI_PROVIDER || AI_PROVIDER || "anthropic").toLowerCase();
}

/** True when the active provider has its API key configured. */
export function aiConfigured() {
  return aiProvider() === "openrouter"
    ? !!process.env.OPENROUTER_API_KEY
    : !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Build a provider-specific fetch request (url + headers + body object) for a
 * chat-style completion. Anthropic takes `system` as a top-level field; the
 * OpenAI/OpenRouter shape folds it into the messages array as a system message.
 */
export function buildAIRequest({ system, messages, max_tokens, temperature, stream = false }) {
  if (aiProvider() === "openrouter") {
    const msgs = system ? [{ role: "system", content: system }, ...messages] : messages;
    return {
      url: OPENROUTER_API_URL,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        // Optional OpenRouter attribution headers (analytics / rankings).
        "HTTP-Referer": SITE_URL,
        "X-Title": "ENTprep",
      },
      body: {
        model: process.env.OPENROUTER_MODEL || OPENROUTER_MODEL,
        max_tokens,
        temperature,
        // Qwen3.7-plus is a reasoning model. Left on, it burns ~1500+ hidden
        // reasoning tokens per call (~10x cost + latency, uncapped by max_tokens)
        // and drifts to English on RU/KK prompts. These short explain / plan /
        // generate / tutor tasks don't need it — the prompts already carry their
        // own step-by-step instructions — so disable reasoning. Re-enable per call
        // by setting OPENROUTER_REASONING=1 if a future task genuinely needs it.
        ...(process.env.OPENROUTER_REASONING === "1" ? {} : { reasoning: { enabled: false } }),
        ...(stream ? { stream: true } : {}),
        messages: msgs,
      },
    };
  }

  // Anthropic (fallback / rollback provider)
  return {
    url: ANTHROPIC_API_URL,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: {
      model: process.env.AI_MODEL_OVERRIDE || AI_MODEL,
      max_tokens,
      temperature,
      ...(stream ? { stream: true } : {}),
      system,
      messages,
    },
  };
}

/** Pull the assistant text out of a non-streaming response from either provider. */
export function extractAIText(data) {
  // OpenAI / OpenRouter shape
  const openai = data?.choices?.[0]?.message?.content;
  if (openai != null) return String(openai).trim();
  // Anthropic shape
  const anthropic = data?.content?.[0]?.text;
  if (anthropic != null) return String(anthropic).trim();
  return "";
}

/**
 * One-shot, non-streaming completion against the active provider.
 * Returns { ok, status, text, errorText } — callers keep their own error UX.
 * fetch() does not reject on 4xx/5xx, so `ok` mirrors res.ok.
 */
export async function callAI({ system, messages, max_tokens, temperature, signal }) {
  const { url, headers, body } = buildAIRequest({ system, messages, max_tokens, temperature });
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    return { ok: false, status: res.status, text: "", errorText };
  }

  const data = await res.json();
  return { ok: true, status: res.status, text: extractAIText(data) };
}
