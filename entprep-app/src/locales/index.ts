import { useApp } from '../contexts/AppContext';
import { isSchoolTenant, TENANT } from '../config/tenant';
import ru from './ru';
import kk from './kk';

const locales = { ru, kk } as const;

type LocaleBundle = typeof ru | typeof kk;

/** Replace retail ENTprep branding in locale strings for school builds. */
function applyTenantBrand(obj: LocaleBundle): LocaleBundle {
  const brand = TENANT.name;
  const walk = (val: unknown): unknown => {
    if (typeof val === 'string') {
      return val
        .replace(/\bENTprep PRO\b/g, brand)
        .replace(/\bENTprep Premium\b/g, brand)
        .replace(/\bENTprep\b/g, brand);
    }
    if (Array.isArray(val)) return val.map(walk);
    if (val && typeof val === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val)) out[k] = walk(v);
      return out;
    }
    return val;
  };
  return walk(obj) as LocaleBundle;
}

const brandedCache: Partial<Record<'ru' | 'kk', LocaleBundle>> = {};

function getLocale(lang: 'ru' | 'kk'): LocaleBundle {
  if (!isSchoolTenant()) return locales[lang];
  if (!brandedCache[lang]) brandedCache[lang] = applyTenantBrand(locales[lang]);
  return brandedCache[lang]!;
}

/** Use inside React components */
export function useT() {
  const { st } = useApp();
  return getLocale(st.lang || 'ru');
}

/** Use outside React (config files, utils, Netlify functions) */
export function getT(lang: 'ru' | 'kk' = 'ru') {
  return getLocale(lang);
}

export type { Translations } from './ru';
