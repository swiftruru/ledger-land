// 全站頁面與狀態的矩陣（站規 4.2 的表）：link-style.spec 與 axe.spec 共用。每一筆是「打開到某個狀態」的做法，
// 只用正式建置也有的觸發方式：網址參數（?ll-fixture=quest、?scan=1、?group、?q）、localStorage 與 sessionStorage、
// 直接寫進度資料庫（資料全部自編）、userAgent 等環境模擬（init script 改 navigator）、攔網路請求（載入中、離線、空狀態、路由錯誤）。
// 沒有觸發方式的狀態（更新提示、儲存層五種）用 ?ll-banner=，只在 VITE_LL_FIXTURES=1 的建置存在（fixtureOnly，正式建置自動跳過）。
// 不在這裡斷言外觀；每一筆只等到該狀態真的出現（等不到就失敗，避免量到錯的畫面）。
import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { isReference, termIndexOf } from './glossary-data.ts';
import { waitForApp, waitForProgressDb } from './helpers.ts';

export interface Theme {
  name: 'light' | 'violet' | 'berry' | 'wine';
  theme: 'light' | 'dark';
  flavor?: 'violet' | 'berry' | 'wine';
}
export const ALL_THEMES: readonly Theme[] = [
  { name: 'light', theme: 'light' },
  { name: 'violet', theme: 'dark', flavor: 'violet' },
  { name: 'berry', theme: 'dark', flavor: 'berry' },
  { name: 'wine', theme: 'dark', flavor: 'wine' },
];

/** 真機 iOS 26 的 UA：系統版本凍結在 OS 18_6，Safari 的 Version/ 才是 26（和 banners.spec 相同） */
export const IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
export const IOS_LINE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/15.0.0';

/** 第 1 章第 1 關（6 題，第 1 題是單選 q_g1ze90s7：o_80gh 對、o_60qb 錯） */
export const LEVEL = 'lv_h2zx7srx';
const LEVEL_Q1 = 'q_g1ze90s7';
/** 這一題目前的 rev（content 的 rev，M3 收尾第 9 輪的引號修正是文字改版，1 改 2）：種子的作答與錯題用同一個 rev，錯題本不會多出「文字有更新」 */
const LEVEL_Q1_REV = 2;
const LEVEL_Q1_RIGHT = 'o_80gh';
const LEVEL_Q1_WRONG = 'o_60qb';
/** 結果頁用的關卡：5 題都是單選或是非（點第一個選項就能一路作答到結果頁） */
const RESULT_LEVEL = 'lv_hk19p9x3';
const CHAPTER = 'ch_c5f8w2';
const EXT_CHAPTER = 'ch_155y47';
const TERM = 'tm_r4w8n2qe';
/** 收藏用的取捨題（第 3 關，glossary.spec.ts 的 JUDGMENT_QUESTION） */
const FAV_QUESTION = 'q_ytrpj345';
/** 不在任何關卡裡的題目 ID（已下架的收藏與錯題） */
const RETIRED_QUESTION = 'q_zzzzzzzz';
const PLAYED = '2026-10-20T10:00:00.000Z';
/**
 * 相機預覽提示已關閉（sessionStorage）：iPhone 15 的 WebKit 配額約 1 GB（實測 1048576000），會被判定成相機預覽的暫存情境，
 * 而這個提示比安裝建議、Safari 分頁、內建瀏覽器提示優先（一次只展開一條），要拍那些提示時先把它關掉
 */
const EPHEMERAL_DISMISSED = 'll:ephemeral-notice-dismissed';

export interface Env {
  /** 改 navigator.userAgent（App 的環境偵測都讀這個） */
  ua?: string;
  /** 主畫面 App 模式（navigator.standalone，boot 腳本與 isAppMode 都看這個） */
  appMode?: boolean;
  /** navigator.storage.estimate() 回報的配額（相機預覽的暫存情境偵測） */
  quota?: number;
  /** navigator.storage.persisted() 回 false（備份提醒） */
  notPersisted?: boolean;
  /** 瀏覽器語言（navigator.languages）設成網址以外的另一種語系（語言切換提示）；不改 ll:locale 偏好，根路徑才不會轉址 */
  otherLanguage?: boolean;
}

export type Seed = Record<string, unknown[]>;

export interface CaseData {
  /** 一個參考名詞（沒有關卡用到）：兩種語系的 ID 與主名稱 */
  reference: { id: string; label: Record<'' | '/en', string> };
}

