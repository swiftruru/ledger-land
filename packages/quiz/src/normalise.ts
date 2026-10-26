// 作答的正規化（03 第 2.12 節）：不帶 zod 的純函式，作答頁第一次繪製就會用到（apps/web 的 features/quiz/answers.ts），
// 所以和 answers.ts 的 zod schema 分開放，不然打包器會把 zod 與 content-schema 的 schema 一起帶進作答頁第一波的 chunk（06 第 8.2 節）。

/** 多正解題的作答正規化：去重並依 ID 排序，any_correct 與 all_correct 共用 */
export function normaliseMultiChoiceAnswer(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
