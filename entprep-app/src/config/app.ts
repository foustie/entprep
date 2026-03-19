import { Capacitor } from '@capacitor/core';

export const APP_URL = 'https://entprep.org';

/** Prefix for Netlify function calls — empty on web, full URL in native app */
export const API_BASE = Capacitor.isNativePlatform() ? APP_URL : '';

export const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "")
  .split(",").map((e: string) => e.trim()).filter(Boolean);