export interface PageCase {
  group: string;
  name: string;
  path: string | ((d: CaseData, prefix: string) => string);
  /** PR 也量 768（名詞圖鑑、我的、章節頁） */
  tablet?: boolean;
  /** 只在這些寬度有意義（例如 compact 的「更多」選單） */
  widths?: readonly number[];
  storage?: Record<string, string>;
  session?: Record<string, string>;
  env?: Env;
  /** 寫進進度資料庫（先開一次頁面等 App 建好資料庫，寫入後重新整理）；today 是瀏覽器的本地日期 */
  seed?: Seed | ((today: string) => Seed);
  /** 開頁之前攔網路請求 */
  route?: (page: Page) => Promise<void>;
  /** 有請求一直掛著（載入中）：不等網路安靜，改等這個條件 */
  pending?: (page: Page) => Promise<void>;
  /** 開好之後要做的事（作答、展開、打開面板），最後一定要等到該狀態出現 */
  prepare?: (page: Page) => Promise<void>;
  /** 模擬 Chromium 的 beforeinstallprompt（只有 Chromium 有安裝按鈕） */
  bip?: boolean;
  chromiumOnly?: boolean;
  /** 只在 VITE_LL_FIXTURES=1 的建置存在（?ll-banner=、?ll-fixture=buttons） */
  fixtureOnly?: boolean;
  /** 不收站內連結做 404 檢查：fixture 的連結指向假的章節與關卡（只在帶 ?ll-fixture 時存在） */
  noLinks?: boolean;
}

const MAP_FIXTURE = '/play/?ll-fixture=quest';

const progressSeed: Seed = {
  attempts: [
    {
      attemptId: 'a_e2e000000001',
      questionId: LEVEL_Q1,
      rev: LEVEL_Q1_REV,
      levelId: LEVEL,
      answer: LEVEL_Q1_RIGHT,
      correct: true,
      answeredAt: PLAYED,
      deviceId: 'd_e2e00001',
      source: 'play',
    },
  ],
  levelProgress: [
    { levelId: LEVEL, stars: 3, bestScore: 1, firstCompletedAt: PLAYED, lastPlayedAt: PLAYED },
    { levelId: 'lv_r2ctekx1', stars: 1, bestScore: 0.4, firstCompletedAt: PLAYED, lastPlayedAt: PLAYED },
  ],
  unlocks: [
    { id: 'badge:first_level', kind: 'badge', unlockedAt: PLAYED },
    { id: `term:${TERM}`, kind: 'term', unlockedAt: PLAYED },
  ],
  settings: [{ key: 'levelsCompleted', value: 2, updatedAt: PLAYED }],
};

const reviewEntry = (questionId: string, today: string) => ({
  questionId,
  rev: questionId === LEVEL_Q1 ? LEVEL_Q1_REV : 1,
  lastResult: 'wrong',
  lastAnsweredAt: PLAYED,
  box: 1,
  dueAt: today,
  wrongCount: 1,
  status: 'active',
  addedBy: 'auto',
});

const visible = (page: Page, testId: string) => expect(page.getByTestId(testId).first()).toBeVisible();
const question = (page: Page) => page.locator('.ll-question');
/** 第一題整張畫好：整頁的布幕掀開（作答區齊了才 data-ready，lib/page-ready.tsx），而且題號是第 1 題 */
const firstQuestionReady = async (page: Page) => {
  await expect(page.locator('.ll-page[data-ready="true"]')).toBeVisible();
  await expect(page.getByText(/^第 1 題，共 \d+ 題$|^Question 1 of \d+$/)).toBeVisible();
};

/** 選一個選項並確認，等回饋出現 */
async function answer(page: Page, option?: string): Promise<void> {
  const input = option ? question(page).locator(`input[value="${option}"]`) : question(page).getByRole('radio').first();
  await input.check();
  await page.getByRole('button', { name: /^(確認答案|Check answer)$/ }).click();
  await expect(page.locator('.ll-feedback__title')).toBeVisible();
}
const next = (page: Page) => page.getByRole('button', { name: /^(下一題|Next question)$/ }).click();

/** 每題的答案：單選是正確選項的 ID，是非是正確的那一邊（'true' 或 'false'） */
type AnswerKey = Record<string, { type: string; right: string }>;

