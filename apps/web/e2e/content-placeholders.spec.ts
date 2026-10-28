// 真實內容的數值佔位符（05 第 10 節、04 第 16.1 節）：獨立 QA 第 2 輪發現 ratio_numeric 的解說以 {{…:expected.answer.value}} 引用答案，
// 快照卻只有 compiled.ratio，前端解析不到就畫成空白（「每股盈餘：本期淨利 ÷ 股數 ＝ 。」），content:check 與自編題目的 E2E 都沒有攔到。
// 1. 對正在服務的快照（兩種語言、每一題、除 compiled 以外的每個字串欄位）用前端同一套規則（placeholders.ts 的 valueContextOf 與 resolveValueRef）
//    檢查每個 money、percent、number、date 佔位符都解析得到值。
// 2. 每一題引用 expected.answer 的 ratio_numeric 都用正解作答，解說裡出現格式化後的答案，「＝」後面不是空白。
// 期待值一律從快照算出，內容調整後不必改測試。
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { formatValuePlaceholder, resolveValueRef, splitMarkup, valueContextOf } from '../src/features/quiz/placeholders.ts';
import type { QuestionSnapshot } from '../src/lib/content.ts';
import { waitForApp } from './helpers.ts';

const LOCALES = ['zh-TW', 'en'] as const;
const NUMERIC = new Set(['money', 'percent', 'number', 'date']);

interface Manifest {
  levels: { id: string; questionIds: string[]; files: Record<string, string> }[];
}
interface LevelFile {
  level: { id: string; questionIds: string[] };
  questions: QuestionSnapshot[];
}
/** 關卡在所屬章節的章節包裡（schemaVersion 3）：manifest.levels[].files 指向章節包 */
interface ChapterBundle {
  levels: LevelFile[];
}

async function getJson<T>(request: APIRequestContext, path: string): Promise<T> {
  const res = await request.get(path.startsWith('/') ? path : `/${path}`);
  expect(res.ok(), path).toBe(true);
  return (await res.json()) as T;
}

const bundleCache = new Map<string, Promise<ChapterBundle>>();
/** 一關的快照：讀所屬章節的章節包（同一檔只讀一次）再取關卡 */
async function levelFileOf(request: APIRequestContext, l: Manifest['levels'][number], locale: string): Promise<LevelFile> {
  const path = l.files[locale]!;
  let p = bundleCache.get(path);
  if (!p) {
    p = getJson<ChapterBundle>(request, path);
    bundleCache.set(path, p);
  }
  const found = (await p).levels.find((x) => x.level.id === l.id);
  if (!found) throw new Error(`${path} 裡沒有關卡 ${l.id}`);
  return found;
}

/** 題目快照裡給人看的字串（compiled 是核心算出的資料，不含佔位符） */
function* stringsOf(v: unknown, path: string): Generator<[string, string]> {
  if (typeof v === 'string') yield [path, v];
  else if (Array.isArray(v)) for (const [i, x] of v.entries()) yield* stringsOf(x, `${path}[${i}]`);
  else if (v !== null && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) if (k !== 'compiled') yield* stringsOf(x, path === '' ? k : `${path}.${k}`);
}

function usesAnswer(q: QuestionSnapshot): boolean {
  return q.type === 'ratio_numeric' && typeof q['explanation'] === 'string' && /expected\.answer\./.test(q['explanation']);
}

