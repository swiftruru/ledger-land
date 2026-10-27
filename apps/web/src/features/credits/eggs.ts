// 幕後頁的彩蛋（02 第 1.1 節的 /credits/）：五個都找到就解鎖一枚特別徽章（03 的特別徽章）。找到的 id 存在進度設定的 creditsEggs（學習資料：
// 備份匯入時取聯集，packages/progress 的 LEARNING_SETTING_KEYS）。純函式，不碰 React 與儲存。
import { SPECIAL_BADGES } from '../badges/special.ts';

export const EGG_IDS = ['mascot', 'version', 'flavours', 'offline', 'dedication'] as const;
export type EggId = (typeof EGG_IDS)[number];

/** 進度設定的 key（@ledgerland/progress 的 LEARNING_SETTING_KEYS 裡的那一個：備份匯入時取聯集） */
export { CREDITS_EGGS_SETTING_KEY } from '@ledgerland/progress';

/** 找齊時解鎖的特別徽章（features/badges/special.ts 的 creditsEggs） */
export const CREDITS_BADGE_UNLOCK_ID: string = SPECIAL_BADGES.find((b) => b.key === 'creditsEggs')!.unlockId;

export function isEggId(x: unknown): x is EggId {
  return typeof x === 'string' && (EGG_IDS as readonly string[]).includes(x);
}

/** 讀設定裡的值：不是陣列、或裡面有不認識的 id 都略過 */
export function readFound(value: unknown): ReadonlySet<EggId> {
  const out = new Set<EggId>();
  if (!Array.isArray(value)) return out;
  for (const x of value) if (isEggId(x)) out.add(x);
  return out;
}

export function withFound(found: ReadonlySet<EggId>, id: EggId): ReadonlySet<EggId> {
  if (found.has(id)) return found;
  return new Set([...found, id]);
}

export function isComplete(found: ReadonlySet<EggId>): boolean {
  return EGG_IDS.every((id) => found.has(id));
}

/** 寫進設定的形狀：依 EGG_IDS 的順序排好的 id 陣列 */
export function toSetting(found: ReadonlySet<EggId>): string[] {
  return EGG_IDS.filter((id) => found.has(id));
}