/** 從這一關的內容快照讀答案（每次作答題目與選項都會洗牌，不能靠順序；目前這一題的 ID 在作答頁的錨點 #ll-q-<題目 ID>） */
function answerKey(page: Page, levelId: string): Promise<AnswerKey> {
  return page.evaluate(async (levelId) => {
    const locale = location.pathname.startsWith('/en/') ? 'en' : 'zh-TW';
    const manifest = (await (await fetch('/content/content-manifest.json')).json()) as { levels: { id: string; files: Record<string, string> }[] };
    const file = manifest.levels.find((l) => l.id === levelId)?.files[locale];
    if (!file) throw new Error(`內容清單裡沒有 ${levelId}`);
    const snap = (await (await fetch(`/${file}`)).json()) as { questions: { id: string; type: string; correctOptionId?: string; correct?: boolean }[] };
    const key: Record<string, { type: string; right: string }> = {};
    for (const q of snap.questions) key[q.id] = { type: q.type, right: q.type === 'true_false' ? String(q.correct === true) : (q.correctOptionId ?? '') };
    return key;
  }, levelId);
}

/** 一路作答到結果頁：right 是 true 時每題都答對（三顆星），false 時每題都答錯（沒有星星）。只支援單選與是非（RESULT_LEVEL） */
async function playToResult(page: Page, levelId: string, right: boolean): Promise<void> {
  await firstQuestionReady(page);
  const key = await answerKey(page, levelId);
  for (let n = 0; n < 20; n++) {
    // 上一題的回饋收掉、新的一題整張畫好（作答區齊了才顯示，沒有骨架）之後才讀錨點
    await expect(page.locator('.ll-feedback__title')).toHaveCount(0);
    await expect(page.locator('.ll-question-wrap[data-ready="true"]')).toBeVisible();
    const anchor = (await page.locator('[id^="ll-q-"]').first().getAttribute('id')) ?? '';
    const q = key[anchor.slice('ll-q-'.length)];
    if (!q || !['single_choice', 'true_false'].includes(q.type)) throw new Error(`不支援的題目：${anchor}`);
    const values = await question(page)
      .getByRole('radio')
      .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
    const pick = right ? q.right : values.find((v) => v !== q.right);
    if (pick === undefined || !values.includes(pick)) throw new Error(`找不到要選的選項：${anchor} ${values.join(', ')}`);
    await answer(page, pick);
    await next(page);
    const done = await page
      .getByTestId('result-title')
      .waitFor({ timeout: 1500 })
      .then(() => true)
      .catch(() => false);
    if (done) return;
  }
  throw new Error('作答 20 題還沒到結果頁');
}

/** HUD 的工具：medium 以上直接排開；compact 收在「更多」選單（和 quest-map.spec 相同） */
async function hudTool(page: Page, testId: string): Promise<void> {
  await page.getByTestId('quest-map').waitFor();
  const inline = page.locator(`.ll-hud__tools [data-testid="${testId}"]:not([role="menuitem"])`);
  if (await inline.count()) {
    await inline.click();
    return;
  }
  await page.getByTestId('map-more').click();
  await page.locator(`[role="menuitem"][data-testid="${testId}"]`).click();
}

async function codeOverlay(page: Page, code?: string): Promise<void> {
  await hudTool(page, 'map-code');
  const overlay = page.getByTestId('code-overlay');
  await expect(overlay).toBeVisible();
  if (code === undefined) return;
  const input = overlay.getByRole('textbox');
  await input.fill(code);
  await input.press('Enter');
  await expect(overlay.getByRole('alert')).toBeVisible();
}

/** 讓某個網址一直掛著（載入中）：不回應也不放行 */
const hold = (pattern: string) => async (page: Page) => {
  await page.route(pattern, () => {
    /* 不回應：狀態停在載入中 */
  });
};
const abort = (pattern: string) => async (page: Page) => {
  await page.route(pattern, (r) => r.abort('internetdisconnected'));
};

