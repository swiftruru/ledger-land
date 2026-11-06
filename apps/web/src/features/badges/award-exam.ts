// 苦練徽章的寫入（features/badges/exam.ts 的判定）：達成的那一刻寫進進度（背題瀏覽按「讀完了」、模擬考交卷），
// 苦練首頁打開時再判定一次全部（補發：作答的兩枚在這裡發，之前就達標的人也在這裡補上）。
// 回傳目前擁有的與這一次新寫入的；進度讀不到或寫不進去時不丟錯，當作這一次沒有新徽章（下次再補）。
import { getProgressStore, nowIso } from '../../lib/progress/index.ts';
import { EXAM_BADGES, earnedExamBadges, examBadgesOf, type ExamBadgeFacts, type ExamBadgeKey } from './exam.ts';

export interface ExamBadgeAward {
  /** 目前擁有的苦練徽章與取得時間（含這一次新寫入的） */
  readonly owned: ReadonlyMap<ExamBadgeKey, string>;
  /** 這一次新寫入的，依 EXAM_BADGES 的順序 */
  readonly added: readonly ExamBadgeKey[];
}

export async function awardExamBadges(facts: ExamBadgeFacts): Promise<ExamBadgeAward> {
  try {
    const store = await getProgressStore();
    const unlocks = new Map((await store.listUnlocks('badge')).map((u) => [u.id, u.unlockedAt] as const));
    const owned = examBadgesOf(unlocks);
    const earned = new Set(earnedExamBadges(facts));
    const added: ExamBadgeKey[] = [];
    for (const def of EXAM_BADGES) {
      if (!earned.has(def.key) || owned.has(def.key)) continue;
      const unlockedAt = nowIso();
      await store.addUnlock({ id: def.unlockId, kind: 'badge', unlockedAt });
      owned.set(def.key, unlockedAt);
      added.push(def.key);
    }
    return { owned, added };
  } catch {
    return { owned: new Map(), added: [] };
  }
}
