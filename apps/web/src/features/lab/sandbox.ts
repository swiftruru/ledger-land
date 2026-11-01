// 自由實驗（03 第 3.7 節）的純函式：把本機存的修改（@ledgerland/progress 的 LabSandbox：覆寫、插入、刪除）套到故事快照上，
// 組出一份給核心重播的步驟清單，再交給 lab-core.ts 的 replayLab（覆寫由核心套用，才拿得到可輸入範圍）。
// 新增的步驟用 local_ 開頭的本機 ID；故事本身永遠不改。
import type { LabSandbox } from '@ledgerland/progress';

type SandboxInsertedStep = LabSandbox['inserted'][number];
import type { StorySnapshot, StoryStepSnapshot } from '../../lib/content.ts';

export type SandboxStep = StoryStepSnapshot & { readonly local: boolean };

export const LOCAL_STEP_PREFIX = 'local_';

export function isLocalStepId(id: string): boolean {
  return id.startsWith(LOCAL_STEP_PREFIX);
}

/** 下一個本機 ID：local_ 加流水號，比既有的都大 */
export function nextLocalId(sandbox: Pick<LabSandbox, 'inserted'>): string {
  let max = 0;
  for (const s of sandbox.inserted) {
    const n = Number(s.id.slice(LOCAL_STEP_PREFIX.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${LOCAL_STEP_PREFIX}${max + 1}`;
}

/** 套用插入與刪除後的步驟清單（依順序，order 重編）；覆寫不在這裡套（交給核心） */
export function sandboxSteps(story: StorySnapshot, sandbox: Pick<LabSandbox, 'inserted' | 'removed' | 'basedOn'>): SandboxStep[] {
  const removed = new Set(sandbox.removed);
  const base = [...story.steps].sort((a, b) => a.order - b.order);
  // basedOn.throughStep：從故事複製到哪一步為止
  const through = base.findIndex((s) => s.id === sandbox.basedOn.throughStep);
  const kept: SandboxStep[] = (through < 0 ? base : base.slice(0, through + 1)).filter((s) => !removed.has(s.id)).map((s) => ({ ...s, local: false }));
  // 插入：依 after 放到該步之後；after 指向的步驟不在清單裡（被刪或指向另一個插入的）就依序接在最後
  const inserted: SandboxInsertedStep[] = sandbox.inserted.filter((s) => !removed.has(s.id));
  const pending = [...inserted];
  let guard = 0;
  while (pending.length > 0 && guard++ < 100) {
    const s = pending.shift()!;
    const at = kept.findIndex((k) => k.id === s.after);
    const placed: SandboxStep = {
      id: s.id,
      order: 0,
      title: '',
      narrative: '',
      events: s.events.map((e) => ({ id: e.id, template: e.template, params: { ...e.params } })),
      termRefs: [],
      local: true,
    };
    if (at >= 0) kept.splice(at + 1, 0, placed);
    else if (pending.some((p) => p.id === s.after)) pending.push(s);
    else kept.push(placed);
  }
  return kept.map((s, i) => ({ ...s, order: i + 1 }));
}

/** 給核心重播的故事：故事快照換上自由實驗的步驟清單 */
export type SandboxStorySnapshot = Omit<StorySnapshot, 'steps'> & { readonly steps: SandboxStep[] };

export function sandboxStory(story: StorySnapshot, sandbox: Pick<LabSandbox, 'inserted' | 'removed' | 'basedOn'>): SandboxStorySnapshot {
  return { ...story, steps: sandboxSteps(story, sandbox) };
}

/** 新的 sandbox 狀態（從故事複製到某一步） */
export function newSandbox(story: Pick<StorySnapshot, 'id' | 'rev'>, throughStep: string, updatedAt: string, id = 'sandbox-default'): LabSandbox {
  return {
    id,
    basedOn: { story: story.id, storyRev: story.rev, throughStep },
    policy: 'teacher@1',
    layout: 'teacher@1',
    overrides: [],
    inserted: [],
    removed: [],
    updatedAt,
  };
}

export function withOverride(sandbox: LabSandbox, o: { stepId: string; eventId: string; param: string; value: number }, updatedAt: string): LabSandbox {
  const rest = sandbox.overrides.filter((x) => !(x.stepId === o.stepId && x.eventId === o.eventId && x.param === o.param));
  return { ...sandbox, overrides: [...rest, o], updatedAt };
}

export function withInserted(sandbox: LabSandbox, after: string, template: string, params: Record<string, number>, updatedAt: string): LabSandbox {
  const id = nextLocalId(sandbox);
  return { ...sandbox, inserted: [...sandbox.inserted, { id, after, events: [{ id: 'e1', template, params }] }], updatedAt };
}

export function withRemoved(sandbox: LabSandbox, stepId: string, updatedAt: string): LabSandbox {
  if (isLocalStepId(stepId)) {
    return {
      ...sandbox,
      inserted: sandbox.inserted.filter((s) => s.id !== stepId),
      overrides: sandbox.overrides.filter((o) => o.stepId !== stepId),
      updatedAt,
    };
  }
  return {
    ...sandbox,
    removed: sandbox.removed.includes(stepId) ? sandbox.removed : [...sandbox.removed, stepId],
    overrides: sandbox.overrides.filter((o) => o.stepId !== stepId),
    updatedAt,
  };
}

/** 上下移動：只移動插入的步驟（故事原本的順序不動，03 第 3.7 節的編輯操作）；回傳 null 代表不能移 */
export function withMoved(sandbox: LabSandbox, stepId: string, direction: -1 | 1, story: StorySnapshot, updatedAt: string): LabSandbox | null {
  if (!isLocalStepId(stepId)) return null;
  const steps = sandboxSteps(story, sandbox);
  const i = steps.findIndex((s) => s.id === stepId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= steps.length) return null;
  // 新的 after：往上時接在 j 的前一步之後，往下時接在 j 之後
  const after = direction === -1 ? (j === 0 ? null : steps[j - 1]!.id) : steps[j]!.id;
  if (after === null) return null;
  return { ...sandbox, inserted: sandbox.inserted.map((s) => (s.id === stepId ? { ...s, after } : s)), updatedAt };
}

/** 重設為故事原本的金額：清掉覆寫、插入與刪除 */
export function resetSandbox(sandbox: LabSandbox, updatedAt: string): LabSandbox {
  return { ...sandbox, overrides: [], inserted: [], removed: [], updatedAt };
}
