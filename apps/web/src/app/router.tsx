import { createBrowserRouter, type RouteObject } from 'react-router';
import type { Locale } from '@ledgerland/i18n';
import { site } from '../../site.config.ts';
import { loadChapterIndex, loadLevel, loadTermDetail, loadTermIndex } from '../lib/content.ts';
import { loadLayerCatalog, type CatalogLayer } from '../i18n/layer-catalogs.ts';
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
  // catalog 為 'pages'（說明頁、我的底下的子頁、debug）或 'lab'（報表實驗室的子頁）的頁面：字串在第二層或第三層 catalog（lingui.config.ts），
  // 和頁面 chunk 一起載入（兩個請求並行，殼層依路徑也會預先載入），載好才交出元件，頁面第一次繪製就有字；載入失敗時照樣交出元件，
  // 缺的字串退回 zh-TW 或訊息 ID（14 第 5.2 節）
  const lazyPage = (load: () => Promise<{ default: React.ComponentType }>, prefetch?: () => void, catalog?: CatalogLayer) => async () => {
    prefetch?.();
    const [mod] = await Promise.all([load(), catalog === undefined ? undefined : loadLayerCatalog(catalog, locale).catch(() => {})]);
    return { Component: mod.default };
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
    // 實驗室（M4a）：首頁和「我的」等 Tab 頁一樣 lazy，入口 chunk 只留首頁；子頁的字串在第三層 catalog（lab）。故事步驟頁、自由實驗與勾稽練習不收錄（02 第 1.1 節）；
    // 步驟頁與自由實驗作答中不顯示更新提示（06 第 3.3 節）
    { path: 'lab', lazy: lazyPage(() => import('../pages/Lab.tsx')) },
    {
      path: 'lab/story/:storyId',
      lazy: lazyPage(() => import('../pages/LabStory.tsx'), prefetchChapterIndex, 'lab'),
      handle: { layout: 'wide' } satisfies RouteHandle,
    },
    // 步驟頁不預讀名詞索引（V24，2026-11-01）：階段 1 的列名與名詞 chip 用故事快照裡的名稱，索引由 TermsProvider 在畫面掀開之後才讀，預讀會把它排進 LCP 前面
    {
      path: 'lab/story/:storyId/:stepId',
      lazy: lazyPage(() => import('../pages/LabStep.tsx'), undefined, 'lab'),
      handle: { blocksUpdatePrompt: true, noindex: true, layout: 'wide' } satisfies RouteHandle,
    },
    {
      path: 'lab/sandbox',
      lazy: lazyPage(() => import('../pages/LabSandbox.tsx'), prefetchTermIndex, 'lab'),
      handle: { blocksUpdatePrompt: true, noindex: true, layout: 'wide' } satisfies RouteHandle,
    },
    {
      path: 'lab/reconcile',
      lazy: lazyPage(() => import('../pages/LabReconcile.tsx'), prefetchTermIndex, 'lab'),
      handle: { noindex: true, layout: 'wide' } satisfies RouteHandle,
    },
    { path: 'lab/ratios', lazy: lazyPage(() => import('../pages/LabRatios.tsx'), prefetchTermIndex, 'lab'), handle: { layout: 'wide' } satisfies RouteHandle },
    { path: 'review', lazy: lazyPage(() => import('../pages/Review.tsx')), handle: { noindex: true } satisfies RouteHandle },
    // 期中考苦練（M4c）：三頁都在第二層 catalog；練習頁與老師審核頁 noindex，審核頁不進 sitemap、站上沒有連結（只給老師固定連結）
    { path: 'exam', lazy: lazyPage(() => import('../pages/Exam.tsx'), undefined, 'pages'), handle: { layout: 'wide' } satisfies RouteHandle },
    {
      path: 'exam/teacher',
      lazy: lazyPage(() => import('../pages/ExamTeacher.tsx'), undefined, 'pages'),
      handle: { noindex: true, layout: 'wide' } satisfies RouteHandle,
    },
    // 第二批（2026-11-05）：錯題與不熟的清單、背題瀏覽；都是講義原文，noindex；要排在 exam/:setId 前面（list、browse 不是題組）
    { path: 'exam/list', lazy: lazyPage(() => import('../pages/ExamList.tsx'), undefined, 'pages'), handle: { noindex: true } satisfies RouteHandle },
    {
      path: 'exam/browse',
      lazy: lazyPage(() => import('../pages/ExamBrowse.tsx'), undefined, 'pages'),
      handle: { noindex: true, layout: 'wide' } satisfies RouteHandle,
    },
    {
      path: 'exam/:setId',
      lazy: lazyPage(() => import('../pages/ExamRun.tsx'), undefined, 'pages'),
      handle: { noindex: true, blocksUpdatePrompt: true } satisfies RouteHandle,
    },
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
    { path: 'me/settings', lazy: lazyPage(() => import('../pages/Settings.tsx'), undefined, 'pages'), handle: { noindex: true } satisfies RouteHandle },
    {
      path: 'me/badges',
      lazy: lazyPage(() => import('../pages/Badges.tsx'), prefetchChapters, 'pages'),
      handle: { noindex: true, layout: 'wide' } satisfies RouteHandle,
    },
    { path: 'install', lazy: lazyPage(() => import('../pages/Install.tsx'), undefined, 'pages'), handle: { layout: 'wide' } satisfies RouteHandle },
    {
      path: 'me/backup',
      lazy: lazyPage(() => import('../pages/Backup.tsx'), undefined, 'pages'),
      handle: { noindex: true, blocksUpdatePrompt: true } satisfies RouteHandle,
    },
    { path: 'privacy', lazy: lazyPage(() => import('../pages/Privacy.tsx'), undefined, 'pages') },
    { path: 'about', lazy: lazyPage(() => import('../pages/About.tsx'), undefined, 'pages') },
    { path: 'credits', lazy: lazyPage(() => import('../pages/Credits.tsx'), undefined, 'pages') },
    // 關於系統設計在 1024 以上是內文加右側目錄的兩欄（第 2 輪驗收），所以用寬版
    { path: 'design', lazy: lazyPage(() => import('../pages/Design.tsx'), undefined, 'pages'), handle: { layout: 'wide' } satisfies RouteHandle },
    { path: 'debug', lazy: lazyPage(() => import('../pages/Debug.tsx'), undefined, 'pages'), handle: { noindex: true } satisfies RouteHandle },
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
