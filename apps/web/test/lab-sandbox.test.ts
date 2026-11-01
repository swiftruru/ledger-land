// 自由實驗的狀態（features/lab/sandbox.ts，03 第 3.7 節）：複製到某一步、插入、刪除、移動、覆寫、重設；只存修改
import { describe, expect, it } from 'vitest';
import type { StorySnapshot } from '../src/lib/content.ts';
import { newSandbox, nextLocalId, resetSandbox, sandboxSteps, withInserted, withMoved, withOverride, withRemoved } from '../src/features/lab/sandbox.ts';

const step = (id: string, order: number, template = 'tpl.purchase_inventory_cash'): StorySnapshot['steps'][number] => ({
  id,
  order,
  title: `第 ${order} 步`,
  narrative: '',
  events: [{ id: 'e1', template, params: { amount: 100 } }],
  termRefs: [],
});
const story: StorySnapshot = {
  id: 'story_ywv2dy',
  rev: 1,
  status: 'published',
  title: 't',
  origin: 'teacher',
  company: { name: 'c' },
  ledger: { currency: 'TWD', scale: 0 },
  policy: 'teacher@1',
  layout: 'teacher@1',
  steps: [step('st_000003', 3), step('st_000001', 1), step('st_000002', 2)],
};
const NOW = '2026-11-01T10:00:00+08:00';

describe('sandbox', () => {
  it('新的 sandbox 從故事複製到某一步；步驟依 order 排、只取到 throughStep', () => {
    const sb = newSandbox(story, 'st_000002', NOW);
    expect(sb).toMatchObject({
      id: 'sandbox-default',
      basedOn: { story: 'story_ywv2dy', storyRev: 1, throughStep: 'st_000002' },
      overrides: [],
      inserted: [],
      removed: [],
    });
    expect(sandboxSteps(story, sb).map((s) => [s.id, s.order, s.local])).toEqual([
      ['st_000001', 1, false],
      ['st_000002', 2, false],
    ]);
  });

  it('插入接在 after 之後，本機 ID 遞增；刪除故事的步驟記在 removed、刪除插入的步驟直接拿掉；覆寫同一格只留最後一筆', () => {
    let sb = newSandbox(story, 'st_000003', NOW);
    sb = withInserted(sb, 'st_000001', 'tpl.borrow_short_term', { amount: 0 }, NOW);
    sb = withInserted(sb, 'local_1', 'tpl.repay_short_term', { amount: 0 }, NOW);
    expect(nextLocalId(sb)).toBe('local_3');
    expect(sandboxSteps(story, sb).map((s) => s.id)).toEqual(['st_000001', 'local_1', 'local_2', 'st_000002', 'st_000003']);
    sb = withRemoved(sb, 'st_000002', NOW);
    expect(sb.removed).toEqual(['st_000002']);
    expect(sandboxSteps(story, sb).map((s) => s.id)).toEqual(['st_000001', 'local_1', 'local_2', 'st_000003']);
    sb = withRemoved(sb, 'local_1', NOW);
    expect(sb.inserted.map((s) => s.id)).toEqual(['local_2']);
    // local_2 的 after 指向被刪的 local_1：接在最後
    expect(sandboxSteps(story, sb).map((s) => s.id)).toEqual(['st_000001', 'st_000003', 'local_2']);
    sb = withOverride(sb, { stepId: 'st_000001', eventId: 'e1', param: 'amount', value: 150 }, NOW);
    sb = withOverride(sb, { stepId: 'st_000001', eventId: 'e1', param: 'amount', value: 200 }, NOW);
    expect(sb.overrides).toEqual([{ stepId: 'st_000001', eventId: 'e1', param: 'amount', value: 200 }]);
    expect(resetSandbox(sb, NOW)).toMatchObject({ overrides: [], inserted: [], removed: [] });
  });

  it('只有插入的步驟能上下移動，移到頭尾之外是 null', () => {
    let sb = newSandbox(story, 'st_000003', NOW);
    sb = withInserted(sb, 'st_000003', 'tpl.borrow_short_term', {}, NOW);
    expect(sandboxSteps(story, sb).map((s) => s.id)).toEqual(['st_000001', 'st_000002', 'st_000003', 'local_1']);
    const up = withMoved(sb, 'local_1', -1, story, NOW);
    expect(up && sandboxSteps(story, up).map((s) => s.id)).toEqual(['st_000001', 'st_000002', 'local_1', 'st_000003']);
    expect(withMoved(sb, 'local_1', 1, story, NOW)).toBeNull();
    expect(withMoved(sb, 'st_000002', -1, story, NOW)).toBeNull();
  });
});
