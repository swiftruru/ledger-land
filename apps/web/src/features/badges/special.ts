// 特別徽章（03 第 2.10 節）：不屬於任何章、由探索獎勵解鎖的徽章，目前只有「幕後」頁找齊彩蛋的「幕後偵探」。
// 和章節徽章分開算（維護者 2026-10-27）：首頁、地圖頂部與徽章頁的章節「已取得 n／m」都不含特別徽章，徽章頁另開一區。
// 存法和章節徽章一樣是 ProgressStore 的 unlock（kind badge），ID 以 badge:special: 開頭，所以 quest-map 的 badgeCount 要用前綴排除。
// 沒有 DOM、沒有 React。
export const SPECIAL_BADGE_PREFIX = 'badge:special:';

export interface SpecialBadgeDef {
  /** 徽章的鍵（字串 ID badges.special.<key> 與條件 badges.special.<key>.cond 跟著它） */
  readonly key: string;
  /** 進度裡的 unlock ID */
  readonly unlockId: `${typeof SPECIAL_BADGE_PREFIX}${string}`;
}

export const SPECIAL_BADGES = [{ key: 'creditsEggs', unlockId: 'badge:special:credits-eggs' }] as const satisfies readonly SpecialBadgeDef[];

export type SpecialBadgeKey = (typeof SPECIAL_BADGES)[number]['key'];

export interface SpecialBadgeStatus {
  readonly state: 'locked' | 'done';
  /** 取得時間（ISO，含本地時區位移） */
  readonly doneAt?: string;
}

/** unlock ID 是不是特別徽章（章節徽章的計數要排除） */
export function isSpecialBadgeId(id: string): boolean {
  return id.startsWith(SPECIAL_BADGE_PREFIX);
}

/** 由 unlock（id 對 unlockedAt，useUnlocks('badge') 回傳的 Map）算出一枚特別徽章的狀態；特別徽章沒有精通 */
export function specialBadgeStatus(unlocks: ReadonlyMap<string, string>, def: SpecialBadgeDef): SpecialBadgeStatus {
  const doneAt = unlocks.get(def.unlockId);
  return doneAt === undefined ? { state: 'locked' } : { state: 'done', doneAt };
}
