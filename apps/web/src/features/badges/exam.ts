// 苦練徽章（2026-11-06，03 第 2.10 節）：期中考苦練自己的一類徽章，和章節徽章、特別徽章分開算。
// 六枚，跟著苦練首頁的三步各兩枚（一枚好拿、一枚要走完）：
//   讀題：讀完一份（任一份講義全部讀完）、讀遍題庫（全部讀完）
//   刷題：題題練過（每一題都作答過）、錯題歸零（每一題都練過，而且沒有一題停在答錯）
//   模擬考：初次上場（交卷一次夠長的模擬考）、模擬考過關（夠長的模擬考答對八成）
// 存法和其他徽章一樣是 ProgressStore 的 unlock（kind badge），ID 以 badge:exam: 開頭，會跟著備份走；拿到就不收回
// （題庫之後增加、把已讀改回未讀、後來又答錯，都不影響已經拿到的徽章）。這個檔案只有定義與判定，沒有 DOM、沒有 React、不碰儲存。
export const EXAM_BADGE_PREFIX = 'badge:exam:';

export type ExamBadgeStep = 'read' | 'practise' | 'mock';

export interface ExamBadgeDef {
  /** 徽章的鍵（名稱與條件的字串跟著它，features/badges/exam-text.ts） */
  readonly key: string;
  readonly unlockId: `${typeof EXAM_BADGE_PREFIX}${string}`;
  /** 屬於苦練首頁的哪一步（圖樣的顏色與圖案跟著它） */
  readonly step: ExamBadgeStep;
  /** 1 是那一步好拿的一枚，2 是要走完的一枚（緞帶上多一顆星） */
  readonly tier: 1 | 2;
}

export const EXAM_BADGES = [
  { key: 'readDeck', unlockId: 'badge:exam:read-deck', step: 'read', tier: 1 },
  { key: 'readAll', unlockId: 'badge:exam:read-all', step: 'read', tier: 2 },
  { key: 'practisedAll', unlockId: 'badge:exam:practised-all', step: 'practise', tier: 1 },
  { key: 'noWrong', unlockId: 'badge:exam:no-wrong', step: 'practise', tier: 2 },
  { key: 'mockFirst', unlockId: 'badge:exam:mock-first', step: 'mock', tier: 1 },
  { key: 'mockPass', unlockId: 'badge:exam:mock-pass', step: 'mock', tier: 2 },
] as const satisfies readonly ExamBadgeDef[];

export type ExamBadgeKey = (typeof EXAM_BADGES)[number]['key'];

/** 模擬考的兩枚徽章：至少要這麼多題才算（太短的場次不算），過關是答對這個比例以上（沒作答的題算錯） */
export const MOCK_BADGE_MIN_QUESTIONS = 30;
export const MOCK_BADGE_PASS_RATIO = 0.8;

/** unlock ID 是不是苦練徽章（章節徽章的計數要排除） */
export function isExamBadgeId(id: string): boolean {
  return id.startsWith(EXAM_BADGE_PREFIX);
}

/** 判定用的事實：只給手上有的那幾樣，沒給的那一類徽章這一次不判定 */
export interface ExamBadgeFacts {
  /** 讀題：各份講義的題目 ID 與已讀的題 */
  readonly read?: { readonly decks: readonly (readonly string[])[]; readonly readIds: ReadonlySet<string> };
  /** 刷題：全部題目裡練過幾題、有幾題最近一次答錯（features/exam/stats.ts 的 statsOf） */
  readonly practice?: { readonly total: number; readonly practised: number; readonly wrong: number };
  /** 模擬考：一次已經交卷的成績 */
  readonly mock?: { readonly total: number; readonly correct: number };
}

/** 依事實算出這一次達成的徽章（不看已經有沒有） */
export function earnedExamBadges({ read, practice, mock }: ExamBadgeFacts): ExamBadgeKey[] {
  const out: ExamBadgeKey[] = [];
  if (read) {
    const decks = read.decks.filter((ids) => ids.length > 0);
    const done = decks.filter((ids) => ids.every((id) => read.readIds.has(id)));
    if (done.length > 0) out.push('readDeck');
    if (decks.length > 0 && done.length === decks.length) out.push('readAll');
  }
  if (practice && practice.total > 0 && practice.practised >= practice.total) {
    out.push('practisedAll');
    if (practice.wrong === 0) out.push('noWrong');
  }
  if (mock && mock.total >= MOCK_BADGE_MIN_QUESTIONS) {
    out.push('mockFirst');
    if (mock.correct / mock.total >= MOCK_BADGE_PASS_RATIO) out.push('mockPass');
  }
  return out;
}

/** 由 unlock（id 對 unlockedAt）算出已經拿到的苦練徽章與各自的取得時間 */
export function examBadgesOf(unlocks: ReadonlyMap<string, string>): Map<ExamBadgeKey, string> {
  const out = new Map<ExamBadgeKey, string>();
  for (const def of EXAM_BADGES) {
    const at = unlocks.get(def.unlockId);
    if (at !== undefined) out.set(def.key, at);
  }
  return out;
}
