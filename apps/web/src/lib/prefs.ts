// 裝置偏好（06 第 4.1 節、16 第 7 節）：只存在 localStorage，不進 IndexedDB、不隨備份匯入
export type ThemePref = 'system' | 'light' | 'dark';
export type Flavor = 'violet' | 'berry' | 'wine';
export type GlassPref = 'auto' | 'reduced' | 'frost' | 'refract';

declare global {
  interface Window {
    __llApplyTheme?: () => void;
    __llReapplyGlass?: () => void;
    __llCsp?: string[];
    __llBoot?: {
      displayMode: Record<string, boolean>;
      unprefixedBackdrop: boolean;
      prefixedBackdrop: boolean;
      bootPath: string;
      rootRedirected: boolean;
      prefersDark: boolean;
      stored: string | null;
    };
  }
}

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writePref(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* 寫不進去時只影響這一次 */
  }
}

export const readTheme = (): ThemePref => {
  const v = readPref('ll:theme');
  return v === 'light' || v === 'dark' ? v : 'system';
};
export const readFlavor = (): Flavor => {
  const v = readPref('ll:dark-flavor');
  return v === 'berry' || v === 'wine' ? v : 'violet';
};
export const readGlass = (): GlassPref => {
  const v = readPref('ll:transparency');
  return v === 'reduced' || v === 'frost' || v === 'refract' ? v : 'auto';
};
export function setTheme(v: ThemePref): void {
  writePref('ll:theme', v === 'system' ? null : v);
  window.__llApplyTheme?.();
}
export function setFlavor(v: Flavor): void {
  writePref('ll:dark-flavor', v === 'violet' ? null : v);
  window.__llApplyTheme?.();
}
export function setGlass(v: GlassPref): void {
  writePref('ll:transparency', v === 'auto' ? null : v);
  window.__llReapplyGlass?.();
}

export function isAppMode(): boolean {
  const byMedia = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  const byIOS = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return byMedia || byIOS;
}
