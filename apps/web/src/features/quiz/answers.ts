// 作答介面的狀態與 packages/quiz 作答格式之間的對應（06 第 4.2 節的格式表、03 第 2.4 節表二）。純函式，給 store、頁面與單元測試共用。
// 介面狀態存在作答工作階段的 QuestionState.answer（JsonValue）：
// - 單選類（single_choice、pick_statement、judgment）、pick_line：選項或列的 ID
// - multi_choice：已勾選的 ID 陣列（送出時去重排序）；true_false：布林
// - classify：項目 ID 對分類格 ID（放到一半也先存）
// - transaction_effect：target ID 對 { direction?, raw? }（金額目標保留原始輸入文字，切換語言不會丟）
// - five_step_fill：格子（版面線 ID）對原始輸入文字
// - ratio_numeric：{ raw?, na? }（按 N/A 時 na 為 true，raw 保留）
// - journal_entry：行的陣列 { key, account, side, raw }（key 是介面用的行鍵，送出時去掉）
import type { QuestionType } from '@ledgerland/content-schema';
import { normalizeNumericInput } from '@ledgerland/i18n';
import type { JsonValue } from '@ledgerland/progress';
import { normaliseMultiChoiceAnswer, type JournalEntryDetail } from '@ledgerland/quiz';
import type { QuestionSnapshot } from '../../lib/content.ts';
import { normalizeRatioInput, numericUnitOf, type RatioInputUnit, type RatioUnit } from './ratio-units.ts';

export interface EffectUiAnswer {
  direction?: string;
  raw?: string;
}
export type EffectUiAnswers = Record<string, EffectUiAnswer>;

type Target = { id: string; measure: 'direction' | 'delta' | 'value' | 'status' };

/** 交易影響題：更新一個目標的介面狀態，只留有值的欄位（存進 JsonValue 不能有 undefined） */
export function withEffectAnswer(answers: EffectUiAnswers, targetId: string, a: EffectUiAnswer): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const [id, v] of Object.entries(answers)) out[id] = compactEffect(v);
  out[targetId] = compactEffect(a);
  return out;
}

function compactEffect(a: EffectUiAnswer): Record<string, string> {
  const out: Record<string, string> = {};
  if (a.direction !== undefined) out['direction'] = a.direction;
  if (a.raw !== undefined) out['raw'] = a.raw;
  return out;
}
type Item = { id: string };

export interface JournalUiLine {
  key: string;
  account: string;
  side: 'debit' | 'credit';
  raw: string;
}

export interface RatioUiAnswer {
  raw?: string;
  na?: boolean;
}

export function openCellsOf(q: QuestionSnapshot): readonly string[] {
  return (q['openCells'] as string[] | undefined) ?? [];
}

function isRecord(v: JsonValue | undefined): v is Record<string, JsonValue> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 分錄題的介面狀態：只認形狀正確的行 */
export function journalLinesOf(answer: JsonValue | undefined): JournalUiLine[] {
  if (!Array.isArray(answer)) return [];
  const out: JournalUiLine[] = [];
  for (const item of answer) {
    if (!isRecord(item)) continue;
    const key = item['key'];
    const account = item['account'];
    const side = item['side'];
    const raw = item['raw'];
    if (typeof key !== 'string' || typeof account !== 'string' || (side !== 'debit' && side !== 'credit')) continue;
    out.push({ key, account, side, raw: typeof raw === 'string' ? raw : '' });
  }
  return out;
}

/** 指標計算題作答單位對應的數字輸入單位 */
export function ratioInputUnitOf(q: QuestionSnapshot): RatioInputUnit {
  return numericUnitOf(q['answerUnit'] as RatioUnit | undefined);
}

export function targetsOf(q: QuestionSnapshot): readonly Target[] {
  const scenario = q['scenario'] as { targets?: Target[] } | undefined;
  return scenario?.targets ?? [];
}

export function itemsOf(q: QuestionSnapshot): readonly Item[] {
  return (q['items'] as Item[] | undefined) ?? [];
}

