// 內容載入（08 第 7.4 節）：loadLevel、loadQuestion、resolveId 的墓碑處理；fetch 以假的 Response 取代，拿到 HTML 視同不存在
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentLoadError, findLevelOfQuestion, loadLevel, loadQuestion, resolveId } from '../src/lib/content.ts';

const manifest = {
  schemaVersion: 1,
  contentVersion: 1,
  builtAt: '2026-10-23T00:00:00Z',
  gitCommit: 'abc1234',
  includesDrafts: true,
  locales: { 'zh-TW': { status: 'complete' }, en: { status: 'complete' } },
  chapters: [
    {
      id: 'ch_t3st001',
      order: 1,
      levelIds: ['lv_t3st0001'],
      files: { 'zh-TW': 'content/zh-TW/ch_t3st001.aaaaaa.json', en: 'content/en/ch_t3st001.bbbbbb.json' },
    },
  ],
  levels: [
    {
      id: 'lv_t3st0001',
      chapterId: 'ch_t3st001',
      order: 1,
      questionIds: ['q_s1ng1e01'],
      files: { 'zh-TW': 'content/zh-TW/lv_t3st0001.cccccc.json', en: 'content/en/lv_t3st0001.dddddd.json' },
    },
  ],
  terms: { 'zh-TW': 'content/zh-TW/terms.eeeeee.json', en: 'content/en/terms.ffffff.json' },
  tombstones: 'content/tombstones.aaaaaa.json',
};
const levelFile = {
  level: { id: 'lv_t3st0001', rev: 1, chapterId: 'ch_t3st001', order: 1, title: '測試關卡', questionIds: ['q_s1ng1e01'] },
  questions: [{ id: 'q_s1ng1e01', type: 'single_choice', rev: 2, revKind: 'answer', answerRev: 2, scored: true, termRefs: [] }],
};
const tombstones = [{ kind: 'question', id: 'q_r3t1red1', supersededBy: 'q_s1ng1e01', retiredNote: { 'zh-TW': '已改成新題', en: 'Replaced' } }];
const files: Record<string, unknown> = {
  '/content/content-manifest.json': manifest,
  '/content/zh-TW/lv_t3st0001.cccccc.json': levelFile,
  '/content/tombstones.aaaaaa.json': tombstones,
  '/content/zh-TW/terms.eeeeee.json': [{ id: 'tm_t3st0001', label: '資產' }],
};

beforeEach(() => {
  vi.stubGlobal('fetch', async (path: string) => {
    const body = files[path];
    if (body === undefined) return new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } });
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('content loaders', () => {
  it('loadLevel 讀關卡檔；找不到關卡或語系丟 missing', async () => {
    const snapshot = await loadLevel('lv_t3st0001', 'zh-TW');
    expect(snapshot.level.title).toBe('測試關卡');
    expect(snapshot.questions[0]?.answerRev).toBe(2);
    await expect(loadLevel('lv_n0n3xist', 'zh-TW')).rejects.toMatchObject({ kind: 'missing' });
    // 檔案被 SPA fallback 回成 HTML 時視同不存在
    await expect(loadLevel('lv_t3st0001', 'en')).rejects.toBeInstanceOf(ContentLoadError);
  });

  it('loadQuestion 依 manifest 找到題目所在的關卡；不在任何關卡回 undefined', async () => {
    expect((await findLevelOfQuestion('q_s1ng1e01'))?.id).toBe('lv_t3st0001');
    const found = await loadQuestion('q_s1ng1e01', 'zh-TW');
    expect(found?.question.rev).toBe(2);
    expect(found?.level.title).toBe('測試關卡');
    expect(await loadQuestion('q_r3t1red1', 'zh-TW')).toBeUndefined();
  });

  it('resolveId：active、retired（含替代項目與說明）、unknown', async () => {
    expect(await resolveId('q_s1ng1e01')).toEqual({ status: 'active', kind: 'question' });
    expect(await resolveId('lv_t3st0001')).toEqual({ status: 'active', kind: 'level' });
    expect(await resolveId('tm_t3st0001')).toEqual({ status: 'active', kind: 'term' });
    expect(await resolveId('q_r3t1red1', 'en')).toEqual({ status: 'retired', kind: 'question', supersededBy: 'q_s1ng1e01', retiredNote: 'Replaced' });
    expect(await resolveId('q_wh0kn0ws1')).toEqual({ status: 'unknown' });
  });
});
