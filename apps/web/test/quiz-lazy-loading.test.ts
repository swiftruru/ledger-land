// 作答頁第一波之外才載入的模組（06 第 8.2 節、14 第 5.2 節）：核心資料（科目表、版面、指標登錄檔）、四種要等核心資料的題型元件、
// 結果頁、回饋區與名詞卡。核心資料與題型元件由需要它們的題目來載、一呼叫就開始（維護者 2026-10-26：整頁等作答區齊了才淡入，不再等第一次繪製），
// 載到的資料和直接 import 核心的結果相同（vi.resetModules 之後是另一份模組實例，所以比內容）；回饋區和判分在同一個 Promise 裡，判分到了回饋區就一定到了。
// 元件檔用 Lingui 巨集，Node 環境的 web 專案不跑巨集，所以題型元件、結果頁與回饋區用 vi.mock 換成記號，只驗證載入的時機與單例。
import { defaultAccounts, defaultRatios, teacherLayout } from '@ledgerland/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DeferredQuestionView = () => null;
const ResultView = () => null;
const FeedbackView = () => null;
vi.mock('../src/features/quiz/question-types.tsx', () => ({ DeferredQuestionView }));
vi.mock('../src/features/quiz/ResultView.tsx', () => ({ ResultView }));
vi.mock('../src/features/quiz/FeedbackView.tsx', () => ({ FeedbackView }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('loadCoreData（lazy-data.ts）', () => {
  it('一呼叫就開始載入，不等計時器；之後回傳同一個 Promise，資料和核心的內建資料相同', async () => {
    const { loadCoreData } = await import('../src/features/quiz/lazy-data.ts');
    let done = false;
    const p = loadCoreData();
    void p.then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(() => expect(done).toBe(true));
    expect(loadCoreData()).toBe(p);
    const m = await p;
    expect(m.defaultAccounts).toEqual(defaultAccounts);
    expect(m.teacherLayout).toEqual(teacherLayout);
    expect(m.defaultRatios).toEqual(defaultRatios);
  });

  it('core-data.ts 只轉出三份資料（加上讓 runtime 留在入口 chunk 的 runtimeAnchor），不帶核心的其他程式', async () => {
    const m = await import('../src/features/quiz/core-data.ts');
    expect(Object.keys(m).sort()).toEqual(['defaultAccounts', 'defaultRatios', 'runtimeAnchor', 'teacherLayout']);
  });

  it('分錄的科目選項、版面線名稱與指標的公式文字都經由 loadCoreData 取得', async () => {
    const { accountOptionsOf } = await import('../src/features/quiz/accounts-lazy.ts');
    const { lineLabel } = await import('../src/features/quiz/layout-lazy.ts');
    const { ratioInfoOf } = await import('../src/features/quiz/ratio-lazy.ts');
    const options = accountOptionsOf(['cash'], 'zh-TW', () => undefined);
    await vi.advanceTimersByTimeAsync(500);
    expect((await options).map((o) => [o.id, o.element])).toEqual([['cash', 'asset']]);
    const anyLine = Object.values(teacherLayout.statements)[0]![0]!;
    expect(await lineLabel(anyLine.id, 'zh-TW', () => undefined)).toBe(anyLine.label['zh-TW']);
    const ratio = defaultRatios[0]!;
    const version = Object.keys(ratio.versions)[0]!;
    const info = await ratioInfoOf(`${ratio.id}@${version}`, 'zh-TW', () => undefined);
    expect(info?.termRef).toBe(ratio.termRef);
  });
});

describe('loadQuestionTypes（lazy-data.ts）', () => {
  it('一呼叫就載入題型元件，同時開始載入核心資料（兩個請求並行）', async () => {
    const lazy = await import('../src/features/quiz/lazy-data.ts');
    const p = lazy.loadQuestionTypes();
    await vi.advanceTimersByTimeAsync(0);
    const m = await p;
    expect(m.DeferredQuestionView).toBe(DeferredQuestionView);
    expect(lazy.loadQuestionTypes()).toBe(p);
    // 題型元件到的時候核心資料的 Promise 已經發出（同一個單例）
    const core = lazy.loadCoreData();
    expect((await core).defaultAccounts).toEqual(defaultAccounts);
  });
});

describe('結果頁與回饋區的延後載入', () => {
  it('loadResultView 回傳 ResultView 元件；重複呼叫是同一個 Promise', async () => {
    const { loadResultView } = await import('../src/features/quiz/result-lazy.ts');
    const p = loadResultView();
    expect(loadResultView()).toBe(p);
    expect(await p).toBe(ResultView);
  });

  it('判分載好時回饋區也已載好（loadScoring 一起等 loadFeedbackView）', async () => {
    vi.useRealTimers();
    const { loadScoring } = await import('../src/features/quiz/scoring-lazy.ts');
    const { loadFeedbackView } = await import('../src/features/quiz/feedback-lazy.tsx');
    let feedbackDone = false;
    void loadFeedbackView().then(() => {
      feedbackDone = true;
    });
    await loadScoring();
    await Promise.resolve();
    expect(feedbackDone).toBe(true);
    expect(await loadFeedbackView()).toBe(FeedbackView);
  });
});
