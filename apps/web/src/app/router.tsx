import { createBrowserRouter, type RouteObject } from 'react-router';
import type { Locale } from '@ledgerland/i18n';
import { site } from '../../site.config.ts';
import { loadTerms } from '../lib/content.ts';
import { RouteError } from '../components/RouteError.tsx';
import { Home } from '../pages/Home.tsx';
import { Me } from '../pages/Me.tsx';
import { NotFound } from '../pages/NotFound.tsx';
import { Placeholder } from '../pages/Placeholder.tsx';
import { Root } from './Root.tsx';

export interface RouteHandle {
  /** 作答頁、實驗室步驟頁、匯入流程不顯示更新提示（06 第 3.3 節） */
  blocksUpdatePrompt?: boolean;
  /** 只依賴裝置資料或不該被收錄的頁面（05 第 9.3 節） */
  noindex?: boolean;
}

// 同一個函式產生中文（/）與英文（/en）兩組子路由，頁面元件共用（05 第 7.4 節第 2 點、09 第 3.2 節）；每條路由都有 ErrorBoundary（06 第 9.1 節）
function buildRoutes(locale: Locale): RouteObject[] {
  const lazyPage = (load: () => Promise<{ default: React.ComponentType }>, prefetch?: () => void) => async () => {
    prefetch?.();
    return { Component: (await load()).default };
  };
  // 名詞頁在載入頁面 chunk 的同時就開始讀快照（失敗由頁面自己處理，這裡只吞掉）
  const prefetchTerms = () => {
    for (const l of ['zh-TW', 'en'] as const) void loadTerms(l).catch(() => {});
  };
  return [
    { index: true, Component: Home },
    { path: 'play', Component: Placeholder, handle: { kind: 'play' } },
    { path: 'level/:levelId', lazy: lazyPage(() => import('../pages/Level.tsx')), handle: { blocksUpdatePrompt: true, noindex: true } satisfies RouteHandle },
    { path: 'lab', Component: Placeholder, handle: { kind: 'lab' } },
    { path: 'terms', lazy: lazyPage(() => import('../pages/Terms.tsx'), prefetchTerms) },
    { path: 'terms/:termId', lazy: lazyPage(() => import('../pages/Term.tsx'), prefetchTerms) },
    { path: 'me', Component: Me, handle: { noindex: true } satisfies RouteHandle },
    { path: 'me/settings', lazy: lazyPage(() => import('../pages/Settings.tsx')), handle: { noindex: true } satisfies RouteHandle },
    { path: 'privacy', lazy: lazyPage(() => import('../pages/Privacy.tsx')) },
    { path: 'about', lazy: lazyPage(() => import('../pages/About.tsx')) },
    { path: 'debug', lazy: lazyPage(() => import('../pages/Debug.tsx')), handle: { noindex: true } satisfies RouteHandle },
    { path: '*', Component: NotFound, handle: { locale, noindex: true } },
  ];
}

export const router = createBrowserRouter(
  [
    {
      path: '/',
      Component: Root,
      ErrorBoundary: RouteError,
      children: [{ path: 'en', children: buildRoutes('en'), ErrorBoundary: RouteError }, ...buildRoutes('zh-TW')],
    },
  ],
  { basename: site.base === '/' ? undefined : site.base },
);
