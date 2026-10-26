// 作答頁沒有骨架（維護者 2026-10-26：點進任何一頁都要直接看到完整的資訊）的純邏輯部分：
// 延後載入的模組載好之後同步取得到（coreDataNow、questionTypesNow）、每種題型要預載哪些模組（modulesNeededFor）、
// 作答區「還沒齊」的集合更新（nextPendingSet）、名稱的同步版和非同步版算出同一個結果（lineLabelIn、statementRowsIn、ratioInfoIn、accountOptionsIn、cellMetaIn）。
// 元件檔用 Lingui 巨集，Node 環境不跑巨集，題型元件換成記號（同 quiz-lazy-loading.test.ts）。
import { defaultAccounts, defaultRatios, teacherLayout } from '@ledgerland/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const DeferredQuestionView = () => null;
vi.mock('../src/features/quiz/question-types.tsx', () => ({ DeferredQuestionView }));

beforeEach(() => {
  vi.resetModules();
});

describe('載好之後同步取得到（lazy-data.ts）', () => {
  it('coreDataNow 在 loadCoreData 完成前是 null，完成後是同一份模組', async () => {
    const lazy = await import('../src/features/quiz/lazy-data.ts');
    expect(lazy.coreDataNow()).toBeNull();
    const m = await lazy.loadCoreData();
    expect(lazy.coreDataNow()).toBe(m);
    expect(m.teacherLayout).toEqual(teacherLayout);
  });

  it('questionTypesNow 在 loadQuestionTypes 完成前是 null；完成時核心資料也已經開始載', async () => {
    const lazy = await import('../src/features/quiz/lazy-data.ts');
    expect(lazy.questionTypesNow()).toBeNull();
    const m = await lazy.loadQuestionTypes();
    expect(lazy.questionTypesNow()).toBe(m);
    expect(m.DeferredQuestionView).toBe(DeferredQuestionView);
    await lazy.loadCoreData();
    expect(lazy.coreDataNow()).not.toBeNull();
  });

  it('不再等第一次繪製：呼叫後下一個 tick 就 resolve（整頁要等它才淡入，等了只會更晚出現）', async () => {
    vi.useFakeTimers();
    try {
      const lazy = await import('../src/features/quiz/lazy-data.ts');
      let done = false;
      void lazy.loadCoreData().then(() => {
        done = true;
      });
      await vi.advanceTimersByTimeAsync(0);
      await vi.waitFor(() => expect(done).toBe(true));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('每種題型要預載的模組（modulesNeededFor、preloadQuestionModules）', () => {
  it('四種題型要元件連核心資料；沒有 compiled.lines 的選列與指標判讀只要核心資料；其他都不用', async () => {
    const { modulesNeededFor } = await import('../src/features/quiz/lazy-data.ts');
    for (const type of ['five_step_fill', 'ratio_numeric', 'journal_entry', 'transaction_effect'])
      expect([type, modulesNeededFor(type, false)]).toEqual([type, { types: true, core: true }]);
    expect(modulesNeededFor('pick_line', false)).toEqual({ types: false, core: true });
    expect(modulesNeededFor('pick_line', true)).toEqual({ types: false, core: false });
    expect(modulesNeededFor('ratio_interpret', false)).toEqual({ types: false, core: true });
    for (const type of ['single_choice', 'multi_choice', 'judgment', 'true_false', 'classify', 'pick_statement'])
      expect([type, modulesNeededFor(type, false)]).toEqual([type, { types: false, core: false }]);
  });

  it('preloadQuestionModules：交易影響題載題型元件與核心資料；單選題什麼都不載', async () => {
    const lazy = await import('../src/features/quiz/lazy-data.ts');
    lazy.preloadQuestionModules({ type: 'single_choice' });
    await new Promise((r) => setTimeout(r, 20));
    expect(lazy.coreDataNow()).toBeNull();
    expect(lazy.questionTypesNow()).toBeNull();
    lazy.preloadQuestionModules({ type: 'transaction_effect' });
    await lazy.loadQuestionTypes();
    await lazy.loadCoreData();
    expect(lazy.questionTypesNow()).not.toBeNull();
    expect(lazy.coreDataNow()).not.toBeNull();
  });
});

describe('作答區還沒齊的集合（useAsync.ts 的 nextPendingSet）', () => {
  it('加入、重複加入、移除、未知 id 的移除與卸載（null）', async () => {
    const { nextPendingSet } = await import('../src/features/quiz/useAsync.ts');
    const empty: ReadonlySet<string> = new Set();
    const a = nextPendingSet(empty, 'a', true);
    expect([...a]).toEqual(['a']);
    expect(nextPendingSet(a, 'a', true)).toBe(a);
    expect(nextPendingSet(a, 'b', false)).toBe(a);
    expect(nextPendingSet(a, 'b', null)).toBe(a);
    const ab = nextPendingSet(a, 'b', true);
    expect([...ab].sort()).toEqual(['a', 'b']);
    expect([...nextPendingSet(ab, 'a', false)]).toEqual(['b']);
    expect([...nextPendingSet(ab, 'a', null)]).toEqual(['b']);
    expect(nextPendingSet(empty, 'x', false)).toBe(empty);
  });
});

describe('名稱的同步版與非同步版算出同一個結果', () => {
  it('lineLabelIn 與 lineLabel、statementRowsIn 與 statementRows', async () => {
    const lazy = await import('../src/features/quiz/lazy-data.ts');
    const layoutMod = await import('../src/features/quiz/layout-lazy.ts');
    const core = await lazy.loadCoreData();
    const layout = layoutMod.layoutOf(core);
    const anyLine = Object.values(teacherLayout.statements)[0]![0]!;
    expect(layoutMod.lineLabelIn(layout, anyLine.id, 'zh-TW', () => undefined)).toBe(anyLine.label['zh-TW']);
    expect(layoutMod.lineLabelIn(layout, anyLine.id, 'en', () => undefined)).toBe(await layoutMod.lineLabel(anyLine.id, 'en', () => undefined));
    expect(layoutMod.lineLabelIn(layout, 'no_such_line', 'zh-TW', () => undefined)).toBe('no_such_line');
    for (const code of ['is', 'bs', 'cf'] as const) {
      const sync = layoutMod.statementRowsIn(layout, code, 'zh-TW', () => undefined);
      expect(sync.length).toBeGreaterThan(0);
      expect(sync).toEqual(await layoutMod.statementRows(code, 'zh-TW', () => undefined));
    }
  });

  it('ratioInfoIn 與 ratioInfoOf：公式文字、版本、單位相同；沒有 @ 或登錄檔沒有的指標是 undefined', async () => {
    const lazy = await import('../src/features/quiz/lazy-data.ts');
    const ratioMod = await import('../src/features/quiz/ratio-lazy.ts');
    const core = await lazy.loadCoreData();
    const ratio = defaultRatios[0]!;
    const version = Object.keys(ratio.versions)[0]!;
    const ref = `${ratio.id}@${version}`;
    const sync = ratioMod.ratioInfoIn(core, ref, 'zh-TW', () => undefined);
    expect(sync?.termRef).toBe(ratio.termRef);
    expect(sync?.formula).not.toMatch(/\bline\./);
    expect(sync).toEqual(await ratioMod.ratioInfoOf(ref, 'zh-TW', () => undefined));
    expect(ratioMod.ratioInfoIn(core, ratio.id, 'zh-TW', () => undefined)).toBeUndefined();
    expect(ratioMod.ratioInfoIn(core, 'no_such_ratio@excel', 'zh-TW', () => undefined)).toBeUndefined();
  });

  it('accountOptionsIn 與 accountOptionsOf：依科目表順序、名詞資料的名稱優先', async () => {
    const lazy = await import('../src/features/quiz/lazy-data.ts');
    const accountsMod = await import('../src/features/quiz/accounts-lazy.ts');
    const core = await lazy.loadCoreData();
    const ids = defaultAccounts
      .slice(0, 3)
      .map((a) => a.id)
      .reverse();
    const labelOf = (id: string) => (id === ids[0] ? '自訂名稱' : undefined);
    const sync = accountsMod.accountOptionsIn(core, ids, 'zh-TW', labelOf);
    expect(sync.map((o) => o.id)).toEqual([...ids].reverse());
    expect(sync.find((o) => o.id === ids[0])?.label).toBe('自訂名稱');
    expect(sync).toEqual(await accountsMod.accountOptionsOf(ids, 'zh-TW', labelOf));
  });

  it('cellMetaIn 與 cellMetaOf：每一格的報表與勾稽步驟相同', async () => {
    const lazy = await import('../src/features/quiz/lazy-data.ts');
    const layoutMod = await import('../src/features/quiz/layout-lazy.ts');
    const fiveStep = await import('../src/features/quiz/five-step.ts');
    const core = await lazy.loadCoreData();
    const layout = layoutMod.layoutOf(core) as unknown as Parameters<typeof fiveStep.cellMetaIn>[0];
    const ids = ['cf_pretax_income', 'bs_cash', 'is_net_income'];
    const sync = fiveStep.cellMetaIn(layout, ids);
    expect(Object.keys(sync)).toEqual(ids);
    expect(sync['bs_cash']?.statement).toBe('bs');
    expect(sync).toEqual(await fiveStep.cellMetaOf(ids));
  });
});
