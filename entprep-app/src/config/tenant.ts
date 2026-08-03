/**
 * Single-tenant white-label config (school-125 MVP).
 * Build-time only — set VITE_TENANT_* at build/deploy. Default = retail ENTprep.
 */

function env(key: string, fallback = ''): string {
  const v = (import.meta.env as Record<string, string | undefined>)[key];
  return (v ?? fallback).trim();
}

function envBool(key: string, fallback = false): boolean {
  const v = env(key).toLowerCase();
  if (!v) return fallback;
  return v === '1' || v === 'true' || v === 'yes';
}

function envInt(key: string, fallback: number): number {
  const n = Number(env(key));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export type TenantMode = 'retail' | 'school';

export interface TenantConfig {
  /** Stable id for DB rows (e.g. '125'). Retail = 'entprep'. */
  id: string;
  mode: TenantMode;
  /** Full product name shown in UI */
  name: string;
  /** Short label for PWA / tab */
  shortName: string;
  /** Primary accent (CTA / streak). Hex. */
  accent: string;
  logoUrl: string;
  faviconUrl: string;
  appUrl: string;
  /** Skip retail Landing for school builds */
  hideMarketingLanding: boolean;
  /** Hide Lemon/RC upgrade CTAs */
  hidePaywall: boolean;
  /**
   * When true on a school build, every signed-in user is a licensed seat
   * (closed school deployment). Prefer this for MVP until invite/domain is wired.
   */
  schoolSeatsAll: boolean;
  /** Optional email domain → seat (e.g. school125.kz). Empty = disabled. */
  schoolEmailDomain: string;
  /** Monthly AI tutor message cap per user on school builds (0 = use retail unlimited-for-premium). */
  aiMonthlyCapPerUser: number;
  /** Wordmark: left segment (e.g. "Школа") */
  wordmarkPrimary: string;
  /** Wordmark: accent segment (e.g. " 125") — may be empty */
  wordmarkAccent: string;
}

function resolveMode(): TenantMode {
  const raw = env('VITE_TENANT_MODE', 'retail').toLowerCase();
  if (raw === 'school') return 'school';
  return 'retail';
}

export const TENANT: TenantConfig = (() => {
  const mode = resolveMode();
  const isSchool = mode === 'school';
  const id = env('VITE_TENANT_ID', isSchool ? '125' : 'entprep') || (isSchool ? '125' : 'entprep');
  const name = env('VITE_TENANT_NAME', isSchool ? 'Школа 125' : 'ENTprep');
  const shortName = env('VITE_TENANT_SHORT_NAME', isSchool ? 'Школа 125' : 'ENTprep');
  const accent = env('VITE_TENANT_ACCENT', isSchool ? '#F5C518' : '#FF5A36') || (isSchool ? '#F5C518' : '#FF5A36');
  const logoUrl = env('VITE_TENANT_LOGO', isSchool ? '/tenant/125-crest.png' : '/favicon.svg')
    || (isSchool ? '/tenant/125-crest.png' : '/favicon.svg');
  const faviconUrl = env('VITE_TENANT_FAVICON', isSchool ? '/tenant/125-favicon.png' : logoUrl)
    || (isSchool ? '/tenant/125-favicon.png' : logoUrl);
  const appUrl = env('VITE_APP_URL', isSchool ? '' : 'https://entprep.org') || (isSchool ? '' : 'https://entprep.org');

  // School default: hide retail marketing + paywall; seats-all until domain/class wired.
  const hideMarketingLanding = envBool('VITE_TENANT_HIDE_LANDING', isSchool);
  const hidePaywall = envBool('VITE_TENANT_HIDE_PAYWALL', isSchool);
  const schoolSeatsAll = envBool('VITE_SCHOOL_SEATS_ALL', isSchool);
  const schoolEmailDomain = env('VITE_SCHOOL_EMAIL_DOMAIN').toLowerCase();
  const aiMonthlyCapPerUser = envInt('VITE_AI_MONTHLY_CAP', isSchool ? 300 : 0);

  let wordmarkPrimary = env('VITE_TENANT_WORDMARK_PRIMARY');
  let wordmarkAccent = env('VITE_TENANT_WORDMARK_ACCENT');
  if (!wordmarkPrimary) {
    if (isSchool) {
      wordmarkPrimary = name;
      wordmarkAccent = '';
    } else {
      wordmarkPrimary = 'ENT';
      wordmarkAccent = 'prep.';
    }
  }

  return {
    id,
    mode,
    name,
    shortName,
    accent,
    logoUrl,
    faviconUrl,
    appUrl,
    hideMarketingLanding,
    hidePaywall,
    schoolSeatsAll,
    schoolEmailDomain,
    aiMonthlyCapPerUser,
    wordmarkPrimary,
    wordmarkAccent,
  };
})();

export function isSchoolTenant(): boolean {
  return TENANT.mode === 'school';
}

/** Email domain seat check (no network). */
export function emailMatchesSchoolDomain(email: string | null | undefined): boolean {
  const domain = TENANT.schoolEmailDomain;
  if (!domain || !email) return false;
  const at = email.toLowerCase().lastIndexOf('@');
  if (at < 0) return false;
  return email.toLowerCase().slice(at + 1) === domain;
}

/**
 * Whether this signed-in user should get school premium override.
 * Class membership is passed in when known (AuthContext loads it async).
 */
export function isSchoolSeat(args: {
  email?: string | null;
  inSchoolClass?: boolean;
}): boolean {
  if (!isSchoolTenant()) return false;
  if (TENANT.schoolSeatsAll) return true;
  if (emailMatchesSchoolDomain(args.email)) return true;
  if (args.inSchoolClass) return true;
  return false;
}

/** CSS custom properties for school accent override (inject alongside theme). */
export function tenantAccentCss(): string {
  if (!isSchoolTenant() && TENANT.accent === '#FF5A36') return '';
  const a = TENANT.accent;
  // Soft tints derived naively — good enough for MVP shell
  return [
    `--tenant-accent:${a}`,
    `--text-streak:${a}`,
  ].join(';');
}
