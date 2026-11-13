// 錯題複習清單頁的整理（2026-11-13）：三個階段各有哪些題、哪一段與哪一條公式最需要加強；純函式。
// 「還沒熟練」= 待訂正加複習中。最需要加強的排法：還沒熟練的題數多的先，同數時累計答錯次數多的先，再同就照講義順序（公式照索引順序）。
import type { FormulaIndexEntry, HandoutManifestEntry } from '../../lib/content.ts';
import type { QuestionState } from './db.ts';
import { deviceClock, type Clock } from './day.ts';
import { stageOf, type WrongStage } from './stats.ts';

export const WRONG_STAGES: readonly WrongStage[] = ['fix', 'review', 'mastered'];
/** 最需要加強的段與公式各列幾個 */
export const WEAK_LIMIT = 3;

/** 依講義順序把答錯過的題分到三個階段 */
export function stageGroups(
  questionIds: readonly string[],
  states: ReadonlyMap<string, QuestionState>,
  clock: Clock = deviceClock(),
): Record<WrongStage, string[]> {
  const out: Record<WrongStage, string[]> = { fix: [], review: [], mastered: [] };
  for (const id of questionIds) {
    const stage = stageOf(states.get(id), clock);
    if (stage !== null) out[stage].push(id);
  }
  return out;
}

export interface WeakArea {
  /** 段 ID（d1s2）或公式 ID（fm_…） */
  id: string;
  title: string;
  /** 段所屬講義的編號（公式沒有） */
  deckCode?: string;
  /** 還沒熟練的題數 */
  open: number;
  /** 這些題累計答錯幾次 */
  wrong: number;
}

function rank(areas: (WeakArea & { order: number })[], limit: number): WeakArea[] {
  return areas
    .filter((a) => a.open > 0)
    .sort((a, b) => b.open - a.open || b.wrong - a.wrong || a.order - b.order)
    .slice(0, limit)
    .map(({ order: _order, ...area }) => area);
}

function tally(ids: readonly string[], states: ReadonlyMap<string, QuestionState>, clock: Clock): { open: number; wrong: number } {
  let open = 0;
  let wrong = 0;
  for (const id of ids) {
    const s = states.get(id);
    const stage = stageOf(s, clock);
    if (stage === 'fix' || stage === 'review') {
      open++;
      wrong += s!.wrong;
    }
  }
  return { open, wrong };
}

/** 還沒熟練的錯題最多的幾段 */
export function weakSections(
  index: HandoutManifestEntry,
  states: ReadonlyMap<string, QuestionState>,
  clock: Clock = deviceClock(),
  limit: number = WEAK_LIMIT,
): WeakArea[] {
  const decks = [...index.decks].sort((a, b) => a.order - b.order);
  let order = 0;
  return rank(
    decks.flatMap((d) => d.sections.map((s) => ({ id: s.id, title: s.title, deckCode: d.code, ...tally(s.questionIds, states, clock), order: order++ }))),
    limit,
  );
}

/** 還沒熟練的錯題最多的幾條公式（一題可以掛好幾條公式，各算一次） */
export function weakFormulas(
  formulas: readonly FormulaIndexEntry[],
  states: ReadonlyMap<string, QuestionState>,
  clock: Clock = deviceClock(),
  limit: number = WEAK_LIMIT,
): WeakArea[] {
  return rank(
    formulas.map((f, order) => ({ id: f.id, title: f.label, ...tally(f.questionIds, states, clock), order })),
    limit,
  );
}
