// oxlint-disable vitest/valid-expect -- expect 的第二個引數是失敗時指出哪一步、哪個金額的訊息
// 黃金資料的獨立依據（04 第 10.3 節；M4b 回報第 9 節）：test/golden/calc-lime-leaf.mjs 只用加減法算出青檸文具社 18 步的三表、指標與五步驟，
// 不經過核心；兩套政策的結果都要和 commit 的黃金資料逐項相同。核心的黃金測試（lime-leaf*.golden.test.ts）另外把核心和黃金資料比，
// 三者一致才算數。tools/check-golden.mjs 在 CI 再守「沒有引用正式故事」。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AMOUNTS, STEP_IDS, compute, diffAgainst, goldenPath } from './golden/calc-lime-leaf.mjs';
import { limeLeafStory } from './fixtures/story-lime-leaf.ts';

describe('計算表腳本重現黃金資料', () => {
  for (const policy of ['teacher@1', 'ifrs@1'] as const) {
    it(`${policy}：18 步的三表、23 項指標與五步驟都相同`, () => {
      const golden = JSON.parse(readFileSync(goldenPath(policy), 'utf8')) as Parameters<typeof diffAgainst>[0];
      expect(diffAgainst(golden, compute(policy))).toEqual([]);
    });
  }

  it('計算表的步驟與金額就是 fixture 的自編故事', () => {
    expect(STEP_IDS).toEqual([...limeLeafStory.steps].sort((a, b) => a.order - b.order).map((s) => s.id));
    const params = limeLeafStory.steps.flatMap((s) => s.events.flatMap((e) => Object.values(e.params)));
    for (const [k, v] of Object.entries(AMOUNTS)) expect(params, k).toContain(v);
  });

  it('兩套政策的現金每一步相同；第 5 步設立費在 ifrs@1 是營業活動的支出、在 teacher@1 是投資活動', () => {
    const t = compute('teacher@1');
    const i = compute('ifrs@1');
    for (let k = 0; k < 18; k++) expect(i.steps[k]!.lines['bs_cash'], `第 ${k + 1} 步`).toBe(t.steps[k]!.lines['bs_cash']);
    expect(i.steps[4]!.lines['dc_payments_for_operating_expenses']).toBe(t.steps[4]!.lines['dc_payments_for_operating_expenses']! - AMOUNTS['orgCosts']!);
    expect(i.steps[4]!.lines['cf_capex']).toBe(t.steps[4]!.lines['cf_capex']! + AMOUNTS['orgCosts']!);
  });
});
