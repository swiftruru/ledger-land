// 作答頁標題下的範圍標示（10 第 10 節第 3 項、03 第 3 節、11 第 1 節）：用關卡代號或課堂 QR 直接進關卡的學生不會先看到地圖與章節頁，
// 所以作答頁自己標「延伸，不列入期中考」，涉及投資的延伸章另加「非投資建議」聲明。三項都來自 content-manifest 的章節摘要：
// scope 與 examScope（M3，T32），以及章節檔標記的 notices（not_investment_advice，2026-10-24 決定 4；tools/lib/content-snapshot.mjs）。
// 前端不列章節清單，哪一章要加聲明由內容決定。純函式，單元測試在 apps/web/test/level-notes.test.ts。

/** 章節的固定聲明代號（packages/content-schema 的 ChapterNotice）；介面只認得這一種，其他代號忽略 */
export const NOT_INVESTMENT_ADVICE = 'not_investment_advice';

export interface LevelNotes {
  /** 延伸章或 examScope 為 not_in_exam 的章 */
  readonly notInExam: boolean;
  /** 章節的 notices 含 not_investment_advice */
  readonly investment: boolean;
}

export function levelNotesOf(chapter: { scope?: string; examScope?: string; notices?: readonly string[] } | undefined): LevelNotes {
  return {
    notInExam: chapter?.scope === 'extension' || chapter?.examScope === 'not_in_exam',
    investment: chapter?.notices?.includes(NOT_INVESTMENT_ADVICE) ?? false,
  };
}