export const CASES: readonly PageCase[] = [
  // 首頁
  { group: '首頁', name: '新使用者', path: '/' },
  {
    group: '首頁',
    name: '有進度且有到期',
    path: '/',
    seed: (today) => ({ ...progressSeed, reviewQueue: [reviewEntry(LEVEL_Q1, today)] }),
    prepare: (page) => visible(page, 'home-due'),
  },
  { group: '首頁', name: '匯入提示卡', path: '/', env: { appMode: true }, prepare: (page) => visible(page, 'import-prompt') },

  // 闖關
  { group: '闖關', name: '地圖新使用者', path: '/play/', prepare: (page) => visible(page, 'quest-map') },
  { group: '闖關', name: '地圖 quest fixture', path: MAP_FIXTURE, noLinks: true, prepare: (page) => visible(page, 'quest-map') },
  { group: '闖關', name: '清單檢視', path: `${MAP_FIXTURE}&view=list`, noLinks: true, prepare: (page) => visible(page, 'map-list') },
  {
    group: '闖關',
    name: '關卡介紹面板',
    path: MAP_FIXTURE,
    noLinks: true,
    prepare: async (page) => {
      await page.locator('[data-level-id="lv_fx010001"] button').first().click();
      await visible(page, 'level-sheet');
    },
  },
  {
    group: '闖關',
    name: '「更多」選單（compact）',
    path: MAP_FIXTURE,
    noLinks: true,
    widths: [375],
    prepare: async (page) => {
      await page.getByTestId('map-more').click();
      await expect(page.getByRole('menu')).toBeVisible();
    },
  },
  {
    group: '闖關',
    name: '提示條',
    path: '/play/',
    env: { ua: IOS_SAFARI },
    session: { [EPHEMERAL_DISMISSED]: '1' },
    prepare: (page) => visible(page, 'map-hint-safari'),
  },
  { group: '闖關', name: '代號輸入：空', path: MAP_FIXTURE, noLinks: true, prepare: (page) => codeOverlay(page) },
  { group: '闖關', name: '代號輸入：格式錯', path: MAP_FIXTURE, noLinks: true, prepare: (page) => codeOverlay(page, 'zz') },
  {
    group: '闖關',
    name: '代號輸入：已下架',
    path: MAP_FIXTURE,
    noLinks: true,
    prepare: async (page) => {
      await codeOverlay(page, 'fx0r0001');
      await expect(page.getByTestId('code-overlay').getByRole('link')).toBeVisible();
    },
  },
  { group: '闖關', name: '掃描說明', path: `${MAP_FIXTURE}&scan=1`, noLinks: true, prepare: (page) => visible(page, 'scan-overlay') },
  {
    group: '闖關',
    name: '載入中',
    path: '/play/',
    route: hold('**/content/content-manifest.json'),
    pending: (page) => expect(page.locator('.ll-page__wait')).toBeVisible(),
  },
  {
    group: '闖關',
    name: '錯誤',
    path: '/play/',
    route: abort('**/content/content-manifest.json'),
    prepare: (page) => expect(page.locator('main .ll-state--error')).toBeVisible(),
  },
  {
    group: '闖關',
    name: '空',
    path: '/play/',
    // 內容快照還沒有任何關卡：地圖的章節來自章節索引（features/quest-map/data.ts），manifest 的章節與關卡也一起清空
    route: async (page) => {
      await page.route('**/content/content-manifest.json', async (r) => {
        const res = await r.fetch();
        const m = (await res.json()) as Record<string, unknown>;
        await r.fulfill({ response: res, json: { ...m, chapters: [], levels: [] } });
      });
      await page.route('**/content/*/chapter-index.*.json', (r) => r.fulfill({ json: [] }));
    },
    prepare: (page) => expect(page.locator('main .ll-state--empty')).toBeVisible(),
  },

  // 章節頁
  { group: '章節頁', name: '主線新', path: `/chapter/${CHAPTER}/`, tablet: true, prepare: (page) => visible(page, 'chapter-page') },
  { group: '章節頁', name: '主線有進度', path: `/chapter/${CHAPTER}/`, tablet: true, seed: progressSeed, prepare: (page) => visible(page, 'chapter-page') },
  { group: '章節頁', name: '延伸', path: `/chapter/${EXT_CHAPTER}/`, tablet: true, prepare: (page) => visible(page, 'chapter-page') },
  {
    group: '章節頁',
    name: '載入中',
    path: `/chapter/${CHAPTER}/`,
    tablet: true,
    route: hold('**/content/*/chapter-index.*.json'),
    pending: (page) => expect(page.locator('.ll-page__wait')).toBeVisible(),
  },
  {
    group: '章節頁',
    name: '離線',
    path: `/chapter/${CHAPTER}/`,
    tablet: true,
    route: abort('**/content/*/chapter-index.*.json'),
    prepare: (page) => visible(page, 'chapter-offline'),
  },

  // 作答
  { group: '作答', name: '題目', path: `/level/${LEVEL}/`, prepare: firstQuestionReady },
  {
    group: '作答',
    name: '答對',
    path: `/level/${LEVEL}/`,
    prepare: async (page) => {
      await firstQuestionReady(page);
      await answer(page, LEVEL_Q1_RIGHT);
    },
  },
  {
    group: '作答',
    name: '答錯',
    path: `/level/${LEVEL}/`,
    prepare: async (page) => {
      await firstQuestionReady(page);
      await answer(page, LEVEL_Q1_WRONG);
    },
  },
  {
    group: '作答',
    name: '名詞小卡',
    path: `/level/${LEVEL}/`,
    prepare: async (page) => {
      await firstQuestionReady(page);
      await answer(page, LEVEL_Q1_RIGHT);
      await page.locator('.ll-feedback .ll-chip').first().click();
      await expect(page.locator('.ll-sheet__body')).toBeVisible();
    },
  },
  // 結果頁兩種固定的狀態（以前一路選第一個選項，星星數每次不同）：全對三顆星、全錯沒有星星
  {
    group: '作答',
    name: '結果頁',
    path: `/level/${RESULT_LEVEL}/`,
    prepare: (page) => playToResult(page, RESULT_LEVEL, true),
  },
  {
    group: '作答',
    name: '結果頁（沒有星星）',
    path: `/level/${RESULT_LEVEL}/`,
    prepare: (page) => playToResult(page, RESULT_LEVEL, false),
  },
  {
    group: '作答',
    name: '載入中',
    path: `/level/${LEVEL}/`,
    route: hold(`**/content/*/${LEVEL}.*.json`),
    // 沒有骨架：快照到之前整頁不顯示（.ll-page[data-ready="false"]），0.7 秒後只有一個小載入圈（lib/page-ready.tsx）
    pending: (page) => expect(page.locator('.ll-page__wait')).toBeVisible(),
  },
  {
    group: '作答',
    name: '離線',
    path: `/level/${LEVEL}/`,
    route: abort(`**/content/*/${LEVEL}.*.json`),
    prepare: (page) => expect(page.locator('main .ll-state--error')).toBeVisible(),
  },

  // 錯題本
  { group: '錯題本', name: '空', path: '/review/', prepare: (page) => expect(page.locator('.ll-review-empty')).toBeVisible() },
  {
    group: '錯題本',
    name: '有到期入口',
    path: '/review/',
    seed: (today) => ({ reviewQueue: [reviewEntry(LEVEL_Q1, today)] }),
    prepare: (page) => visible(page, 'review-start'),
  },
  {
    group: '錯題本',
    name: '複習中',
    path: '/review/',
    seed: (today) => ({ reviewQueue: [reviewEntry(LEVEL_Q1, today)] }),
    prepare: async (page) => {
      await page.getByTestId('review-start').click();
      await expect(question(page)).toBeVisible();
    },
  },
  {
    group: '錯題本',
    name: '完成',
    path: '/review/',
    seed: (today) => ({ reviewQueue: [reviewEntry(LEVEL_Q1, today)] }),
    prepare: async (page) => {
      await page.getByTestId('review-start').click();
      await answer(page, LEVEL_Q1_RIGHT);
      await next(page);
      await expect(page.locator('.ll-result--review')).toBeVisible();
    },
  },
  {
    group: '錯題本',
    name: '有下架題',
    path: '/review/',
    seed: (today) => ({ reviewQueue: [reviewEntry(LEVEL_Q1, today), reviewEntry(RETIRED_QUESTION, today)] }),
    prepare: (page) => expect(page.locator('.ll-review-retired')).toBeVisible(),
  },
  // 下架題有作答紀錄（帶 levelId）：列上寫得出原本的關卡，不是後備的說明文字
  {
    group: '錯題本',
    name: '有下架題（找得到原本的關卡）',
    path: '/review/',
    seed: (today) => ({
      reviewQueue: [reviewEntry(LEVEL_Q1, today), reviewEntry(RETIRED_QUESTION, today)],
      attempts: [
        {
          attemptId: 'a_e2e000000077',
          questionId: RETIRED_QUESTION,
          rev: 1,
          levelId: 'lv_r2ctekx1',
          answer: 'o_zzzz',
          correct: false,
          answeredAt: PLAYED,
          deviceId: 'd_e2e00001',
          source: 'play',
        },
      ],
    }),
    prepare: (page) => expect(page.locator('.ll-review-retired')).toBeVisible(),
  },

  // 名詞圖鑑
  { group: '名詞圖鑑', name: '依章節', path: '/terms/', tablet: true, prepare: (page) => visible(page, 'term-list') },
  { group: '名詞圖鑑', name: '依名稱', path: '/terms/?group=name', tablet: true, prepare: (page) => visible(page, 'term-list') },
  {
    group: '名詞圖鑑',
    name: '搜尋命中參考名詞',
    path: (d, prefix) => `/terms/?q=${encodeURIComponent(d.reference.label[prefix as '' | '/en'])}`,
    tablet: true,
    prepare: (page) => visible(page, 'term-pills'),
  },
  { group: '名詞圖鑑', name: '搜尋無結果', path: '/terms/?q=zzzzzz', tablet: true, prepare: (page) => visible(page, 'terms-empty') },
  {
    group: '名詞圖鑑',
    name: '參考名詞展開',
    path: '/terms/',
    tablet: true,
    prepare: async (page) => {
      const toggle = page.getByTestId('terms-reference-toggle');
      await toggle.locator('summary').click();
      await expect(toggle).toHaveAttribute('open', '');
      await visible(page, 'term-pills');
    },
  },

  // 名詞頁
  {
    group: '名詞頁',
    name: '已收進',
    path: `/terms/${TERM}/`,
    seed: { unlocks: [{ id: `term:${TERM}`, kind: 'term', unlockedAt: PLAYED }] },
    prepare: (page) => visible(page, 'term-definition'),
  },
  { group: '名詞頁', name: '未收進', path: `/terms/${TERM}/`, prepare: (page) => visible(page, 'term-definition') },
  { group: '名詞頁', name: '參考', path: (d) => `/terms/${d.reference.id}/`, prepare: (page) => visible(page, 'term-definition') },

  // 我的
  { group: '我的', name: '新使用者', path: '/me/', tablet: true },
  { group: '我的', name: '有進度', path: '/me/', tablet: true, seed: progressSeed, prepare: (page) => visible(page, 'badge-summary') },
  {
    group: '我的',
    name: '有收藏（含下架題）',
    path: '/me/',
    tablet: true,
    seed: { settings: [{ key: 'favourites', value: [FAV_QUESTION, RETIRED_QUESTION], updatedAt: PLAYED }] },
    prepare: async (page) => {
      await expect(page.getByTestId('favourites').locator(`[data-question-id="${FAV_QUESTION}"]`)).toBeVisible();
      await expect(page.getByTestId('favourites').locator(`[data-question-id="${RETIRED_QUESTION}"]`)).toBeVisible();
    },
  },

  // 其他子頁
  { group: '其他子頁', name: '設定', path: '/me/settings/' },
  { group: '其他子頁', name: '備份', path: '/me/backup/', prepare: (page) => visible(page, 'backup-stats') },
  {
    group: '其他子頁',
    name: '備份預覽',
    path: '/me/backup/',
    prepare: async (page) => {
      await page
        .context()
        .grantPermissions(['clipboard-read', 'clipboard-write'])
        .catch(() => {});
      await page.getByRole('button', { name: /^(複製備份碼|Copy backup code)$/ }).click();
      const code = page.getByTestId('backup-code');
      await expect(code).toHaveValue(/^LL1:/);
      await page.getByTestId('paste-code').fill(await code.inputValue());
      await page.getByRole('button', { name: /^(檢查備份碼|Check backup code)$/ }).click();
      await visible(page, 'import-preview');
    },
  },
  {
    group: '其他子頁',
    name: '備份錯誤',
    path: '/me/backup/',
    prepare: async (page) => {
      await page.getByTestId('paste-code').fill('XX1:not-a-code');
      await page.getByRole('button', { name: /^(檢查備份碼|Check backup code)$/ }).click();
      await visible(page, 'import-error');
    },
  },
  { group: '其他子頁', name: '徽章', path: '/me/badges/' },
  { group: '其他子頁', name: '安裝教學', path: '/install/' },
  { group: '其他子頁', name: '隱私說明', path: '/privacy/' },
  { group: '其他子頁', name: '關於與授權', path: '/about/' },
  { group: '其他子頁', name: '關於系統設計', path: '/design/' },
  { group: '其他子頁', name: '診斷資訊', path: '/debug/' },

  // 頂層與錯誤
  { group: '頂層與錯誤', name: '實驗室', path: '/lab/' },
  { group: '頂層與錯誤', name: '找不到頁面', path: '/no-such-page/', prepare: (page) => visible(page, 'not-found') },
  { group: '頂層與錯誤', name: '路由錯誤', path: '/privacy/', route: abort('**/assets/Privacy-*.js'), prepare: (page) => visible(page, 'route-error') },

  // 橫幅
  {
    group: '橫幅',
    name: '備份提醒',
    path: '/',
    env: { notPersisted: true },
    seed: { settings: [{ key: 'backupReminder', value: { levelsCompletedSinceExport: 3 }, updatedAt: PLAYED }] },
    prepare: (page) => expect(page.locator('.ll-backup-reminder')).toBeVisible(),
  },
  {
    group: '橫幅',
    name: '安裝 bip',
    path: '/',
    chromiumOnly: true,
    storage: { 'll:visited': '1' },
    seed: { settings: [{ key: 'levelsCompleted', value: 1, updatedAt: PLAYED }] },
    bip: true,
    prepare: (page) => visible(page, 'install-prompt'),
  },
  {
    group: '橫幅',
    name: '安裝 ios（圖解展開）',
    path: '/',
    env: { ua: IOS_SAFARI },
    storage: { 'll:visited': '1' },
    session: { [EPHEMERAL_DISMISSED]: '1' },
    seed: { settings: [{ key: 'levelsCompleted', value: 1, updatedAt: PLAYED }] },
    prepare: async (page) => {
      const toggle = page.getByTestId('install-guide-toggle');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('.ll-install-prompt__guide')).toBeVisible();
      // 圖解是延後載入的 chunk：等它真的畫出來再拍（不是載入中的骨架）
      await expect(page.getByTestId('install-guide')).toBeVisible();
    },
  },
  {
    group: '橫幅',
    name: 'Safari 分頁展開',
    path: '/',
    env: { ua: IOS_SAFARI },
    session: { [EPHEMERAL_DISMISSED]: '1' },
    prepare: (page) => expect(page.locator('.ll-banner.ll-safari-notice')).toBeVisible(),
  },
  {
    group: '橫幅',
    name: 'Safari 分頁收合',
    path: '/',
    env: { ua: IOS_SAFARI },
    session: { 'll:safari-notice-collapsed': '1', [EPHEMERAL_DISMISSED]: '1' },
    prepare: (page) => expect(page.locator('.ll-safari-notice--collapsed')).toBeVisible(),
  },
  {
    group: '橫幅',
    name: '內建瀏覽器展開',
    path: '/',
    env: { ua: IOS_LINE },
    session: { [EPHEMERAL_DISMISSED]: '1' },
    prepare: (page) => expect(page.locator('.ll-banner.ll-inapp')).toBeVisible(),
  },
  {
    group: '橫幅',
    name: '內建瀏覽器收合',
    path: '/',
    env: { ua: IOS_LINE },
    session: { 'll:inapp-collapsed': '1', [EPHEMERAL_DISMISSED]: '1' },
    prepare: (page) => visible(page, 'inapp-collapsed'),
  },
  {
    group: '橫幅',
    name: '語言建議',
    path: '/',
    env: { otherLanguage: true },
    prepare: (page) => expect(page.locator('.ll-locale-banner')).toBeVisible(),
  },
  {
    group: '橫幅',
    name: '相機預覽提示',
    path: '/',
    env: { ua: IOS_SAFARI, quota: 1024 ** 3 },
    prepare: (page) => expect(page.locator('.ll-ephemeral-notice')).toBeVisible(),
  },
  // Toast：站規寫「複製關卡代號觸發」，但複製代號現在是按鈕本身換成「已複製」（LevelCode），不再出 Toast；改用地圖的取得徽章 Toast
  {
    group: '橫幅',
    name: 'Toast（取得徽章）',
    path: `${MAP_FIXTURE}&ll-fixture-progress=ch1new`,
    noLinks: true,
    prepare: (page) => visible(page, 'badge-toasts'),
  },
  { group: '橫幅', name: '更新提示', path: '/?ll-banner=update', fixtureOnly: true, prepare: (page) => expect(page.locator('.ll-updatebar')).toBeVisible() },
  ...(['suspended', 'blocked', 'degraded', 'quota', 'writeFailed'] as const).map((s): PageCase => ({
    group: '橫幅',
    name: `儲存 ${s}`,
    path: `/?ll-banner=storage-${s}`,
    fixtureOnly: true,
    prepare: (page) => visible(page, `storage-${s}`),
  })),
];

