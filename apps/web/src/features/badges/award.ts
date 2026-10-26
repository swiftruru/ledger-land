// 章節徽章的寫入時機（03 第 2.10 節）：完成關卡的那一刻就判定並寫進進度，不等打開地圖。
// 以前只有 /play/ 會寫（Play.tsx），學生做完最後一關直接去「我的 › 徽章」或匯出備份時，徽章不在進度裡、匯出檔也沒有，取得日期還變成打開地圖那天。
// 現在：作答頁寫完 levelProgress 後呼叫 awardChapterBadges；「我的 › 徽章」與備份頁讀進度前也呼叫一次（補上這個修正之前完成、還沒開過地圖的章）。
// 地圖的 Toast 仍然要出現：這裡新寫入的徽章記在 pendingCelebrations，地圖判定時一併取出（takeCelebrations）。
import type { Locale } from '@ledgerland/i18n';
import { contentSource, type QuestMapData } from '../quest-map/data.ts';
import { earnedBadges, loadMapProgress, masteryUnlockId, syncBadges, type EarnedBadge, type MapProgress } from '../quest-map/progress.ts';

/** 精通徽章的取得時間：這一章各關最後一次遊玩的時間取最晚；章內都沒有紀錄時 undefined。
 *  是上限的近似值：精通之後又重玩過，日期會晚於真正取得的那天（進度只記每關的第一次完成與最後一次遊玩） */
export function badgeEarnedAt(data: QuestMapData, progress: MapProgress, chapterId: string): string | undefined {
  const c = data.chapterById.get(chapterId);
  let latest: string | undefined;
  for (const l of c?.levels ?? []) {
    const at = progress.levels.get(l.id)?.lastPlayedAt;
    if (at !== undefined && (latest === undefined || at > latest)) latest = at;
  }
  return latest;
}

/** 完成徽章的取得時間（finding map-3）：計分關卡（整章不計分時是全部關卡）第一次完成的時間取最晚，沒有記第一次完成的關卡退回最後遊玩時間。
 *  完成之後重玩不會改變它；第一次完成可能是 0 顆星，所以是下限的近似值。章內都沒有紀錄時 undefined */
export function badgeDoneAt(data: QuestMapData, progress: MapProgress, chapterId: string): string | undefined {
  const levels = data.chapterById.get(chapterId)?.levels ?? [];
  const scored = levels.filter((l) => !l.unscored);
  let latest: string | undefined;
  for (const l of scored.length > 0 ? scored : levels) {
    const best = progress.levels.get(l.id);
    const at = best?.firstCompletedAt ?? best?.lastPlayedAt;
    if (at !== undefined && (latest === undefined || at > latest)) latest = at;
  }
  return latest;
}

let pending: EarnedBadge[] = [];

/** 記下要在地圖上慶祝的徽章（同一章只留一筆，後來的等級較高時取代） */
export function rememberCelebrations(earned: readonly EarnedBadge[]): void {
  for (const e of earned) {
    const i = pending.findIndex((p) => p.chapterId === e.chapterId);
    if (i === -1) pending.push(e);
    else
      pending[i] = {
        chapterId: e.chapterId,
        state: e.state === 'mastery' ? 'mastery' : pending[i]!.state,
        unlockIds: [...new Set([...pending[i]!.unlockIds, ...e.unlockIds])],
      };
  }
}

/** 取出並清空待慶祝的徽章（地圖顯示 Toast 用） */
export function takeCelebrations(): EarnedBadge[] {
  const out = pending;
  pending = [];
  return out;
}

/** 合併地圖自己判定的新徽章與待慶祝的徽章（同一章只留一則 Toast，精通優先），依地圖的章節順序 */
export function mergeCelebrations(data: QuestMapData, fromMap: readonly EarnedBadge[], remembered: readonly EarnedBadge[]): EarnedBadge[] {
  const byChapter = new Map<string, EarnedBadge>();
  for (const e of [...remembered, ...fromMap]) {
    const prev = byChapter.get(e.chapterId);
    byChapter.set(
      e.chapterId,
      prev === undefined
        ? e
        : {
            chapterId: e.chapterId,
            state: prev.state === 'mastery' || e.state === 'mastery' ? 'mastery' : 'done',
            unlockIds: [...new Set([...prev.unlockIds, ...e.unlockIds])],
          },
    );
  }
  return data.chapters.flatMap((c) => byChapter.get(c.id) ?? []);
}

export interface AwardOptions {
  /** 新寫入的徽章是否記下來給地圖慶祝（作答頁是；「我的」與備份頁補寫時不必） */
  readonly celebrate?: boolean;
}

/** 依星星判定已達成、但進度裡還沒有的徽章並寫入；回傳這次寫入的徽章。內容或進度讀不到時不寫、回傳空陣列（下次再補） */
export async function awardChapterBadges(locale: Locale, { celebrate = false }: AwardOptions = {}): Promise<EarnedBadge[]> {
  try {
    const [data, progress] = await Promise.all([contentSource.load(locale), loadMapProgress()]);
    const earned = earnedBadges(data, progress);
    // 先記下再寫：地圖若在寫入途中讀到已寫好的進度，仍然拿得到這一則慶祝
    if (celebrate) rememberCelebrations(earned);
    const written: EarnedBadge[] = [];
    for (const e of earned) {
      // 完成與精通各用自己的日期（同時取得兩個時，不讓兩個徽章共用一個日期）
      const doneAt = badgeDoneAt(data, progress, e.chapterId);
      const masteryAt = badgeEarnedAt(data, progress, e.chapterId);
      let ok = true;
      for (const id of e.unlockIds) {
        const at = id === masteryUnlockId(e.chapterId) ? masteryAt : doneAt;
        const one: EarnedBadge = { ...e, unlockIds: [id] };
        if (!(await (at === undefined ? syncBadges([one]) : syncBadges([one], at)))) ok = false;
      }
      if (ok) written.push(e);
    }
    return written;
  } catch {
    return [];
  }
}
