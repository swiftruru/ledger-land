// 內容載入（08 第 7.4 節）：loadLevel、loadQuestion、resolveId 的墓碑處理；fetch 以假的 Response 取代，拿到 HTML 視同不存在
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ContentLoadError,
  findLevelOfQuestion,
  loadChapterIndex,
  loadLevel,
  loadQuestion,
  loadTermDetail,
  loadTermIndex,
  resolveId,
  termDetailBucket,
} from '../src/lib/content.ts';

const manifest = {
  schemaVersion: 2,
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
  chapterIndex: { 'zh-TW': 'content/zh-TW/chapter-index.111111.json', en: 'content/en/chapter-index.222222.json' },
  termIndex: { 'zh-TW': 'content/zh-TW/term-index.eeeeee.json', en: 'content/en/term-index.ffffff.json' },
  termDetails: { 'zh-TW': { '1': 'content/zh-TW/terms-1.333333.json' }, en: { '1': 'content/en/terms-1.444444.json' } },
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
  '/content/zh-TW/term-index.eeeeee.json': [{ id: 'tm_t3st0001', label: '資產' }],
  '/content/zh-TW/terms-1.333333.json': [{ id: 'tm_t3st0001', label: '資產', definition: '公司擁有、預期帶來經濟效益的資源' }],
  '/content/zh-TW/chapter-index.111111.json': [{ id: 'ch_t3st001', order: 1, title: '測試章', levelIds: ['lv_t3st0001'], objectives: [] }],
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

  it('名詞兩層：索引一個語系一檔；完整內容依 ID 最後一個字元分桶，不在快照裡的名詞回 undefined，桶檔讀不到丟 ContentLoadError', async () => {
    expect(termDetailBucket('tm_t3st0001')).toBe('1');
    expect((await loadTermIndex('zh-TW')).map((t) => t.label)).toEqual(['資產']);
    expect((await loadTermDetail('tm_t3st0001', 'zh-TW'))?.definition).toBe('公司擁有、預期帶來經濟效益的資源');
    // 同一桶但快照沒有這個名詞
    expect(await loadTermDetail('tm_n0n3x1st1', 'zh-TW')).toBeUndefined();
    // 沒有這一桶
    expect(await loadTermDetail('tm_n0n3x1stz', 'zh-TW')).toBeUndefined();
    // en 的桶檔被 SPA fallback 回成 HTML
    await expect(loadTermDetail('tm_t3st0001', 'en')).rejects.toBeInstanceOf(ContentLoadError);
    await expect(loadTermIndex('en')).rejects.toMatchObject({ kind: 'missing' });
  });

  it('章節索引一個語系一檔', async () => {
    expect((await loadChapterIndex('zh-TW')).map((c) => [c.id, c.title])).toEqual([['ch_t3st001', '測試章']]);
    await expect(loadChapterIndex('en')).rejects.toBeInstanceOf(ContentLoadError);
  });
});