export function caseByName(group: string, name: string): PageCase {
  const c = CASES.find((x) => x.group === group && x.name === name);
  if (!c) throw new Error(`page-states：沒有 ${group}／${name}`);
  return c;
}

let dataCache: Promise<CaseData> | null = null;
/** 動態的期待值（從正在服務的快照讀，內容改寫後不必改測試） */
export function caseData(request: APIRequestContext): Promise<CaseData> {
  dataCache ??= (async () => {
    const [zh, en] = await Promise.all([termIndexOf(request, 'zh-TW'), termIndexOf(request, 'en')]);
    const ref = zh.find((t) => isReference(t) && t.label.length >= 2);
    if (!ref) throw new Error('page-states：快照裡沒有參考名詞');
    const enLabel = en.find((t) => t.id === ref.id)?.label ?? ref.label;
    return { reference: { id: ref.id, label: { '': ref.label, '/en': enLabel } } };
  })();
  return dataCache;
}

export function themeQuery(t: Theme): string {
  return t.flavor ? `ll-theme=${t.theme}&ll-flavor=${t.flavor}` : `ll-theme=${t.theme}`;
}

/** 等畫面靜止：有限長度的動畫與轉場都跑完（無限循環的不等），再等兩個影格 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const finite = document.getAnimations().filter((a) => {
      const end = a.effect?.getComputedTiming().endTime;
      return a.playState === 'running' && typeof end === 'number' && Number.isFinite(end);
    });
    await Promise.race([Promise.all(finite.map((a) => a.finished.catch(() => undefined))), new Promise((r) => setTimeout(r, 1500))]);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

/** 不重新載入就換主題：寫入和 ?ll-theme 相同的兩個 key，再呼叫 boot 腳本的 applyTheme（設定頁也是這樣換） */
export async function switchTheme(page: Page, t: Theme): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem('ll:theme', t.theme);
    if (t.flavor) localStorage.setItem('ll:dark-flavor', t.flavor);
    (window as unknown as { __llApplyTheme: () => void }).__llApplyTheme();
  }, t);
  await settle(page);
}

