import { describe, it, expect } from 'vitest';
import { PROFILE_PAIRS, PROFILE_PARTNERS, ALL_PROFILES_BASE } from '../subjects';

// Pins the official ЕНТ profile-subject combinations that drive onboarding
// (ProfileSelect): after the first pick, only a subject's partners stay selectable.
describe('PROFILE_PAIRS / PROFILE_PARTNERS — official ЕНТ combinations', () => {
  const partners = (id: string) => [...(PROFILE_PARTNERS[id] ?? [])].sort();

  it('Математика pairs with Физика, Информатика, География', () => {
    expect(partners('math_profile')).toEqual(['geography', 'informatics', 'physics']);
  });

  it('Биология pairs with Химия, География', () => {
    expect(partners('biology')).toEqual(['chemistry', 'geography']);
  });

  it('Иностранный pairs with Всемирная история, География', () => {
    expect(partners('english')).toEqual(['geography', 'world_history']);
  });

  it('Всемирная история pairs with Иностранный, Основы права, География', () => {
    expect(partners('world_history')).toEqual(['english', 'geography', 'law']);
  });

  it('География is the hub — Математика, Биология, Иностранный, Всемирная история', () => {
    expect(partners('geography')).toEqual(['biology', 'english', 'math_profile', 'world_history']);
  });

  it('single-partner subjects', () => {
    expect(PROFILE_PARTNERS.physics).toEqual(['math_profile']);
    expect(PROFILE_PARTNERS.informatics).toEqual(['math_profile']);
    expect(PROFILE_PARTNERS.chemistry).toEqual(['biology']);
    expect(PROFILE_PARTNERS.law).toEqual(['world_history']);
  });

  it('every pair is symmetric', () => {
    for (const [a, b] of PROFILE_PAIRS) {
      expect(PROFILE_PARTNERS[a]).toContain(b);
      expect(PROFILE_PARTNERS[b]).toContain(a);
    }
  });

  it('the язык↔литература pair exists but both subjects are locked (available:false)', () => {
    expect(PROFILE_PARTNERS.native_lang).toEqual(['literature']);
    expect(PROFILE_PARTNERS.literature).toEqual(['native_lang']);
    const base = Object.fromEntries(ALL_PROFILES_BASE.map(p => [p.id, p.available]));
    expect(base.native_lang).toBe(false);
    expect(base.literature).toBe(false);
  });

  it('every subject in a pair exists in ALL_PROFILES_BASE', () => {
    const ids = new Set(ALL_PROFILES_BASE.map(p => p.id));
    for (const [a, b] of PROFILE_PAIRS) {
      expect(ids.has(a)).toBe(true);
      expect(ids.has(b)).toBe(true);
    }
  });
});
