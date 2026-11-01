// 第二層與第三層 catalog（14 第 5.2 節）：只在子頁用到的字串放在 locales/<語言>/pages.po（說明頁、我的子頁、debug）與 lab.po（報表實驗室），
// 哪些檔案進哪一層見 lingui.config.ts。路由在載入那些頁面的 chunk 時一起載入（app/router.tsx 的 lazyPage 第三個參數），載好才交出元件，
// 不進首次載入的 JS；殼層依路徑也會預先載入（shell/route-preload.json 的 catalogLayers）。i18n.load 是合併（Lingui 6 把新訊息蓋在同語言既有的訊息上）。
// 每一層每個語言各是一個小 chunk，都進 precache。
import { i18n } from '@lingui/core';
import type { Messages } from '@lingui/core';
import type { Locale } from '@ledgerland/i18n';

export type CatalogLayer = 'pages' | 'lab';

const loaders: Record<CatalogLayer, Record<Locale, () => Promise<{ messages: Messages }>>> = {
  pages: {
    'zh-TW': () => import('../locales/zh-TW/pages.po'),
    en: () => import('../locales/en/pages.po'),
  },
  lab: {
    'zh-TW': () => import('../locales/zh-TW/lab.po'),
    en: () => import('../locales/en/lab.po'),
  },
};

const loaded = new Set<string>();
const pending = new Map<string, Promise<void>>();

/** 載入某一層某個語言的 catalog（同一層同一語言只載一次；載過直接 resolve；失敗時 reject，由呼叫端決定要不要吞掉） */
export function loadLayerCatalog(layer: CatalogLayer, locale: Locale): Promise<void> {
  const key = `${layer}:${locale}`;
  if (loaded.has(key)) return Promise.resolve();
  let p = pending.get(key);
  if (p === undefined) {
    p = loaders[layer][locale]()
      .then(({ messages }) => {
        if (!loaded.has(key)) {
          i18n.load(locale, messages);
          loaded.add(key);
        }
      })
      .finally(() => pending.delete(key));
    pending.set(key, p);
  }
  return p;
}