async function applyEnv(page: Page, env: Env, prefix: string): Promise<void> {
  const languages = env.otherLanguage ? (prefix ? ['zh-TW', 'zh'] : ['en-GB', 'en']) : null;
  await page.addInitScript(
    ({ e, languages }: { e: Env; languages: string[] | null }) => {
      if (e.ua) Object.defineProperty(Navigator.prototype, 'userAgent', { get: () => e.ua, configurable: true });
      if (languages) {
        Object.defineProperty(Navigator.prototype, 'languages', { get: () => languages, configurable: true });
        Object.defineProperty(Navigator.prototype, 'language', { get: () => languages[0], configurable: true });
      }
      if (e.appMode) Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true, configurable: true });
      const storage = navigator.storage;
      if (storage && e.quota !== undefined) {
        const estimate = storage.estimate.bind(storage);
        storage.estimate = async () => ({ ...(await estimate()), quota: e.quota });
      }
      if (storage && e.notPersisted) storage.persisted = async () => false;
    },
    { e: env, languages },
  );
}

/** 直接寫進進度資料庫（結構由 App 啟動時建立） */
export async function seedDb(page: Page, seed: Seed): Promise<void> {
  await waitForProgressDb(page, Object.keys(seed));
  await page.evaluate(
    (seed) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ledgerland');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const conn = req.result;
          const tx = conn.transaction(Object.keys(seed), 'readwrite');
          for (const [store, records] of Object.entries(seed)) for (const r of records) tx.objectStore(store).put(r);
          tx.oncomplete = () => {
            conn.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    seed,
  );
}

/** 模擬 Chromium 送出 beforeinstallprompt（Playwright 的 Chromium 不會真的送） */
async function fireBeforeInstallPrompt(page: Page): Promise<void> {
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt?: () => Promise<void>; userChoice?: Promise<unknown> };
    e.prompt = () => Promise.resolve();
    e.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(e);
  });
}

