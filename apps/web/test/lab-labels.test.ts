// 實驗室的列名（features/lab/line-labels.ts）：核心的版面（label 是 LocalizedText）與核心載入前由故事快照 firstPaint.lines 做成的版面（label 已攤平成字串）
// 都走同一個 lineLabelOf：有 termRef 且名詞索引有那個名詞時優先用名詞的名稱，沒有就用版面的名稱，找不到的列回傳列 ID。
import { describe, expect, it } from 'vitest';
import officialJson from '../../../content/stories/story_ywv2dy.json' with { type: 'json' };
import * as labCore from '../src/features/lab/lab-core.ts';
import { firstPaintLayout, formulaTextOf, isAbsentLine, lineLabelOf } from '../src/features/lab/line-labels.ts';
import { ratioSpecOf } from '../src/features/lab/ratio-changes.ts';
import type { StorySnapshot } from '../src/lib/content.ts';

describe('lineLabelOf 與 firstPaintLayout', () => {
  const core = { statements: { balance_sheet: [{ id: 'bs_cash', label: { 'zh-TW': '現金', en: 'Cash' }, termRef: 'tm_cash' }] } };
  const snapshot = firstPaintLayout({ bs_cash: { label: 'Cash and cash equivalents', termRef: 'tm_cash' }, bs_total_assets: { label: 'Total assets' } });
  const none = () => undefined;
  const terms = (id: string) => (id === 'tm_cash' ? '現金及約當現金' : undefined);

  it('核心的版面：依語系取名稱，名詞優先', () => {
    expect(lineLabelOf(core, 'bs_cash', 'en', none)).toBe('Cash');
    expect(lineLabelOf(core, 'bs_cash', 'zh-TW', none)).toBe('現金');
    expect(lineLabelOf(core, 'bs_cash', 'zh-TW', terms)).toBe('現金及約當現金');
    expect(lineLabelOf(core, 'bs_nothing', 'zh-TW', terms)).toBe('bs_nothing');
  });

  it('快照的版面：名稱已是字串（不分語系），名詞一樣優先；沒有 termRef 的列 termRef 是 null', () => {
    expect(lineLabelOf(snapshot, 'bs_cash', 'en', none)).toBe('Cash and cash equivalents');
    expect(lineLabelOf(snapshot, 'bs_cash', 'zh-TW', terms)).toBe('現金及約當現金');
    expect(lineLabelOf(snapshot, 'bs_total_assets', 'en', terms)).toBe('Total assets');
    expect(snapshot.statements.firstPaint!.find((l) => l.id === 'bs_total_assets')!.termRef).toBeNull();
    expect(lineLabelOf(firstPaintLayout({}), 'bs_cash', 'en', none)).toBe('bs_cash');
  });

  it('ifrs@1 版面用版面自己的名稱（現行用語與 IFRS 英文），名詞的名稱是教材用語，不蓋過它（04 第 10.3 節）', () => {
    const ifrs = {
      id: 'ifrs@1',
      statements: { income_statement: [{ id: 'is_interest_expense', label: { 'zh-TW': '財務成本', en: 'Finance costs' }, termRef: 'tm_x' }] },
    };
    const teacherTerm = (id: string) => (id === 'tm_x' ? '利息費用' : undefined);
    expect(lineLabelOf(ifrs, 'is_interest_expense', 'zh-TW', teacherTerm)).toBe('財務成本');
    expect(lineLabelOf(ifrs, 'is_interest_expense', 'en', teacherTerm)).toBe('Finance costs');
    expect(lineLabelOf({ ...ifrs, id: 'teacher@1' }, 'is_interest_expense', 'zh-TW', teacherTerm)).toBe('利息費用');
    expect(lineLabelOf(ifrs, 'bs_nothing', 'zh-TW', teacherTerm)).toBe('bs_nothing');
  });
});

