import { describe, it, expect } from 'vitest';
import { sanitizeMath, parseLooseJson } from '../utils/text.mjs';

describe('sanitizeMath', () => {
  it('drops $ / $$ math delimiters, keeping the inner content', () => {
    expect(sanitizeMath('итог $S_4 = 80$ готово')).toBe('итог S_4 = 80 готово');
    expect(sanitizeMath('$$x^2$$')).toBe('x^2');
  });
  it('converts common LaTeX commands to Unicode', () => {
    expect(sanitizeMath('F = m \\cdot a')).toBe('F = m · a');
    expect(sanitizeMath('\\frac{a}{b}')).toBe('(a)/(b)');
    expect(sanitizeMath('\\sqrt{2}')).toBe('√(2)');
    expect(sanitizeMath('\\text{скорость}')).toBe('скорость');
    expect(sanitizeMath('a \\times b \\div c \\approx d')).toBe('a × b ÷ c ≈ d');
  });
  it('removes \\( \\) \\[ \\] wrappers', () => {
    expect(sanitizeMath('\\(x\\)')).toBe('x');
  });
  it('is a no-op on plain text', () => {
    expect(sanitizeMath('Просто текст без формул')).toBe('Просто текст без формул');
  });
});

describe('parseLooseJson', () => {
  it('parses clean JSON', () => {
    expect(parseLooseJson('{"short":"a","detailed":"b"}')).toEqual({ short: 'a', detailed: 'b' });
  });
  it('strips ```json code fences', () => {
    expect(parseLooseJson('```json\n{"x":1}\n```')).toEqual({ x: 1 });
  });
  it('does NOT crash on single-backslash LaTeX (the physics blob bug)', () => {
    // The exact cert failure: \cdot is an invalid JSON escape that crashed JSON.parse.
    const raw = '{"short":"ответ 5","detailed":"F = m \\cdot a = 2 \\cdot 5 = 10"}';
    const out = parseLooseJson(raw);
    expect(out.short).toBe('ответ 5');
    expect(out.detailed).toBe('F = m · a = 2 · 5 = 10');
  });
  it('cleans $...$ and \\frac inside string values', () => {
    const raw = '{"detailed":"$S_n = \\frac{b_1(q^n-1)}{q-1}$"}';
    expect(parseLooseJson(raw).detailed).toBe('S_n = (b_1(q^n-1))/(q-1)');
  });
  it('preserves valid \\n newline escapes', () => {
    expect(parseLooseJson('{"detailed":"строка1\\nстрока2"}').detailed).toBe('строка1\nстрока2');
  });
  it('clips stray prose around the JSON object', () => {
    expect(parseLooseJson('Вот ответ: {"x":1} — готово')).toEqual({ x: 1 });
  });
  it('throws on genuinely malformed JSON (so callers retry)', () => {
    expect(() => parseLooseJson('{"x": ')).toThrow();
  });
});