/** 介面狀態是否足以按「確認答案」（03 第 2.4、2.5、2.12 節） */
export function canSubmit(q: QuestionSnapshot, answer: JsonValue | undefined): boolean {
  if (answer === undefined || answer === null) return false;
  switch (q.type as QuestionType) {
    case 'single_choice':
    case 'pick_statement':
    case 'ratio_interpret':
    case 'judgment':
    case 'pick_line':
      return typeof answer === 'string' && answer !== '';
    case 'multi_choice':
      return Array.isArray(answer) && answer.length > 0;
    case 'true_false':
      return typeof answer === 'boolean';
    case 'classify': {
      if (typeof answer !== 'object' || Array.isArray(answer)) return false;
      return itemsOf(q).every((it) => typeof answer[it.id] === 'string');
    }
    case 'transaction_effect': {
      if (typeof answer !== 'object' || Array.isArray(answer)) return false;
      return targetsOf(q).every((t) => {
        const a = answer[t.id];
        if (a === null || typeof a !== 'object' || Array.isArray(a)) return false;
        if (t.measure === 'direction' || t.measure === 'status') return typeof a['direction'] === 'string';
        return typeof a['raw'] === 'string' && a['raw'].trim() !== '';
      });
    }
    case 'five_step_fill': {
      if (!isRecord(answer)) return false;
      const cells = openCellsOf(q);
      return cells.length > 0 && cells.every((c) => typeof answer[c] === 'string' && answer[c].trim() !== '');
    }
    case 'ratio_numeric': {
      if (!isRecord(answer)) return false;
      if (answer['na'] === true) return true;
      return typeof answer['raw'] === 'string' && answer['raw'].trim() !== '';
    }
    case 'journal_entry': {
      const lines = journalLinesOf(answer);
      return lines.length > 0 && lines.every((l) => l.account !== '' && l.raw.trim() !== '');
    }
    default:
      return false;
  }
}

/** 介面狀態換成 quiz 的作答格式（attempts.answer 也存這個）；形狀不對的部分省略，由判分算錯 */
export function toQuizAnswer(q: QuestionSnapshot, answer: JsonValue): JsonValue {
  switch (q.type as QuestionType) {
    case 'multi_choice':
      return Array.isArray(answer) ? normaliseMultiChoiceAnswer(answer.filter((x): x is string => typeof x === 'string')) : [];
    case 'transaction_effect': {
      const out: Record<string, string | number> = {};
      if (typeof answer !== 'object' || answer === null || Array.isArray(answer)) return out;
      for (const t of targetsOf(q)) {
        const a = answer[t.id];
        if (a === null || typeof a !== 'object' || Array.isArray(a)) continue;
        if (t.measure === 'direction' || t.measure === 'status') {
          if (typeof a['direction'] === 'string') out[t.id] = a['direction'];
        } else if (typeof a['raw'] === 'string') {
          const parsed = normalizeNumericInput(a['raw'], 'money');
          if (parsed.ok) out[t.id] = parsed.value;
        }
      }
      return out;
    }
    case 'five_step_fill': {
      const out: Record<string, number> = {};
      if (!isRecord(answer)) return out;
      for (const c of openCellsOf(q)) {
        const raw = answer[c];
        if (typeof raw !== 'string') continue;
        const parsed = normalizeNumericInput(raw, 'money');
        if (parsed.ok) out[c] = parsed.value;
      }
      return out;
    }
    case 'ratio_numeric': {
      if (!isRecord(answer)) return { kind: 'value', value: Number.NaN };
      if (answer['na'] === true) return { kind: 'na' };
      const raw = answer['raw'];
      const parsed = typeof raw === 'string' ? normalizeRatioInput(raw, ratioInputUnitOf(q)) : null;
      // 讀不懂的輸入給一個不可能對的值，讓判分算錯而不是丟出形狀錯誤
      return { kind: 'value', value: parsed?.ok ? parsed.value : Number.MAX_SAFE_INTEGER };
    }
    case 'journal_entry': {
      // 一筆分錄：每行的金額正規化成非負整數；讀不懂或負數的行省略，由判分算成少了那一行
      const lines: { account: string; side: 'debit' | 'credit'; amount: number }[] = [];
      for (const l of journalLinesOf(answer)) {
        const parsed = normalizeNumericInput(l.raw, 'money');
        if (!parsed.ok || !Number.isInteger(parsed.value) || parsed.value < 0) continue;
        lines.push({ account: l.account, side: l.side, amount: parsed.value });
      }
      return [lines];
    }
    default:
      return answer;
  }
}

export type JournalLineStatus = 'ok' | 'extra' | 'amount';

const pairKey = (account: string, side: string) => `${account}|${side}`;

/** 分錄題的逐行回饋（03 第 2.6 節）：判分 detail 的 extra 對應到介面的行（同科目同方向都標），同時也在 missing 裡的就是「金額不對」；
 * 其餘 missing 列成「少了這一行」。作答的科目一律是科目 ID，extra 與 missing 也是 ID */
export function journalLineStatuses(
  lines: readonly JournalUiLine[],
  detail: JournalEntryDetail,
): { lines: Record<string, JournalLineStatus>; missing: { account: string; side: 'debit' | 'credit'; amount: number }[] } {
  const extra = new Set(detail.extra.map((e) => pairKey(e.account, e.side)));
  const missingKeys = new Set(detail.missing.map((m) => pairKey(m.account, m.side)));
  const out: Record<string, JournalLineStatus> = {};
  for (const l of lines) {
    const k = pairKey(l.account, l.side);
    out[l.key] = extra.has(k) ? (missingKeys.has(k) ? 'amount' : 'extra') : 'ok';
  }
  const missing = detail.missing.filter((m) => !extra.has(pairKey(m.account, m.side))).map((m) => ({ account: m.account, side: m.side, amount: m.amount }));
  return { lines: out, missing };
}