describe('版面沒有的列與公式的文字', () => {
  const story = labCore.asCoreStory(officialJson as unknown as StorySnapshot);
  const layoutOf = (policy?: 'ifrs@1') => {
    const r = labCore.replayLab(story, [], policy);
    if (!r.ok) throw new Error('replayLab 失敗');
    return r.value.ctx.layout;
  };
  const teacher = layoutOf();
  const ifrs = layoutOf('ifrs@1');
  const names = { line: (id: string) => `[${id}]`, ratio: (id: string) => `<${id}>` };
  const spec = (ref: string) => ratioSpecOf(labCore, ref)!;

  it('isAbsentLine：只有 ifrs@1 的遞延資產；不顯示的計算列與找不到的列都不算', () => {
    expect(isAbsentLine(ifrs, 'bs_deferred_org_costs')).toBe(true);
    expect(isAbsentLine(ifrs, 'bs_deferred_dev_costs')).toBe(true);
    expect(isAbsentLine(ifrs, 'bs_ppe_gross')).toBe(false);
    expect(isAbsentLine(ifrs, 'is_purchases')).toBe(false);
    expect(isAbsentLine(ifrs, 'bs_cash')).toBe(false);
    expect(isAbsentLine(ifrs, 'nope')).toBe(false);
    expect(isAbsentLine(teacher, 'bs_deferred_org_costs')).toBe(false);
    expect(isAbsentLine(teacher, 'bs_ppe_gross')).toBe(false);
  });

  it('輸入值用這個版本的語系名稱，不是去掉底線的 ID', () => {
    expect(formulaTextOf(spec('eps@excel'), teacher, 'zh-TW', names)).toBe('[is_net_income] ÷ [bs_share_capital] ÷ 每股面額');
    expect(formulaTextOf(spec('eps@excel'), teacher, 'en', names)).toBe('[is_net_income] ÷ [bs_share_capital] ÷ Par value per share');
    expect(formulaTextOf(spec('roa@slides03'), teacher, 'zh-TW', names)).toContain('(1 - 稅率)');
    expect(formulaTextOf(spec('pe_ratio@slides02'), teacher, 'zh-TW', names)).toBe('股價 ÷ <eps>');
    // 分子或分母是多項相加減時加括號；括號裡的加減（1 - 稅率）不算
    const sum = { numerator: 'line.a + line.b', denominator: 'line.c - line.d' };
    expect(formulaTextOf(sum, teacher, 'zh-TW', names)).toBe('([a] + [b]) ÷ ([c] - [d])');
    expect(formulaTextOf({ numerator: 'line.a + line.b * (1 - input.tax_rate)', denominator: 'line.c' }, teacher, 'zh-TW', names)).toBe(
      '([a] + [b] × (1 - tax rate)) ÷ [c]',
    );
    expect(formulaTextOf({ numerator: 'line.a * (1 - input.tax_rate)', denominator: 'line.c' }, teacher, 'zh-TW', names)).toBe('[a] × (1 - tax rate) ÷ [c]');
    // 規格沒有名稱的輸入值退回去掉底線的 ID，不是空白
    expect(formulaTextOf({ expr: 'input.tax_rate * 2' }, teacher, 'zh-TW', names)).toBe('tax rate × 2');
  });

  it('版面沒有的列連同加號一起拿掉：IFRS 的現金再投資比率分母沒有設立費與開發費，教材照舊', () => {
    const cashReinvestment = spec('cash_reinvestment@slides03');
    const shownIfrs = formulaTextOf(cashReinvestment, ifrs, 'zh-TW', names);
    expect(shownIfrs).not.toContain('bs_deferred');
    expect(shownIfrs).toContain('[bs_ppe_gross] + [bs_investments_other] + [bs_intangible_assets] + [bs_current_assets] - [bs_current_liabilities]');
    expect(formulaTextOf(cashReinvestment, teacher, 'zh-TW', names)).toContain('[bs_deferred_org_costs] + [bs_deferred_dev_costs]');
  });
});
