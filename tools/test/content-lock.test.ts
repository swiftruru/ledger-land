// published.lock.json（08 第 4.4、5.6 節、04 第 15.3 節）：answerHash 的敏感度與八條 id.* 規則，直接呼叫 tools/lib/content-lock.mjs。
import { describe, expect, it } from 'vitest';
import { type LockItem, allEntityIds, answerHash, checkLock, currentLockItems, mergeItem, nextLock, normaliseLock } from '../lib/content-lock.mjs';
import { parseBundle, runAccountingChecks } from '../lib/content-rules.mjs';
import { bundleWith, q172, qJournal, qMulti } from './fixtures.ts';

const FAST = { samples: 0 };
const itemsOf = (questions: Record<string, unknown>[]) => {
  const parsed = parseBundle(bundleWith(questions));
  const acct = runAccountingChecks(parsed, FAST);
  expect(acct.issues.filter((i) => i.severity === 'error')).toEqual([]);
  return { parsed, current: currentLockItems(parsed, acct.compiled), allIds: allEntityIds(parsed) };
};

describe('answerHash（04 第 15.3 節）', () => {
  it('multi_choice：改 correctOptionIds 或 scoringMode 會變；只改文字或調整 correctOptionIds 的順序不變', () => {
    const base = answerHash('question', qMulti);
    expect(base).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(answerHash('question', { ...qMulti, scoringMode: 'any_correct' })).not.toBe(base);
    expect(answerHash('question', { ...qMulti, correctOptionIds: ['o_f3k8', 'o_g6v4'] })).not.toBe(base);
    expect(answerHash('question', { ...qMulti, correctOptionIds: ['o_h7n2', 'o_f3k8'] })).toBe(base);
    expect(answerHash('question', { ...qMulti, prompt: { 'zh-TW': '改了題幹。', en: 'A reworded prompt.' } })).toBe(base);
    const options = qMulti.options.map((o) => ({ ...o, feedback: { 'zh-TW': '新的回饋。', en: 'New feedback.' } }));
    expect(answerHash('question', { ...qMulti, options })).toBe(base);
  });

  it('計算型題目的雜湊含核心算出的 expected：改事件參數會變，改解說不變；名詞沒有 answerHash', () => {
    const a = itemsOf([q172, qJournal]).current;
    const q = a.get('q_tx7h2c9d') as LockItem;
    expect(q.answerHash).toMatch(/^sha256:/);
    const b = itemsOf([
      { ...q172, scenario: { ...q172.scenario, events: [{ id: 'e1', template: 'tpl.sell_all_inventory_cash', params: { price: 1130000 } }] } },
    ]).current;
    expect(b.get('q_tx7h2c9d')?.answerHash).not.toBe(q.answerHash);
    const c = itemsOf([{ ...q172, explanation: { 'zh-TW': '改了解說。', en: 'A reworded explanation.' } }]).current;
    expect(c.get('q_tx7h2c9d')?.answerHash).toBe(q.answerHash);
    expect(a.get('q_y3m7k2dw')?.answerHash).toMatch(/^sha256:/);
    expect(a.get('tm_g5c2m8tw')?.answerHash).toBeUndefined();
    expect(a.get('story_q7m2v9')?.answerHash).toMatch(/^sha256:/);
    expect(a.get('tpl.sell_all_inventory_cash')?.answerHash).toMatch(/^sha256:/);
  });

  it('範本的雜湊只看分錄行、推導值、前置條件與參數規格', () => {
    const t = {
      params: [{ name: 'amount', type: 'money', min: 0, max: 10, default: 5, label: { 'zh-TW': 'x', en: 'x' } }],
      derived: [],
      preconditions: [],
      lines: [{ id: 'l1', account: 'cash', side: 'debit', amount: 'param.amount', cf: { activity: 'operating', kind: 'other_operating_receipts' } }],
    };
    const base = answerHash('template', t);
    expect(answerHash('template', { ...t, params: [{ ...t.params[0], label: { 'zh-TW': 'y', en: 'y' } }] })).toBe(base);
    expect(answerHash('template', { ...t, params: [{ ...t.params[0], default: 6 }] })).not.toBe(base);
    expect(answerHash('template', { ...t, lines: [{ ...t.lines[0], memo: { 'zh-TW': 'm', en: 'm' } }] })).toBe(base);
    expect(answerHash('template', { ...t, lines: [{ ...t.lines[0], side: 'credit' }] })).not.toBe(base);
  });
});