test.describe('真實內容的數值佔位符', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', '只讀快照與逐題作答，在 Chromium 跑一次就夠');
  // 第 2 項用 page.route 把關卡改成只留指定的題目；Service Worker 接管之後關卡檔從 precache 回應，page.route 攔不到，
  // 後面幾關就會從原本的第一題開始。原本靠「每一關做得夠快、SW 還沒裝好」才通過；2026-10-24 四種題型改成第一次繪製後才載入元件，
  // 每一關多約 0.5 秒，第 3 關起就被 SW 接管。這裡不測 SW，直接擋掉
  test.use({ serviceWorkers: 'block' });

  test('每一題的數值佔位符都解析得到值（兩種語言）', async ({ request }) => {
    const m = await getJson<Manifest>(request, '/content/content-manifest.json');
    const unresolved: string[] = [];
    let placeholders = 0;
    for (const locale of LOCALES)
      for (const l of m.levels) {
        const file = await levelFileOf(request, l, locale);
        for (const q of file.questions) {
          const ctx = valueContextOf(q);
          for (const [path, text] of stringsOf(q, ''))
            for (const s of splitMarkup(text)) {
              if (s.kind !== 'placeholder' || !NUMERIC.has(s.type)) continue;
              placeholders++;
              const formatted = formatValuePlaceholder(s.type, s.ref, s.options, ctx, locale);
              if (resolveValueRef(s.ref, ctx) === undefined || formatted === '')
                unresolved.push(`${locale} ${l.id} ${q.id} ${q.type} ${path}: {{${s.type}:${s.ref}}}`);
            }
        }
      }
    test.info().annotations.push({ type: 'placeholders', description: `檢查 ${placeholders} 個數值佔位符` });
    expect(placeholders).toBeGreaterThan(0);
    expect(unresolved).toEqual([]);
  });

  /** 關卡只留指定的題目（manifest 與兩種語言的章節包裡的這一關都改），作答頁直接從第一題開始 */
  async function onlyQuestions(page: Page, m: Manifest, levelId: string, ids: readonly string[]): Promise<void> {
    await page.route('**/content/content-manifest.json', async (route) => {
      const res = await route.fetch();
      const json = (await res.json()) as Manifest;
      for (const l of json.levels) if (l.id === levelId) l.questionIds = [...ids];
      await route.fulfill({ response: res, json });
    });
    const lv = m.levels.find((l) => l.id === levelId)!;
    for (const locale of LOCALES)
      await page.route(`**/${lv.files[locale]}`, async (route) => {
        const res = await route.fetch();
        const json = (await res.json()) as ChapterBundle;
        const target = json.levels.find((x) => x.level.id === levelId);
        if (!target) throw new Error(`${lv.files[locale]} 裡沒有關卡 ${levelId}`);
        target.questions = target.questions.filter((q) => ids.includes(q.id));
        target.level.questionIds = [...ids];
        await route.fulfill({ response: res, json });
      });
  }

  for (const locale of LOCALES) {
    test(`指標計算題用正解作答，解說裡有答案的數字（${locale}）`, async ({ page, request }) => {
      test.setTimeout(180_000);
      const m = await getJson<Manifest>(request, '/content/content-manifest.json');
      const problems: string[] = [];
      let count = 0;
      for (const l of m.levels) {
        const file = await levelFileOf(request, l, locale);
        const qs = file.questions.filter((q) => usesAnswer(q) && q.compiled?.ratio?.status !== 'na');
        if (qs.length === 0) continue;
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await onlyQuestions(
          page,
          m,
          l.id,
          qs.map((q) => q.id),
        );
        await page.goto(locale === 'en' ? `/en/level/${l.id}/` : `/level/${l.id}/`);
        await waitForApp(page);
        for (const [i, q] of qs.entries()) {
          const card = page.locator('.ll-question');
          // 第一題齊了整頁才顯示、換題後作答區齊了題目卡才顯示（沒有骨架）
          await expect(page.locator('.ll-page[data-ready="true"]')).toBeVisible();
          await expect(page.locator('.ll-question-wrap[data-ready="true"]')).toBeVisible();
          await card.getByRole('textbox').fill(String(q.compiled!.ratio!.displayValue));
          const submit = page.getByRole('button', { name: locale === 'en' ? 'Check answer' : '確認答案' });
          await expect(submit).toBeEnabled();
          await submit.click();
          const feedback = page.locator('.ll-feedback');
          await feedback.waitFor();
          const text = (await feedback.innerText()).replace(/\s+/g, ' ');
          const ctx = valueContextOf(q);
          for (const s of splitMarkup(q['explanation'] as string)) {
            if (s.kind !== 'placeholder' || !s.ref.startsWith('expected.answer.')) continue;
            const value = formatValuePlaceholder(s.type, s.ref, s.options, ctx, locale);
            if (value === '' || !text.includes(value)) problems.push(`${l.id} ${q.id}：解說沒有答案「${value}」：${text.slice(0, 200)}`);
          }
          if (/[＝=]\s*[。．.，,）)]/.test(text)) problems.push(`${l.id} ${q.id}：「＝」後面是空白：${text.slice(0, 200)}`);
          count++;
          if (i < qs.length - 1) await page.getByRole('button', { name: locale === 'en' ? 'Next question' : '下一題' }).click();
        }
      }
      test.info().annotations.push({ type: 'answered', description: `用正解作答 ${count} 題` });
      expect(count).toBeGreaterThan(0);
      expect(problems).toEqual([]);
    });
  }
});
