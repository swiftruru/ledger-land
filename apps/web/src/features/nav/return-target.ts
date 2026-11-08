// 跨模組導覽的返回目標（M5，02 第 5.3 節、03 第 4.6 節）：按回饋區的「看動畫」時記下從哪一題來、那一頁的網址、畫面最上方的錨點，
// 交易影響題另記剛剛的答案（版面列對方向）。步驟頁的返回膠囊「回到題目」優先用這裡的網址，預測面板用答案帶入；關卡頁回來時依錨點還原捲動位置。
// 只記最近一筆，放 sessionStorage（關掉分頁就沒了；網址上的 ?from= 是重新整理或 App 被系統回收後的備援）。讀寫失敗都不丟錯，只影響這一次。
import type { ScrollAnchor } from '@ledgerland/progress';

export const RETURN_TARGET_KEY = 'll:return';

export type LineChoice = 'up' | 'down' | 'unchanged';

export interface ReturnTarget {
  /** level 是關卡頁、review 是錯題本 */
  kind: 'level' | 'review';
  levelId?: string;
  questionId: string;
  /** 回去的網址（含語系前綴與查詢字串，由 localePath 產生的頁面網址） */
  href: string;
  /** 離開時畫面最上方的錨點（useScrollAnchor 的格式） */
  anchor?: ScrollAnchor;
  /** 交易影響題剛剛的答案：版面列 ID 對方向，只收方向目標（03 第 4.1 節「把剛剛的答案帶進預測階段」） */
  lineChoices?: Record<string, LineChoice>;
}

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function writeReturnTarget(target: ReturnTarget): void {
  try {
    storage()?.setItem(RETURN_TARGET_KEY, JSON.stringify(target));
  } catch {
    /* 寫不進去只影響這一次：膠囊退回依 manifest 找關卡，捲動位置用工作階段的錨點 */
  }
}

export function clearReturnTarget(): void {
  try {
    storage()?.removeItem(RETURN_TARGET_KEY);
  } catch {
    /* 同上 */
  }
}

const CHOICES: readonly LineChoice[] = ['up', 'down', 'unchanged'];
const isChoice = (v: unknown): v is LineChoice => typeof v === 'string' && (CHOICES as readonly string[]).includes(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v !== '';

/** 讀回最近一筆；形狀不對（舊版、被改過）就當作沒有 */
export function readReturnTarget(): ReturnTarget | undefined {
  let raw: string | null;
  try {
    raw = storage()?.getItem(RETURN_TARGET_KEY) ?? null;
  } catch {
    return undefined;
  }
  if (raw === null) return undefined;
  try {
    return normaliseReturnTarget(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export function normaliseReturnTarget(value: unknown): ReturnTarget | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const v = value as Record<string, unknown>;
  if ((v['kind'] !== 'level' && v['kind'] !== 'review') || !isId(v['questionId']) || !isId(v['href']) || !v['href'].startsWith('/')) return undefined;
  const out: ReturnTarget = { kind: v['kind'], questionId: v['questionId'], href: v['href'] };
  if (isId(v['levelId'])) out.levelId = v['levelId'];
  const anchor = v['anchor'];
  if (typeof anchor === 'object' && anchor !== null) {
    const a = anchor as Record<string, unknown>;
    if (isId(a['elementId']) && typeof a['offset'] === 'number' && Number.isFinite(a['offset']))
      out.anchor = { elementId: a['elementId'], offset: a['offset'] };
  }
  const choices = v['lineChoices'];
  if (typeof choices === 'object' && choices !== null) {
    const kept: Record<string, LineChoice> = {};
    for (const [line, c] of Object.entries(choices as Record<string, unknown>)) if (isId(line) && isChoice(c)) kept[line] = c;
    if (Object.keys(kept).length > 0) out.lineChoices = kept;
  }
  return out;
}

/** 這一題的返回目標：store 裡最近一筆是同一題才算（別題的、別人貼來的連結都不用） */
export function returnTargetFor(questionId: string): ReturnTarget | undefined {
  const t = readReturnTarget();
  return t !== undefined && t.questionId === questionId ? t : undefined;
}

interface ScenarioTargetLike {
  id?: unknown;
  kind?: unknown;
  line?: unknown;
  measure?: unknown;
}

/** 交易影響題的答案換成「版面列 → 方向」：只收 kind 是 line、measure 是 direction 的目標；金額、科目與指標目標實驗室的預測面板沒有對應的列，不帶。
 *  答案接受兩種形狀：作答頁工作階段存的介面狀態（features/quiz/answers.ts 的 EffectUiAnswers，每個目標是 { direction }）與判分用的 EffectAnswer（目標對方向代號） */
export function lineChoicesOf(q: Readonly<Record<string, unknown>>, answer: unknown): Record<string, LineChoice> {
  const out: Record<string, LineChoice> = {};
  const scenario = q['scenario'] as { targets?: unknown } | undefined;
  if (!Array.isArray(scenario?.targets) || typeof answer !== 'object' || answer === null) return out;
  const answers = answer as Record<string, unknown>;
  for (const raw of scenario.targets as ScenarioTargetLike[]) {
    if (raw.kind !== 'line' || raw.measure !== 'direction' || !isId(raw.id) || !isId(raw.line)) continue;
    const a = answers[raw.id];
    const c = typeof a === 'object' && a !== null ? (a as { direction?: unknown }).direction : a;
    if (isChoice(c)) out[raw.line] = c;
  }
  return out;
}

/** 帶進預測面板：實驗室的目標是 line 而且剛剛答過同一列的就先填上；對不上的留空（03 第 4.1 節） */
export function prefillPrediction<T extends { readonly id: string; readonly kind: string; readonly line?: string }>(
  targets: readonly T[],
  lineChoices: Readonly<Record<string, LineChoice>> | undefined,
): Record<string, LineChoice> {
  const out: Record<string, LineChoice> = {};
  if (lineChoices === undefined) return out;
  for (const tg of targets) {
    if (tg.kind !== 'line' || tg.line === undefined) continue;
    const c = lineChoices[tg.line];
    if (c !== undefined) out[tg.id] = c;
  }
  return out;
}