describe('normaliseLock 與 nextLock', () => {
  it('M0b 的最小格式升級成 items；contentVersion 保留', () => {
    const lock = normaliseLock({ contentVersion: 3, terms: { tm_r4w8n2qe: 2 }, chapters: { ch_c5f8w2: 1 } });
    expect(lock.contentVersion).toBe(3);
    expect(lock.items).toEqual([
      { id: 'tm_r4w8n2qe', kind: 'term', rev: 2, revKind: 'text', answerRev: 2, status: 'published', optionIds: [] },
      { id: 'ch_c5f8w2', kind: 'chapter', rev: 1, revKind: 'text', answerRev: 1, status: 'published', optionIds: [] },
    ]);
  });

  it('answerRev 在雜湊改變時取現在的 rev；optionIds 只增不減、被移除的選項記進 removedOptionIds', () => {
    const prev: LockItem = {
      id: 'q_p9k4r7cx',
      kind: 'question',
      rev: 1,
      revKind: 'text',
      answerRev: 1,
      status: 'published',
      answerHash: 'sha256:aa',
      optionIds: ['o_a111', 'o_f3k8'],
    };
    const cur: LockItem = {
      id: 'q_p9k4r7cx',
      kind: 'question',
      rev: 2,
      revKind: 'text',
      answerRev: 2,
      status: 'published',
      answerHash: 'sha256:aa',
      optionIds: ['o_f3k8', 'o_g6v4'],
    };
    expect(mergeItem(prev, cur)).toEqual({ ...cur, answerRev: 1, optionIds: ['o_a111', 'o_f3k8', 'o_g6v4'], removedOptionIds: ['o_a111'] });
    expect(mergeItem(prev, { ...cur, answerHash: 'sha256:bb', revKind: 'answer' }).answerRev).toBe(2);
    const next = nextLock({ lockVersion: 1, contentVersion: 1, items: [prev] }, new Map([[cur.id, cur]]));
    expect(next.items).toHaveLength(1);
    expect(next.contentVersion).toBe(1);
  });
});

describe('checkLock：08 第 5.6 節的八條規則', () => {
  const { current, allIds } = itemsOf([qMulti, q172]);
  const lockWith = (items: LockItem[]) => ({ lockVersion: 1, contentVersion: 1, items });
  const multi = current.get('q_p9k4r7cx') as LockItem;
  const rulesOf = (prev: LockItem[], cur = current, ids = allIds) => checkLock(lockWith(prev), cur, ids).map((i) => i.rule);

  it('一致時沒有問題', () => {
    expect(rulesOf([...current.values()])).toEqual([]);
  });

  it('id.lockStale：已發布的項目不在 lock，或內容變了 lock 沒更新', () => {
    expect(rulesOf([])).toContain('id.lockStale');
    expect(rulesOf([...current.values()].map((i) => (i.id === multi.id ? { ...i, optionIds: [] } : i)))).toEqual(['id.lockStale']);
  });

  it('id.revDecreased：rev 倒退', () => {
    expect(rulesOf([...current.values()].map((i) => (i.id === multi.id ? { ...i, rev: 2, answerRev: 2 } : i)))).toContain('id.revDecreased');
  });

  it('id.revNotBumped 與 id.revKindMismatch：answerHash 變了但 rev 沒加、或 revKind 不是 answer', () => {
    const changed = [...current.values()].map((i) => (i.id === multi.id ? { ...i, answerHash: 'sha256:0000' } : i));
    expect(rulesOf(changed)).toContain('id.revNotBumped');
    const bumped = new Map(current);
    bumped.set(multi.id, { ...multi, rev: 2 });
    expect(rulesOf(changed, bumped)).toContain('id.revKindMismatch');
    bumped.set(multi.id, { ...multi, rev: 2, revKind: 'answer' });
    // rev 與 revKind 都對了之後，剩下的只是 lock 要重新產生
    expect(rulesOf(changed, bumped)).toEqual(['id.lockStale']);
  });

  it('id.vanished 與 id.reused：lock 裡的 ID 消失；或被草稿或別種實體重用', () => {
    const ghost: LockItem = { id: 'q_gh0st000', kind: 'question', rev: 1, revKind: 'text', answerRev: 1, status: 'published', optionIds: [] };
    expect(rulesOf([...current.values(), ghost])).toContain('id.vanished');
    const ids = new Map(allIds);
    ids.set('q_gh0st000', { kind: 'question', status: 'draft' });
    expect(rulesOf([...current.values(), ghost], current, ids)).toContain('id.reused');
    expect(rulesOf([...current.values()].map((i) => (i.id === multi.id ? { ...i, kind: 'story' } : i)))).toContain('id.reused');
  });

  it('id.optionReused：曾經移除的選項 ID 再次出現', () => {
    expect(rulesOf([...current.values()].map((i) => (i.id === multi.id ? { ...i, removedOptionIds: ['o_g6v4'] } : i)))).toContain('id.optionReused');
  });

  it('id.supersededInvalid：supersededBy 要指向同類已發布項目，而且不能循環', () => {
    const retired = new Map(current);
    retired.set(multi.id, { ...multi, status: 'retired', supersededBy: 'q_n0where0' });
    expect(rulesOf([...retired.values()], retired)).toContain('id.supersededInvalid');
    retired.set(multi.id, { ...multi, status: 'retired', supersededBy: 'ch_n3f8q1' });
    expect(rulesOf([...retired.values()], retired)).toContain('id.supersededInvalid');
    const loop = new Map(current);
    loop.set(multi.id, { ...multi, supersededBy: 'q_tx7h2c9d' });
    loop.set('q_tx7h2c9d', { ...(current.get('q_tx7h2c9d') as LockItem), supersededBy: multi.id });
    expect(rulesOf([...loop.values()], loop).filter((r) => r === 'id.supersededInvalid').length).toBeGreaterThan(0);
  });
});
