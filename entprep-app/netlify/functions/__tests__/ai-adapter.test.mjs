import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { aiProvider, aiConfigured, buildAIRequest, extractAIText } from '../utils/ai.mjs';

// Env keys the adapter reads at call time. Snapshot + restore so tests don't leak.
const ENV_KEYS = ['AI_PROVIDER', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'ANTHROPIC_API_KEY', 'AI_MODEL_OVERRIDE'];
let saved;

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
});
afterEach(() => {
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

const CHAT = {
  system: 'You are a tutor.',
  messages: [{ role: 'user', content: 'hi' }],
  max_tokens: 500,
  temperature: 0.7,
};

describe('aiProvider', () => {
  it('defaults to openrouter (compiled default) when AI_PROVIDER is unset', () => {
    expect(aiProvider()).toBe('openrouter');
  });
  it('honors the AI_PROVIDER env override and lowercases it', () => {
    process.env.AI_PROVIDER = 'Anthropic';
    expect(aiProvider()).toBe('anthropic');
  });
});

describe('aiConfigured', () => {
  it('openrouter: true only when OPENROUTER_API_KEY is set', () => {
    expect(aiConfigured()).toBe(false);
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    expect(aiConfigured()).toBe(true);
  });
  it('anthropic: true only when ANTHROPIC_API_KEY is set', () => {
    process.env.AI_PROVIDER = 'anthropic';
    expect(aiConfigured()).toBe(false);
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect(aiConfigured()).toBe(true);
    // an OpenRouter key must NOT satisfy the anthropic provider
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    expect(aiConfigured()).toBe(false);
  });
});

describe('buildAIRequest — OpenRouter (default)', () => {
  beforeEach(() => { process.env.OPENROUTER_API_KEY = 'sk-or-test'; });

  it('targets the OpenAI-compatible endpoint with Bearer auth', () => {
    const { url, headers } = buildAIRequest(CHAT);
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(headers.Authorization).toBe('Bearer sk-or-test');
    expect(headers['x-api-key']).toBeUndefined();
    expect(headers['anthropic-version']).toBeUndefined();
  });

  it('folds the system prompt into messages as the first system message (no top-level system)', () => {
    const { body } = buildAIRequest(CHAT);
    expect(body.system).toBeUndefined();
    expect(body.messages[0]).toEqual({ role: 'system', content: 'You are a tutor.' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'hi' });
    expect(body.max_tokens).toBe(500);
    expect(body.temperature).toBe(0.7);
  });

  it('omits the system message when no system prompt is given', () => {
    const { body } = buildAIRequest({ ...CHAT, system: undefined });
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('user');
  });

  it('defaults the model to qwen/qwen3.7-plus and honors OPENROUTER_MODEL', () => {
    expect(buildAIRequest(CHAT).body.model).toBe('qwen/qwen3.7-plus');
    process.env.OPENROUTER_MODEL = 'qwen/qwen3.7-max';
    expect(buildAIRequest(CHAT).body.model).toBe('qwen/qwen3.7-max');
  });

  it('adds stream:true only when requested', () => {
    expect(buildAIRequest(CHAT).body.stream).toBeUndefined();
    expect(buildAIRequest({ ...CHAT, stream: true }).body.stream).toBe(true);
  });
});

describe('buildAIRequest — Anthropic (rollback)', () => {
  beforeEach(() => { process.env.AI_PROVIDER = 'anthropic'; process.env.ANTHROPIC_API_KEY = 'sk-ant-test'; });

  it('targets the Messages endpoint with x-api-key + version headers', () => {
    const { url, headers } = buildAIRequest(CHAT);
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers.Authorization).toBeUndefined();
  });

  it('keeps system as a top-level field and leaves messages untouched', () => {
    const { body } = buildAIRequest(CHAT);
    expect(body.system).toBe('You are a tutor.');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(body.model).toBe('claude-sonnet-4-20250514');
  });

  it('honors AI_MODEL_OVERRIDE', () => {
    process.env.AI_MODEL_OVERRIDE = 'claude-haiku-4-5-20251001';
    expect(buildAIRequest(CHAT).body.model).toBe('claude-haiku-4-5-20251001');
  });
});

describe('extractAIText', () => {
  it('reads the OpenAI / OpenRouter shape', () => {
    expect(extractAIText({ choices: [{ message: { content: '  hello  ' } }] })).toBe('hello');
  });
  it('reads the Anthropic shape', () => {
    expect(extractAIText({ content: [{ text: '  world  ' }] })).toBe('world');
  });
  it('returns empty string for missing / malformed payloads', () => {
    expect(extractAIText({})).toBe('');
    expect(extractAIText(null)).toBe('');
    expect(extractAIText({ choices: [] })).toBe('');
  });
});
