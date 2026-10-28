// content:build 的含草稿模式（LL_INCLUDE_DRAFTS=1，只給本機開發與 E2E）：草稿關卡與題目進快照、manifest 標 includesDrafts、
// 章節沒列進 levelIds 的草稿關卡依 order 接在後面；預設模式維持只收已發布的項目，已下架的仍只以墓碑出現。
import { validateBundle } from '@ledgerland/content-schema';
import { describe, expect, it } from 'vitest';
import { parseBundle, runAccountingChecks } from '../lib/content-rules.mjs';
import { buildSnapshot } from '../lib/content-snapshot.mjs';
import { bundleWith, qMulti } from './fixtures.ts';

const lt = (zh: string, en: string) => ({ 'zh-TW': zh, en });
const managed = { rev: 1, revKind: 'text', status: 'published' };
const levelFile = (id: string, chapterId: string, order: number, questionIds: string[], status = 'published') => ({
  file: `content/levels/${id}.json`,
  data: { id, ...managed, status, chapterId, order, title: lt('測試關卡', 'Test level'), questionIds },
});
const FAST = { samples: 0 };

describe('content:build 含草稿模式（LL_INCLUDE_DRAFTS=1）', () => {
  const published = [
    qMulti,
    { ...qMulti, id: 'q_p9k4r7c2' },
    { ...qMulti, id: 'q_p9k4r7c3' },
    { ...qMulti, id: 'q_p9k4r7c4' },
    { ...qMulti, id: 'q_p9k4r7c5' },
  ];
  const draftQuestion = { ...qMulti, id: 'q_dr4ft001', status: 'draft' };
  const retiredQuestion = { ...qMulti, id: 'q_r3t1red1', status: 'retired', supersededBy: 'q_p9k4r7cx' };
  const base = bundleWith([...published, draftQuestion, retiredQuestion]);
  const chapters = [{ ...base.chapters[0]!, data: { ...base.chapters[0]!.data, levelIds: ['lv_pb000001'] } }, base.chapters[1]!, base.chapters[2]!];
  const bundle = {
    ...base,
    chapters,
    objectives: [
      {
        file: 'content/objectives/ch_n3f8q1.json',
        data: {
          chapterId: 'ch_n3f8q1',
          items: [
            { id: 'obj_4tw8m3', ...managed, chapterId: 'ch_n3f8q1', order: 1, statement: lt('目標', 'Objective'), skill: 'identify', plannedQuestions: 2 },
          ],
        },
      },
    ],
    levels: [
      levelFile(
        'lv_pb000001',
        'ch_n3f8q1',
        1,
        published.map((q) => q.id),
      ),
      // 草稿關卡：章節還沒列進 levelIds，題目也還是草稿
      levelFile('lv_dr4ft002', 'ch_n3f8q1', 2, ['q_dr4ft001'], 'draft'),
    ],
  };
  const build = (includeDrafts: boolean) => {
    expect(validateBundle(bundle)).toEqual([]);
    const parsed = parseBundle(bundle);
    const acct = runAccountingChecks(parsed, FAST);
    expect(acct.issues.filter((i) => i.severity === 'error')).toEqual([]);
    return buildSnapshot(parsed, acct.compiled, { contentVersion: 1, items: [] }, { gitCommit: 'abc1234', builtAt: '2026-10-23T00:00:00Z', includeDrafts });
  };

  it('預設模式：草稿不進快照，manifest 沒有 includesDrafts', () => {
    const { manifest, files, counts } = build(false);
    expect(manifest.includesDrafts).toBeUndefined();
    expect(counts.levels).toBe(1);
    expect(counts.questions).toBe(5);
    expect(manifest.chapters[0]!.levelIds).toEqual(['lv_pb000001']);
    expect([...files.values()].join('\n')).not.toContain('q_dr4ft001');
  });

  it('含草稿模式：草稿關卡與題目進快照、manifest 標 includesDrafts、未列出的草稿關卡依 order 接在章節後面；已下架仍只有墓碑', () => {
    const { manifest, files, counts } = build(true);
    expect(manifest.includesDrafts).toBe(true);
    expect(counts.levels).toBe(2);
    expect(counts.questions).toBe(6);
    expect(manifest.chapters[0]!.levelIds).toEqual(['lv_pb000001', 'lv_dr4ft002']);
    const draftLevel = manifest.levels.find((l: { id: string }) => l.id === 'lv_dr4ft002');
    expect(draftLevel).toMatchObject({ chapterId: 'ch_n3f8q1', order: 2, questionIds: ['q_dr4ft001'] });
    const bundle = JSON.parse(files.get(draftLevel!.files['zh-TW']!.slice('content/'.length))!);
    expect(bundle.levels.map((l: { level: { id: string } }) => l.level.id)).toEqual(['lv_pb000001', 'lv_dr4ft002']);
    const snapshot = bundle.levels[1];
    expect(snapshot.level.status).toBe('draft');
    expect(snapshot.questions[0].id).toBe('q_dr4ft001');
    // 已下架：不在任何章節包裡，只在墓碑檔
    const tombstones = JSON.parse(files.get(manifest.tombstones.slice('content/'.length))!);
    expect(tombstones).toEqual([{ kind: 'question', id: 'q_r3t1red1', supersededBy: 'q_p9k4r7cx', retiredNote: undefined }]);
    for (const l of manifest.levels)
      for (const path of Object.values(l.files)) expect(files.get((path as string).slice('content/'.length))).not.toContain('q_r3t1red1');
  });
});
