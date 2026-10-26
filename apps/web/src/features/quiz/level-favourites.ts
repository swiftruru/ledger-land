// 作答頁的收藏接線（03 第 2.7 節）：只有不計分的取捨題能收藏。清單在第一次繪製送出後才讀（afterFirstPaint，開進度資料庫不搶 LCP，06 第 8.2 節）；
// 按下「收藏」依畫面上看到的狀態寫入目標值（已收藏或未收藏），不反轉資料庫：清單還沒讀到時（切換語言重新掛載、剛進關卡）按下，
// 已經收藏的題目也不會被取消。先樂觀更新本地清單，再依序寫回（writeFavourite），寫完以實際結果校正；讀取完成時以資料庫清單為底，
// 套上這段期間還沒寫完的操作，不丟掉資料庫的清單。
import { useCallback, useEffect, useRef, useState } from 'react';
import { afterFirstPaint } from '../../lib/idle.ts';
import { nowIso } from '../../lib/progress/app-info.ts';
import { getProgressStore } from '../../lib/progress/index.ts';
import { FAVOURITES_SETTING, listFavourites, toggleInList, type FavouriteSettings } from './favourites.ts';

/** 能不能收藏：取捨題，或其他不計分的題目 */
export function canFavourite(q: { readonly type: string; readonly scored: boolean }): boolean {
  return q.type === 'judgment' || !q.scored;
}

/** 讓清單裡有或沒有這一題（寫回之後校正樂觀更新用）；已經一致時回傳原清單 */
export function setMembership(list: readonly string[], questionId: string, on: boolean): readonly string[] {
  if (list.includes(questionId) === on) return list;
  return toggleInList(list, questionId);
}

/** 讀到的資料庫清單套上還沒寫完的操作（題目 ID 對目標狀態） */
export function mergePending(ids: readonly string[], pending: ReadonlyMap<string, boolean>): readonly string[] {
  let out: readonly string[] = ids;
  for (const [questionId, on] of pending) out = setMembership(out, questionId, on);
  return out;
}

/** 把這一題寫成已收藏（on）或未收藏；已經一致時不寫。回傳寫入後的狀態 */
export async function writeFavourite(questionId: string, on: boolean, store?: FavouriteSettings, now: string = nowIso()): Promise<boolean> {
  const s = store ?? (await getProgressStore());
  const list = await listFavourites(s);
  if (list.includes(questionId) === on) return on;
  await s.setSetting(FAVOURITES_SETTING, [...setMembership(list, questionId, on)], now);
  return on;
}

/** 依序執行非同步工作（前一件失敗不影響下一件） */
export function createSerial(): <T>(task: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>) => {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
}

/** 全頁共用一條讀寫佇列：切換語言時作答頁會重新掛載，前一次掛載還沒寫完的收藏要排在後面的讀寫之前 */
const favouriteWrites = createSerial();

export interface FavouriteList {
  /** null：還沒讀到 */
  readonly list: readonly string[] | null;
  /** 寫成畫面上要的狀態：on 為 true 是收藏、false 是取消收藏 */
  set(questionId: string, on: boolean): void;
}

/** active 為 false（這一關沒有能收藏的題目）時不讀也不開資料庫 */
export function useFavouriteList(active: boolean): FavouriteList {
  const [list, setList] = useState<readonly string[] | null>(null);
  // 還沒寫完的操作：題目 ID 對目標狀態（同一題連按時只留最後一次）
  const pending = useRef(new Map<string, { on: boolean; seq: number }>());
  const seq = useRef(0);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const cancel = afterFirstPaint(() => {
      // 讀取也排進佇列：切換語言重新掛載時，前一次還沒寫完的收藏先落地再讀
      favouriteWrites(() => listFavourites()).then(
        (ids) => alive && setList(mergePending(ids, new Map([...pending.current].map(([id, p]) => [id, p.on] as const)))),
        () => alive && setList((current) => current ?? []),
      );
    });
    return () => {
      alive = false;
      cancel();
    };
  }, [active]);
  const set = useCallback((questionId: string, on: boolean) => {
    const mine = ++seq.current;
    pending.current.set(questionId, { on, seq: mine });
    setList((current) => setMembership(current ?? [], questionId, on));
    favouriteWrites(() => writeFavourite(questionId, on)).then(
      (actual) => {
        // 之後又按了同一題：交給最後那一次校正，不在中途把畫面翻回來
        if (pending.current.get(questionId)?.seq !== mine) return;
        pending.current.delete(questionId);
        setList((current) => setMembership(current ?? [], questionId, actual));
      },
      () => {
        /* 寫不進去時保留畫面上的狀態；儲存層的錯誤提示由 storageStatus 負責 */
        if (pending.current.get(questionId)?.seq === mine) pending.current.delete(questionId);
      },
    );
  }, []);
  return { list, set };
}
