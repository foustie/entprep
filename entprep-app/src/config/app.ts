export const APP_URL = 'https://entprep.org';

export const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "")
  .split(",").map((e: string) => e.trim()).filter(Boolean);
