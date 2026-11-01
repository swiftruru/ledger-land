// oxlint-disable vitest/valid-expect, vitest/no-conditional-expect -- expect 的第二個引數是失敗時指出哪一步、哪一列的訊息；逐步、逐列檢查寫成迴圈
// 實驗室的核心包裝（features/lab/lab-core.ts）：畫面上的每個數字都來自核心（10 第 11.1 節的完成標準）。這裡拿正式故事重播，
// 把每一步的交易前、交易後、本筆變動、五步驟、指標與佔位符的值，和直接呼叫核心的結果逐一比對；單獨練習帶入的狀態就是故事在該步之前的累計狀態；
// 自由實驗的覆寫被擋下時附可輸入範圍。
import { describe, expect, it } from 'vitest';
import {
  buildStatements,
  computeAllRatios,
  createCoreContext,
  fiveStepCheck,
  measureMap,
  orderedSteps,
  replayStory,
  stateAfterStep,
  type Story,
} from '@ledgerland/core';
import officialJson from '../../../content/stories/story_ywv2dy.json' with { type: 'json' };
import { asCoreStory, labAllowedRange, reconcileCheck, replayLab } from '../src/features/lab/lab-core.ts';
import type { StorySnapshot } from '../src/lib/content.ts';

const story = officialJson as unknown as Story;
const snapshot = officialJson as unknown as StorySnapshot;
const ctx = createCoreContext();
const run = replayStory(story, [], ctx);
if (!run.ok) throw new Error('正式故事重播失敗');
const steps = orderedSteps(story);
const ids = steps.map((s) => s.id);

describe('replayLab', () => {
  const lab = replayLab(asCoreStory(snapshot));
  if (!lab.ok) throw new Error('replayLab 失敗');
  const value = lab.value;

  it('步驟順序與核心一致；期初報表是全 0', () => {
    expect(value.stepIds).toEqual(ids);
    expect(value.opening.lines.get('bs_total_assets')?.value).toBe(0);
  });

  it('每一步的交易前、交易後與本筆變動都等於直接呼叫 buildStatements 的結果；五步驟四個勾稽點都相符', () => {
    const { layout, policy } = ctx;
    ids.forEach((id, i) => {
      const s = value.step(i);
      const after = buildStatements(run.value, { kind: 'cumulative', to: id }, layout, policy);
      const change = buildStatements(run.value, { kind: 'transaction', step: id }, layout, policy);
      for (const [line, v] of after.lines) expect(s.after.lines.get(line)?.value, `${id} ${line}`).toBe(v.value);
      for (const [line, v] of change.lines) expect(s.change.lines.get(line)?.value, `${id} ${line}`).toBe(v.value);
      if (i === 0) for (const [line] of after.lines) expect(s.before.lines.get(line)?.value, `${id} ${line} before`).toBe(0);
      else {
        const prev = buildStatements(run.value, { kind: 'cumulative', to: ids[i - 1]! }, layout, policy);
        for (const [line, v] of prev.lines) expect(s.before.lines.get(line)?.value, `${id} ${line} before`).toBe(v.value);
      }
      expect(
        s.fiveStep.checks.every((c) => c.pass),
        id,
      ).toBe(true);
      expect(s.fiveStep.checks.map((c) => c.step)).toEqual([2, 3, 4, 5]);
    });
  });

  it('單獨練習帶入的狀態就是故事在該步之前的狀態：交易前的餘額等於 stateAfterStep(前一步)', () => {
    const i = ids.indexOf('st_98tppx');
    const s = value.step(i);
    const before = stateAfterStep(run.value, ids[i - 1]!);
    for (const [acct, bal] of Object.entries(before.balances)) expect(s.posted.balancesBefore[acct] ?? 0, acct).toBe(bal);
    expect(s.before.lines.get('bs_cash')?.value).toBe(before.balances['cash']);
  });

  it('指標的前後等於對交易前後累計報表各算一次 computeAllRatios；佔位符的值含參數與推導值', () => {
    const i = ids.indexOf('st_98tppx');
    const s = value.step(i);
    const after = computeAllRatios(measureMap(s.after));
    expect(s.ratiosAfter.map((r) => [r.ratioRef, r.status, r.displayValue])).toEqual(after.map((r) => [r.ratioRef, r.status, r.displayValue]));
    const before = computeAllRatios(measureMap(s.before));
    expect(s.ratiosBefore.map((r) => r.displayValue)).toEqual(before.map((r) => r.displayValue));
    expect(s.values['e1.price']).toBe(3000000);
    expect(s.values['e1.costOfAllInventory']).toBe(1500000);
    expect(s.values['e1.grossProfit']).toBe(1500000);
    expect(s.tAccounts.map((t) => t.account).sort()).toEqual(['cash', 'cost_of_goods_sold', 'inventory', 'revenue']);
  });

  it('同一步只算一次（用到才算、算過就留著）', () => {
    expect(value.step(3)).toBe(value.step(3));
    expect(value.stepById('st_v3bgwb')?.index).toBe(17);
    expect(value.stepById('st_nothing')).toBeUndefined();
  });
});

describe('自由實驗', () => {
  it('第 12 步收回應收帳款超過帳上應收帳款時擋下，並附可輸入範圍（最大是第 10 步賒銷的金額）', () => {
    const over = replayLab(asCoreStory(snapshot), [{ stepId: 'st_q5rssq', eventId: 'e1', param: 'amount', value: 99_999_999_999 }]);
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.error.at.stepId).toBe('st_q5rssq');
    // 最大是第 10 步賒銷的金額；最小是後面的付款（董監事酬勞、運費、還款付息、所得稅）要有現金可付，由核心二分搜尋得到
    expect(over.error.allowedRange).toEqual({ min: 9_050_000, max: 15_000_000 });
    expect(labAllowedRange(asCoreStory(snapshot), [], { stepId: 'st_q5rssq', eventId: 'e1', param: 'amount' })).toEqual({ min: 9_050_000, max: 15_000_000 });
  });

  it('上游的進貨改小，第 7 步的成本跟著變（推導值由帳上狀態來）', () => {
    const r = replayLab(asCoreStory(snapshot), [{ stepId: 'st_g4h3hx', eventId: 'e1', param: 'amount', value: 1_600_000 }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.stepById('st_98tppx')?.values['e1.costOfAllInventory']).toBe(1_600_000);
  });
});

describe('勾稽練習', () => {
  it('學習者填對時四個燈相符，填錯時對應的燈不相符且 source 是 learner', () => {
    const lab = replayLab(asCoreStory(snapshot));
    if (!lab.ok) throw new Error('replayLab 失敗');
    const s = lab.value.step(6);
    const pretax = s.after.lines.get('is_pretax_income')!.value;
    const ok = reconcileCheck(s.after, {
      cf_pretax_income: pretax,
      bs_cash: s.after.lines.get('bs_cash')!.value,
      bs_retained_earnings: s.after.lines.get('bs_retained_earnings')!.value,
    });
    expect(ok.checks.every((c) => c.pass)).toBe(true);
    const bad = reconcileCheck(s.after, { cf_pretax_income: pretax + 1 });
    const step2 = bad.checks.find((c) => c.step === 2)!;
    expect(step2.pass).toBe(false);
    expect([step2.left.source, step2.right.source]).toContain('learner');
    expect(fiveStepCheck(s.after).checks.every((c) => c.pass)).toBe(true);
  });
});
