// 名詞頁的長文（定義與附註）：空行分段，佔位符換成純文字（數值依語系格式化、{{term:…}} 換成名詞名稱）。
// 名詞頁不在 TermsProvider 裡（不做名詞 chip），所以用 placeholders.ts 的 renderPlain；純函式，單元測試在 apps/web/test/glossary.test.ts。
// 刻意不放在 features/glossary：那個資料夾是名詞列表、名詞頁與徽章共用的 glossary chunk（vite.config.ts），放進去的話名詞列表也得載佔位符所在的
// 那時的 level-view 與 session 兩個 chunk，本機 Lighthouse 量到名詞列表的 LCP 多約 150ms（2026-10-24）；只有名詞頁 import 它，跟著名詞頁的 chunk 走。
// 佔位符本身（placeholders.ts）從 2026-10-26 起在 prose chunk（名詞頁與作答頁共用的切詞與佔位符），名詞頁不再為了它載作答頁的 chunk
import type { Locale } from '@ledgerland/i18n';
import { renderPlain, splitParagraphs } from '../quiz/placeholders.ts';

const TERM_REF_RE = /\{\{\s*term\s*:/;

/** 文字裡有沒有 {{term:…}}（有才需要讀名詞索引取名稱） */
export function hasTermRefs(...texts: readonly (string | undefined)[]): boolean {
  return texts.some((t) => t !== undefined && TERM_REF_RE.test(t));
}

/** 分段並換掉佔位符；讀不到名稱的名詞留空字串以外的 ID 本身（由內容驗證器在建置期攔下） */
export function plainParagraphs(text: string, locale: Locale, labelOf: (id: string) => string | undefined = () => undefined): string[] {
  return splitParagraphs(text).map((p) => renderPlain(p, {}, locale, { term: labelOf }));
}
