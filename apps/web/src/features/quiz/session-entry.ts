// 進入作答頁時要沿用、還原還是重新開始工作階段（02 第 5 節、03 第 2.10 節）：純函式加一個模組層級的「上次離開」紀錄，不碰 React。
// 已完成的關卡留在 store 裡（結果頁）：切換語言（同一關換一種語言的網址，元件會重新掛載）要留在結果頁、不重記完成；
// 從地圖、Tab bar、章節頁或返回鍵再進同一關，一律開新的一輪。分辨兩者靠「上一個同 key 的作答元件卸載時，網址是不是還在這一關」：
// data router 在 React 卸載舊頁面之前就已經改好網址（push、replace 與 popstate 都是），所以卸載時讀 window.location 就是目的地。
import { stripLocale } from '@ledgerland/i18n';
import type { QuizSession } from '@ledgerland/progress';

export type EntryAction = 'keep' | 'restart' | 'restore';

/** store 目前的狀態：沿用（keep）、清掉已完成的重新開始（restart），或從暫存還原（restore，沒有暫存時由呼叫端 begin） */
export function levelEntryAction(
  state: { readonly key: string | null; readonly session: QuizSession | null; readonly hydratedKey: string | null },
  key: string,
  stayed: boolean,
): EntryAction {
  if (state.key !== key || state.session === null) return 'restore';
  if (state.session.completed) return stayed ? 'keep' : 'restart';
  return state.hydratedKey === key ? 'keep' : 'restore';
}

let lastExit: { key: string; stayed: boolean } | null = null;

/** 作答元件卸載時記下：stayed 為 true 代表網址還在同一關（切換語言或重新掛載），不是離開 */
export function noteSessionExit(key: string, stayed: boolean): void {
  lastExit = { key, stayed };
}

/** 上一次同 key 的作答元件卸載後沒有離開過這一關 */
export function stayedOnPage(key: string): boolean {
  return lastExit !== null && lastExit.key === key && lastExit.stayed;
}

/** 網址（任一語言、有沒有結尾斜線）是不是這一關的作答頁 */
export function isLevelPath(pathname: string, levelId: string): boolean {
  return stripLocale(pathname).replace(/\/+$/, '') === `/level/${levelId}`;
}

/** 還原的工作階段裡答案改版的題目：暫存記的 answerRev 和現在的快照不同；舊暫存沒有記錄的題目不算（維持現狀） */
export function revisedQuestionIds(
  questionIds: readonly string[],
  cachedAnswerRevs: Readonly<Record<string, number>>,
  currentAnswerRev: (questionId: string) => number | undefined,
): string[] {
  return questionIds.filter((id) => {
    const was = cachedAnswerRevs[id];
    const now = currentAnswerRev(id);
    return was !== undefined && now !== undefined && was !== now;
  });
}

/** 錯題本的工作階段能不能沿用：題目與順序和今天的清單相同，而且是今天（本地日期）開始的；App 開著過夜後要換成今天到期的題目 */
export function reviewSessionMatches(
  session: { readonly questionIds: readonly string[]; readonly startedAt: string },
  ids: readonly string[],
  today: string,
): boolean {
  return session.startedAt.slice(0, 10) === today && session.questionIds.length === ids.length && session.questionIds.every((id, i) => id === ids[i]);
}
