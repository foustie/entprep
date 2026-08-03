import { Capacitor } from '@capacitor/core';
import { TENANT } from './tenant';

/** Public site URL — tenant override for school WL builds. */
export const APP_URL = TENANT.appUrl || 'https://entprep.org';

/** Prefix for Netlify function calls — empty on web, full URL in native app */
export const API_BASE = Capacitor.isNativePlatform() ? APP_URL : '';

export const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "")
  .split(",").map((e: string) => e.trim()).filter(Boolean);

/**
 * Teacher role allowlist (WL school MVP). Empty = backward-compat: any signed-in
 * user can create a class + sees the teacher entry in Settings. Non-empty = only
 * these emails get teacher access. Mirrors the server-side TEACHER_EMAILS gate in
 * netlify/functions/teacher.mjs (create_class enforces the real restriction —
 * this is only used to decide whether to show the UI entry point).
 */
export const TEACHER_EMAILS = (import.meta.env.VITE_TEACHER_EMAILS || "")
  .split(",").map((e: string) => e.trim().toLowerCase()).filter(Boolean);
