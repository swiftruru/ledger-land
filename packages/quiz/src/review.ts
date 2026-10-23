// 錯題本與間隔複習（03 第 2.10 節）：最簡單的 Leitner 盒子制。盒子 1 到 4 的下次複習分別是 1、3、7、14 天後；答對升一盒，盒子 4 答對標為已掌握；答錯回盒子 1。
// 純函式：日期由呼叫端給。dueAt 與 today 都是本地日期字串 YYYY-MM-DD；now 可以是 YYYY-MM-DD 或帶本地時區位移的 ISO 字串（例如 2026-10-20T14:05:00+08:00），
// 只取前 10 個字當本地日期，時區換算交給呼叫端。資料欄位與 06 第 4.2 節的 reviewQueue 一致。

export type ReviewBox = 1 | 2 | 3 | 4;
export type ReviewResult = 'correct' | 'wrong';
export type ReviewStatus = 'active' | 'mastered' | 'question_updated';
export type ReviewAddedBy = 'auto' | 'guessed';
export type RevisionKind = 'text' | 'answer';

/** 盒子 1 到 4 的間隔天數（索引 0 對應盒子 1） */
export const LEITNER_INTERVAL_DAYS: readonly [number, number, number, number] = [1, 3, 7, 14];
export const REVIEW_DAILY_LIMIT = 10;

export interface ReviewEntry {
  readonly questionId: string;
  readonly rev: number;
  readonly box: ReviewBox;
  /** 下次複習的本地日期 YYYY-MM-DD */
  readonly dueAt: string;
  readonly lastResult: ReviewResult;
  /** 最後一次作答的時間，呼叫端給的字串原樣保存 */
  readonly lastAnsweredAt: string;
  readonly wrongCount: number;
  readonly status: ReviewStatus;
  readonly addedBy: ReviewAddedBy;
  /** 題目改版後的小標記：文字改版保留盒子只標記；下次作答後清除 */
  readonly updateKind?: RevisionKind;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** 從 YYYY-MM-DD 或 ISO 字串取出本地日期；格式不對是程式錯誤 */
export function localDateOf(now: string): string {
  const m = DATE_RE.exec(now);
  if (!m) throw new TypeError(`localDateOf：需要 YYYY-MM-DD 開頭的日期字串，收到 ${now}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) throw new RangeError(`localDateOf：不是合法日期 ${now}`);
  return now.slice(0, 10);
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeap(y) ? 29 : 28;
  return m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
}

/** 公曆日期轉成從 1970-01-01 起算的天數（Howard Hinnant 的 days_from_civil，整數運算） */
function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const mp = (m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(z0: number): [number, number, number] {
  const z = z0 + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return [m <= 2 ? y + 1 : y, m, d];
}

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

/** 本地日期加減天數，不經過 Date（無時區、無夏令時間問題） */
export function addDays(date: string, days: number): string {
  if (!Number.isInteger(days)) throw new TypeError(`addDays：days 必須是整數，收到 ${String(days)}`);
  const base = localDateOf(date);
  const [y, m, d] = civilFromDays(daysFromCivil(Number(base.slice(0, 4)), Number(base.slice(5, 7)), Number(base.slice(8, 10))) + days);
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

function dueFromBox(today: string, box: ReviewBox): string {
  return addDays(today, LEITNER_INTERVAL_DAYS[box - 1] as number);
}

/** 進入錯題本：答錯自動放進盒子 1（auto），答對但按了「我是猜的」也放進盒子 1（guessed） */
export function enterReview(questionId: string, rev: number, now: string, addedBy: ReviewAddedBy): ReviewEntry {
  const today = localDateOf(now);
  return {
    questionId,
    rev,
    box: 1,
    dueAt: dueFromBox(today, 1),
    lastResult: addedBy === 'auto' ? 'wrong' : 'correct',
    lastAnsweredAt: now,
    wrongCount: addedBy === 'auto' ? 1 : 0,
    status: 'active',
    addedBy,
  };
}

/** 複習作答後的下一個狀態：答對升一盒（盒子 4 答對變 mastered，離開複習清單），答錯回盒子 1；作答會清掉改版標記 */
export function nextReview(entry: ReviewEntry, result: ReviewResult, now: string): ReviewEntry {
  const today = localDateOf(now);
  const { updateKind: _cleared, ...rest } = entry;
  if (result === 'wrong') {
    return { ...rest, box: 1, dueAt: dueFromBox(today, 1), lastResult: 'wrong', lastAnsweredAt: now, wrongCount: entry.wrongCount + 1, status: 'active' };
  }
  if (entry.box === 4) {
    return { ...rest, box: 4, dueAt: dueFromBox(today, 4), lastResult: 'correct', lastAnsweredAt: now, status: 'mastered' };
  }
  const box = (entry.box + 1) as ReviewBox;
  return { ...rest, box, dueAt: dueFromBox(today, box), lastResult: 'correct', lastAnsweredAt: now, status: 'active' };
}

/** 題目改版：答案改版回盒子 1 並標 question_updated（已掌握的也回來）；文字改版保留盒子與狀態，只加小標記。rev 沒有變大時原樣回傳 */
export function onQuestionRevised(entry: ReviewEntry, newRev: number, revKind: RevisionKind): ReviewEntry {
  if (newRev <= entry.rev) return entry;
  if (revKind === 'answer') return { ...entry, rev: newRev, box: 1, status: 'question_updated', updateKind: 'answer' };
  return { ...entry, rev: newRev, updateKind: 'text' };
}

/** 今天要複習的題目：到期（dueAt 不晚於 today）且還沒掌握的，依到期日再依題目 ID 排序，最多 limit 題 */
export function dueToday(entries: readonly ReviewEntry[], today: string, limit: number = REVIEW_DAILY_LIMIT): ReviewEntry[] {
  if (!Number.isInteger(limit) || limit < 0) throw new RangeError(`dueToday：limit 必須是非負整數，收到 ${String(limit)}`);
  const day = localDateOf(today);
  return entries
    .filter((e) => e.status !== 'mastered' && e.dueAt <= day)
    .sort((a, b) => (a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0))
    .slice(0, limit);
}
