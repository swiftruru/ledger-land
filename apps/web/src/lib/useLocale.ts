import { useLocation } from 'react-router';
import { localeFromPath, localePath, type Locale } from '@ledgerland/i18n';

export function useLocale(): Locale {
  return localeFromPath(useLocation().pathname);
}

/** 站內連結：一律帶結尾斜線，英文由 localePath() 產生（05 第 7.5 節） */
export function useHref(path: string): string {
  return localePath(useLocale(), path);
}
