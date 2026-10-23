import { createBrowserRouter, type RouteObject } from 'react-router';
import type { Locale } from '@ledgerland/i18n';
import { site } from '../../site.config.ts';
import { loadChapter, loadLevel, loadManifest, loadTerms, loadTombstones } from '../lib/content.ts';
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
  // 闖關地圖與章節頁：各章的章節快照（17 第 5.1 節）也在載入頁面 chunk 的同時開始讀，少一個往返
  const prefetchChapters = () => {
    void loadManifest()
      .then((m) => {
        for (const c of m.chapters) void loadChapter(c.id, locale).catch(() => {});
      })
      .catch(() => {});
    // 下架清單也一起先讀：地圖的資料層在頁面 chunk 執行後才讀它，會多一個往返（本機 Lighthouse 的最長請求鏈就是它）
    void loadTombstones().catch(() => {});
  };
  // 作答頁：關卡快照在載入頁面 chunk 的同時開始讀（loader 不等它，只是先發出請求；失敗由頁面自己處理），名詞快照同名詞頁（06 第 8.2 節的 LCP 預算）
  const prefetchLevel = ({ params }: { params: { levelId?: string } }) => {
    if (params.levelId) void loadLevel(params.levelId, locale).catch(() => {});
    return null;
  };
  return [
    { index: true, Component: Home },
    { path: 'play', lazy: lazyPage(() => import('../pages/Play.tsx'), prefetchChapters) },
    { path: 'chapter/:chapterId', lazy: lazyPage(() => import('../pages/Chapter.tsx'), prefetchChapters) },
    {
      path: 'level/:levelId',
      lazy: lazyPage(() => import('../pages/Level.tsx'), prefetchTerms),
      loader: prefetchLevel,
      handle: { blocksUpdatePrompt: true, noindex: true } satisfies RouteHandle,
    },
    { path: 'lab', Component: Placeholder, handle: { kind: 'lab' } },
    { path: 'review', lazy: lazyPage(() => import('../pages/Review.tsx')), handle: { noindex: true } satisfies RouteHandle },
    { path: 'terms', lazy: lazyPage(() => import('../pages/Terms.tsx'), prefetchTerms) },
    { path: 'terms/:termId', lazy: lazyPage(() => import('../pages/Term.tsx'), prefetchTerms) },
    { path: 'me', Component: Me, handle: { noindex: true } satisfies RouteHandle },
    { path: 'me/settings', lazy: lazyPage(() => import('../pages/Settings.tsx')), handle: { noindex: true } satisfies RouteHandle },
    { path: 'me/backup', lazy: lazyPage(() => import('../pages/Backup.tsx')), handle: { noindex: true, blocksUpdatePrompt: true } satisfies RouteHandle },
    { path: 'privacy', lazy: lazyPage(() => import('../pages/Privacy.tsx')) },
    { path: 'about', lazy: lazyPage(() => import('../pages/About.tsx')) },
    { path: 'design', lazy: lazyPage(() => import('../pages/Design.tsx')) },
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
