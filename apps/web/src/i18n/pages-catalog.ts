// 第二層 catalog（14 第 5.2 節）：只在子頁用到的字串放在 locales/<語言>/pages.po，由用到的頁面自己延遲載入，不進首次載入的 JS。
// i18n.load 是合併（Lingui 6 把新訊息蓋在同語言既有的訊息上）並發出 change 事件，I18nProvider 會重新繪製；頁面用 usePagesCatalog 的結果當
// usePageReady 的條件之一，字串到了才整頁出現（維護者 2026-10-26：不先畫一半）。兩個語言的 pages.po 都不進頁面自己的 chunk，各是一個小 chunk。
import { i18n } from '@lingui/core';
import type { Messages } from '@lingui/core';
import { useEffect, useState } from 'react';
import type { Locale } from '@ledgerland/i18n';

const loaders: Record<Locale, () => Promise<{ messages: Messages }>> = {
  'zh-TW': () => import('../locales/zh-TW/pages.po'),
  en: () => import('../locales/en/pages.po'),
};

const loaded = new Set<Locale>();
const pending = new Map<Locale, Promise<void>>();

/** 載入某個語言的第二層 catalog（同一語言只載一次；載過直接 resolve） */
export function loadPagesCatalog(locale: Locale): Promise<void> {
  if (loaded.has(locale)) return Promise.resolve();
  let p = pending.get(locale);
  if (p === undefined) {
    p = loaders[locale]().then(({ messages }) => {
      if (!loaded.has(locale)) {
        i18n.load(locale, messages);
        loaded.add(locale);
      }
      pending.delete(locale);
    });
    pending.set(locale, p);
  }
  return p;
}

/** 這個語言的第二層字串齊了沒（載入失敗也回 true，頁面照常出現，缺的字串退回 zh-TW 或 id） */
export function usePagesCatalog(locale: Locale): boolean {
  const [ready, setReady] = useState(() => loaded.has(locale));
  useEffect(() => {
    let alive = true;
    if (loaded.has(locale)) {
      setReady(true);
      return;
    }
    setReady(false);
    loadPagesCatalog(locale).then(
      () => alive && setReady(true),
      () => alive && setReady(true),
    );
    return () => {
      alive = false;
    };
  }, [locale]);
  return ready;
}
