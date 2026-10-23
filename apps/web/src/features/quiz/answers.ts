// 作答介面的狀態與 packages/quiz 作答格式之間的對應（06 第 4.2 節的格式表、03 第 2.4 節表二）。純函式，給 store、頁面與單元測試共用。
// 介面狀態存在作答工作階段的 QuestionState.answer（JsonValue）：
// - 單選類（single_choice、pick_statement、judgment）、pick_line：選項或列的 ID
// - multi_choice：已勾選的 ID 陣列（送出時去重排序）；true_false：布林
// - classify：項目 ID 對分類格 ID（放到一半也先存）
// - transaction_effect：target ID 對 { direction?, raw? }（金額目標保留原始輸入文字，切換語言不會丟）
import type { QuestionType } from '@ledgerland/content-schema';
import { normalizeNumericInput } from '@ledgerland/i18n';
import type { JsonValue } from '@ledgerland/progress';
import { normaliseMultiChoiceAnswer } from '@ledgerland/quiz';
import type { QuestionSnapshot } from '../../lib/content.ts';

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
    default:
      return answer;
  }
}
