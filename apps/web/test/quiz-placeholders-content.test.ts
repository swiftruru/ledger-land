// 真實內容的 ratio_numeric 解說（08 第 5.5 節 ans.placeholderResolves 的學習端對照）：快照只存 compiled.ratio（核心 RatioResult 的子集），
// 解說的 {{…:expected.answer.value}} 由 valueContextOf 從 exact 換成比例（0.08 顯示 8.00%，不是 displayValue 的 8）。
// 題目文字直接讀 content/ 的原始檔、依語系展開成快照的字串；compiled 照 tools/lib/content-rules.mjs 寫進快照的形狀手寫，
// 所以解說改寫、佔位符改格式或格式化規則改變時，這裡會先失敗。建置期的同一條檢查在 tools/lib/content-values.mjs。
import { readFileSync } from 'node:fs';
import type { Locale } from '@ledgerland/i18n';
import { describe, expect, it } from 'vitest';
import type { CompiledRatio, QuestionSnapshot } from '../src/lib/content.ts';
import { renderPlain, valueContextOf } from '../src/features/quiz/placeholders.ts';
import { qRatioNumeric } from './quiz-fixtures.ts';

interface SourceQuestion {
  id: string;
  type: string;
  vars: Record<string, number>;
  explanation: Record<Locale, string>;
}

function source(chapterId: string, id: string): SourceQuestion {
  return JSON.parse(readFileSync(new URL(`../../../content/questions/${chapterId}/${id}.json`, import.meta.url), 'utf8')) as SourceQuestion;
}

function snapshotOf(src: SourceQuestion, locale: Locale, ratio: CompiledRatio): QuestionSnapshot {
  return { ...qRatioNumeric, id: src.id, type: src.type, vars: src.vars, explanation: src.explanation[locale], compiled: { ratio } };
}

const ok = (ratioRef: string, num: string, den: string, displayValue: number): CompiledRatio => ({ ratioRef, status: 'ok', exact: { num, den }, displayValue });

// 第 6 章的六題：exact 與 displayValue 取自 runAccountingChecks 的 compiled（2026-10-24）
const CASES: { id: string; ratio: CompiledRatio; zh: string; en: string }[] = [
  {
    id: 'q_bpb8kn9n',
    ratio: ok('net_profit_margin@slides02', '2', '25', 8),
    zh: 'NT$288,000 ÷ NT$3,600,000 ＝ 8.00%（簡化版',
    en: 'NT$288,000 ÷ NT$3,600,000 = 8.00% (simplified',
  },
  { id: 'q_xtjcy3px', ratio: ok('roe@slides02', '9', '50', 18), zh: '＝ 18.00%。', en: '= 18.00%.' },
  { id: 'q_3t3d57g5', ratio: ok('roa@slides02', '3', '25', 12), zh: '＝ 12.00%。', en: '= 12.00%.' },
  { id: 'q_qssvjrx3', ratio: ok('total_asset_turnover@slides02', '3', '2', 1.5), zh: '＝ 1.50 次（簡化版', en: '= 1.50× (simplified' },
  { id: 'q_2acjgfp8', ratio: ok('equity_multiplier@slides02', '3', '2', 1.5), zh: '＝ 1.50 倍（簡化版', en: '= 1.50× (simplified' },
  { id: 'q_kys21epe', ratio: ok('revenue_per_employee@slides02', '450000', '1', 450000), zh: '＝ NT$450,000。', en: '= NT$450,000.' },
];

describe('第 6 章 ratio_numeric 的解說：快照只有 compiled.ratio 時，「＝」後面有正解', () => {
  it.each(CASES)('$id', ({ id, ratio, zh, en }) => {
    const src = source('ch_65j92w', id);
    const zhText = renderPlain(src.explanation['zh-TW'], valueContextOf(snapshotOf(src, 'zh-TW', ratio)), 'zh-TW');
    const enText = renderPlain(src.explanation.en, valueContextOf(snapshotOf(src, 'en', ratio)), 'en');
    expect(zhText).toContain(zh);
    expect(enText).toContain(en);
    // 佔位符解析不到時會留下「＝ （」「= (」或「＝ 。」這種空位；百分比題若誤用 displayValue 會變成 800.00%
    for (const text of [zhText, enText]) {
      expect(text).not.toMatch(/[＝=] *[（(。.,，]/);
      expect(text).not.toMatch(/\d{3,}\.\d{2}%/);
    }
  });
});
