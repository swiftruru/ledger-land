import { createBrowserRouter, type RouteObject } from 'react-router';
import type { Locale } from '@ledgerland/i18n';
import { site } from '../../site.config.ts';
import { loadChapterIndex, loadLevel, loadTermDetail, loadTermIndex } from '../lib/content.ts';
import { RouteError } from '../components/RouteError.tsx';
import { Home } from '../pages/Home.tsx';
import { NotFound } from '../pages/NotFound.tsx';
import { Root } from './Root.tsx';

export interface RouteHandle {
  /** 作答頁、實驗室步驟頁、匯入流程不顯示更新提示（06 第 3.3 節） */
  blocksUpdatePrompt?: boolean;
  /** 只依賴裝置資料或不該被收錄的頁面（05 第 9.3 節） */
  noindex?: boolean;
  /** 內容寬（站規 2.0）：wide 是 1040px 的寬版（首頁、章節頁、名詞圖鑑、徽章、我的），map 是全幅；省略是一般 720px。Root 寫到 main 的 data-layout */
  layout?: 'wide' | 'map';
}

// 同一個函式產生中文（/）與英文（/en）兩組子路由，頁面元件共用（05 第 7.4 節第 2 點、09 第 3.2 節）；每條路由都有 ErrorBoundary（06 第 9.1 節）
function buildRoutes(locale: Locale): RouteObject[] {
  const lazyPage = (load: () => Promise<{ default: React.ComponentType }>, prefetch?: () => void) => async () => {
    prefetch?.();
    return { Component: (await load()).default };
  };
  // 作答頁與名詞列表在載入頁面 chunk 的同時就開始讀目前語言的名詞索引（失敗由頁面自己處理，這裡只吞掉）；
  // 另一種語言只給名詞卡的次要名稱，由 TermsProvider 在第一次繪製後補讀，不跟第二波搶頻寬（06 第 8.2 節）
  const prefetchTermIndex = () => {
    void loadTermIndex(locale).catch(() => {});
  };
  // 名詞頁：兩種語言的這個名詞的完整內容檔（各約 5 個名詞）與章節索引（「會在哪一關遇到」的關卡名）在載入頁面 chunk 的同時就開始讀（loader 不等它）
  const prefetchTermDetail = ({ params }: { params: { termId?: string } }) => {
    if (params.termId) for (const l of ['zh-TW', 'en'] as const) void loadTermDetail(params.termId, l).catch(() => {});
    void loadChapterIndex(locale).catch(() => {});
    return null;
  };
  // 闖關地圖與章節頁：章節索引（全部章節的摘要，一個語系一檔，17 第 5.1 節）也在載入頁面 chunk 的同時開始讀，少一個往返
  const prefetchChapterIndex = () => {
    void loadChapterIndex(locale).catch(() => {});
  };
  // 下架清單（墓碑）不再先讀：地圖第一次繪製不需要它（features/quest-map/data.ts 的 retiredLevels），代號與 QR 要查時才讀
  const prefetchChapters = prefetchChapterIndex;
  // 作答頁：關卡快照在載入頁面 chunk 的同時開始讀（loader 不等它，只是先發出請求；失敗由頁面自己處理），名詞快照同名詞頁（06 第 8.2 節的 LCP 預算）
  const prefetchLevel = ({ params }: { params: { levelId?: string } }) => {
    if (params.levelId) void loadLevel(params.levelId, locale).catch(() => {});
    return null;
  };
  return [
    { index: true, Component: Home, handle: { layout: 'wide' } satisfies RouteHandle },
    { path: 'play', lazy: lazyPage(() => import('../pages/Play.tsx'), prefetchChapters), handle: { layout: 'map' } satisfies RouteHandle },
    {
      path: 'chapter/:chapterId',
      lazy: lazyPage(() => import('../pages/Chapter.tsx'), prefetchChapters),
      handle: { layout: 'wide' } satisfies RouteHandle,
    },
    {
      path: 'level/:levelId',
      lazy: lazyPage(() => import('../pages/Level.tsx'), prefetchTermIndex),
      loader: prefetchLevel,
      handle: { blocksUpdatePrompt: true, noindex: true } satisfies RouteHandle,
    },
    // 實驗室的占位頁與「我的」和其他 Tab 頁一樣 lazy，入口 chunk 只留首頁（第 3 輪 handoff：/en/ 入口的首次載入 JS 超過 150 KB）；直接開時由殼層預先載入頁面 chunk
    { path: 'lab', lazy: lazyPage(() => import('../pages/Placeholder.tsx')), handle: { kind: 'lab' } },
    { path: 'review', lazy: lazyPage(() => import('../pages/Review.tsx')), handle: { noindex: true } satisfies RouteHandle },
    // 名詞列表依章節分組，組名與「在第幾關會遇到」的關卡名來自章節索引（useGlossaryIndex），和名詞索引一起先讀
    {
      path: 'terms',
      lazy: lazyPage(
        () => import('../pages/Terms.tsx'),
        () => {
          prefetchTermIndex();
          prefetchChapterIndex();
        },
      ),
      handle: { layout: 'wide' } satisfies RouteHandle,
    },
    { path: 'terms/:termId', lazy: lazyPage(() => import('../pages/Term.tsx')), loader: prefetchTermDetail },
    { path: 'me', lazy: lazyPage(() => import('../pages/Me.tsx')), handle: { noindex: true, layout: 'wide' } satisfies RouteHandle },
    { path: 'me/settings', lazy: lazyPage(() => import('../pages/Settings.tsx')), handle: { noindex: true } satisfies RouteHandle },
    {
      path: 'me/badges',
      lazy: lazyPage(() => import('../pages/Badges.tsx'), prefetchChapters),
      handle: { noindex: true, layout: 'wide' } satisfies RouteHandle,
    },
    { path: 'install', lazy: lazyPage(() => import('../pages/Install.tsx')), handle: { layout: 'wide' } satisfies RouteHandle },
    { path: 'me/backup', lazy: lazyPage(() => import('../pages/Backup.tsx')), handle: { noindex: true, blocksUpdatePrompt: true } satisfies RouteHandle },
    { path: 'privacy', lazy: lazyPage(() => import('../pages/Privacy.tsx')) },
    { path: 'about', lazy: lazyPage(() => import('../pages/About.tsx')) },
    // 關於系統設計在 1024 以上是內文加右側目錄的兩欄（第 2 輪驗收），所以用寬版
    { path: 'design', lazy: lazyPage(() => import('../pages/Design.tsx')), handle: { layout: 'wide' } satisfies RouteHandle },
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
      // 兩種語系各包一層有 ErrorBoundary 的路由（中文是不帶路徑的那一層）：頁面出錯時錯誤畫面畫在 Root 的 main 裡，
      // 跳到主要內容、Tab bar、LinkProvider 與頂部提示都還在；只有 Root 本身出錯才落到上面這一層
      children: [
        { path: 'en', children: buildRoutes('en'), ErrorBoundary: RouteError },
        { children: buildRoutes('zh-TW'), ErrorBoundary: RouteError },
      ],
    },
  ],
  { basename: site.base === '/' ? undefined : site.base },
);
