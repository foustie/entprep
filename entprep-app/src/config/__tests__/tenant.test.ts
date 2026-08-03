import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// tenant.ts reads import.meta.env at module load — re-import per case via dynamic import
// after stubbing env is awkward with Vite. Instead we unit-test the pure helpers by
// re-evaluating through a thin re-export pattern: test emailMatchesSchoolDomain /
// isSchoolSeat against the live TENANT, and document env contract separately.

describe('tenant helpers (retail default build)', () => {
  it('exports TENANT with retail defaults when no school env', async () => {
    const { TENANT, isSchoolTenant } = await import('../tenant');
    // In CI/dev without VITE_TENANT_MODE=school, mode is retail
    if (!isSchoolTenant()) {
      expect(TENANT.id).toBe('entprep');
      expect(TENANT.name).toBe('ENTprep');
      expect(TENANT.hidePaywall).toBe(false);
      expect(TENANT.schoolSeatsAll).toBe(false);
    }
  });

  it('emailMatchesSchoolDomain is false when domain unset', async () => {
    const { emailMatchesSchoolDomain, TENANT } = await import('../tenant');
    if (!TENANT.schoolEmailDomain) {
      expect(emailMatchesSchoolDomain('a@school125.kz')).toBe(false);
      expect(emailMatchesSchoolDomain(null)).toBe(false);
    }
  });

  it('isSchoolSeat is false on retail', async () => {
    const { isSchoolSeat, isSchoolTenant } = await import('../tenant');
    if (!isSchoolTenant()) {
      expect(isSchoolSeat({ email: 'x@y.z', inSchoolClass: true })).toBe(false);
    }
  });
});

describe('tenantAccentCss', () => {
  it('returns empty string for default retail accent', async () => {
    const { tenantAccentCss, isSchoolTenant, TENANT } = await import('../tenant');
    if (!isSchoolTenant() && TENANT.accent === '#FF5A36') {
      expect(tenantAccentCss()).toBe('');
    }
  });
});
