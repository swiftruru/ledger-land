// 取捨題的「收藏」（03 第 2.7 節）：不計分、不進錯題本，學習者按「收藏」後放進「我的」頁的收藏清單。
// 持久化用 ProgressStore 的 settings：鍵 favourites，值是題目 ID 的陣列（JsonValue；納入備份）。
// 收藏是學習資料，不是偏好：匯入備份時不受「也套用語言與計時設定」控制，合併取聯集、覆蓋取備份（@ledgerland/progress 的 LEARNING_SETTING_KEYS，core-2）。
// 作答頁的接線：FeedbackView 的 favourited 給 isFavourite(list, q.id)，onFavourite 呼叫 toggleFavourite(store, q.id)。
import { FAVOURITES_SETTING_KEY, idListOf, type JsonValue } from '@ledgerland/progress';
import { nowIso } from '../../lib/progress/app-info.ts';
import { getProgressStore } from '../../lib/progress/index.ts';

export const FAVOURITES_SETTING = FAVOURITES_SETTING_KEY;

/** 只需要 settings 的兩個方法，方便測試用假物件 */
export interface FavouriteSettings {
  getSetting(key: string): Promise<{ value: JsonValue } | undefined>;
  setSetting(key: string, value: JsonValue, updatedAt: string): Promise<void>;
}

/** 設定值轉成題目 ID 清單：不是字串陣列的值一律當作空清單；去重、保留順序 */
export function parseFavourites(value: JsonValue | undefined): string[] {
  return idListOf(value);
}

/** 收藏或取消收藏（純函式）：已在清單裡就移除，否則加到最後 */
export function toggleInList(list: readonly string[], questionId: string): string[] {
  return list.includes(questionId) ? list.filter((id) => id !== questionId) : [...list, questionId];
}

export function isFavourite(list: readonly string[], questionId: string): boolean {
  return list.includes(questionId);
}

export async function listFavourites(store?: FavouriteSettings): Promise<string[]> {
  const s = store ?? (await getProgressStore());
  const entry = await s.getSetting(FAVOURITES_SETTING);
  return parseFavourites(entry?.value);
}

/** 切換收藏並寫回；回傳切換後是否為已收藏 */
export async function toggleFavourite(questionId: string, store?: FavouriteSettings, now: string = nowIso()): Promise<boolean> {
  const s = store ?? (await getProgressStore());
  const list = await listFavourites(s);
  const next = toggleInList(list, questionId);
  await s.setSetting(FAVOURITES_SETTING, next, now);
  return next.includes(questionId);
}

/** 從清單移除（「我的」頁的「移除收藏」）；不在清單裡時不寫 */
export async function removeFavourite(questionId: string, store?: FavouriteSettings, now: string = nowIso()): Promise<string[]> {
  const s = store ?? (await getProgressStore());
  const list = await listFavourites(s);
  if (!list.includes(questionId)) return list;
  const next = list.filter((id) => id !== questionId);
  await s.setSetting(FAVOURITES_SETTING, next, now);
  return next;
}