export function pathOf(c: PageCase, data: CaseData, prefix: string): string {
  return typeof c.path === 'function' ? c.path(data, prefix) : c.path;
}

/** 打開一個狀態：環境與儲存先就位、攔請求、開頁（必要時寫資料庫後重新整理）、等內容到齊、做準備動作、等畫面靜止 */
export async function openCase(page: Page, c: PageCase, opts: { width: number; prefix: string; theme: Theme; data: CaseData; height?: number }): Promise<void> {
  const { width, prefix, theme, data } = opts;
  await page.setViewportSize({ width, height: opts.height ?? 900 });
  if (c.env) await applyEnv(page, c.env, prefix);
  const storage = c.storage;
  if (storage || c.session) {
    await page.addInitScript(
      ({ s, ss }) => {
        try {
          for (const [k, v] of Object.entries(s ?? {})) localStorage.setItem(k, v);
          for (const [k, v] of Object.entries(ss ?? {})) sessionStorage.setItem(k, v);
        } catch {
          /* 無痕模式 */
        }
      },
      { s: storage, ss: c.session },
    );
  }
  if (c.route) await c.route(page);
  const path = pathOf(c, data, prefix);
  await page.goto(`${prefix}${path}${path.includes('?') ? '&' : '?'}${themeQuery(theme)}`);
  if (c.seed) {
    await waitForApp(page);
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    await seedDb(page, typeof c.seed === 'function' ? c.seed(today) : c.seed);
    await page.reload();
  }
  await waitForApp(page);
  if (c.pending) await c.pending(page);
  // 延後載入的內容（名詞索引、進度、場景）到齊：等網路安靜（有請求一直掛著的載入中狀態不等）
  else await page.waitForLoadState('networkidle');
  if (c.bip) await fireBeforeInstallPrompt(page);
  if (c.prepare) await c.prepare(page);
  await settle(page);
}
