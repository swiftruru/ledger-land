// M3 的 CI 檢查（10 第 10 節完成標準、08 第 3.3、5.1、5.5、5.8、7.3 節）：ans.journalScope（分錄題只在 kind: journal 的延伸章）、
// struct.examScope 與 struct.chapterKind（已發布章節的期中考範圍已決定、全站一章借貸與分錄）、judgment 不計分與 ratio_numeric 的 ratioRef 必填、
// content:coverage --check（每個學習目標已發布預計題數）、快照的 manifest.chapters[].scope 與 examScope、名詞的 firstLevel（03 第 2.10 節）、
// 章節的 notices（2026-10-24 決定 4）、ref.termRefsListed 與 style.sourceRefs 的學習端延伸（內部編號不進學習端資料，12 第 16.2 節）。
// 每條規則都有刻意失敗的案例；全部直接呼叫 tools/lib 與 packages/content-schema 的純函式。
import { isUnscoredLevel, levelSizeIssue, validateBundle } from '@ledgerland/content-schema';
import { defaultRatioRegistry } from '@ledgerland/core';
import { describe, expect, it } from 'vitest';
import { coverage, coverageShortfalls } from '../lib/content-coverage.mjs';
import { parseBundle, requiredLines, runAccountingChecks } from '../lib/content-rules.mjs';
import { CHAPTER_INDEX_FIELDS, TERM_INDEX_FIELDS, buildSnapshot, firstLevelByTerm, termDetailBucket } from '../lib/content-snapshot.mjs';
import {
  blockedTemplateEntry,
  bundleWith,
  chapter,
  term as termEntry,
  q172,
  q172Expected,
  qCurrentRatioNa,
  qJournal,
  qMulti,
  qRoa,
  storyEntry,
} from './fixtures.ts';
import { learnerRefHit, runTextChecks } from '../lib/content-text.mjs';

const lt = (zh: string, en: string) => ({ 'zh-TW': zh, en });
const managed = { rev: 1, revKind: 'text', status: 'published' };
const FAST = { samples: 0 };
const objective = (id: string, chapterId: string, order: number, extra: Record<string, unknown> = {}) => ({
  id,
  ...managed,
  chapterId,
  order,
  statement: lt(`目標 ${id}`, `Objective ${id}`),
  skill: 'identify',
  plannedQuestions: 2,
  ...extra,
});
const objectiveFile = (chapterId: string, items: Record<string, unknown>[]) => ({ file: `content/objectives/${chapterId}.json`, data: { chapterId, items } });
const levelFile = (id: string, chapterId: string, order: number, questionIds: string[], status = 'published') => ({
  file: `content/levels/${id}.json`,
  data: { id, ...managed, status, chapterId, order, title: lt(`關卡 ${id}`, `Level ${id}`), questionIds },
});
const rulesOf = (issues: { rule?: string }[]) => issues.map((i) => i.rule).filter((r) => r !== undefined);

describe('ans.journalScope：journal_entry 只能放在「借貸與分錄」延伸章（scope: extension 且 kind: journal）', () => {
  it('放在 kind: journal 的延伸章通過', () => {
    expect(validateBundle(bundleWith([qJournal]))).toEqual([]);
  });

  it('放在主線章節：content:check 以 ans.journalScope 報錯，訊息指出章節與原因', () => {
    const issues = validateBundle(bundleWith([{ ...qJournal, chapterId: 'ch_n3f8q1', objectiveId: 'obj_5vk2m7' }]));
    const hit = issues.filter((i) => i.rule === 'ans.journalScope');
    expect(hit).toHaveLength(1);
    expect(hit[0]).toMatchObject({ file: 'content/questions/q_y3m7k2dw.json', path: 'chapterId' });
    expect(hit[0]!.message).toContain('ch_n3f8q1');
    expect(hit[0]!.message).toContain('scope 是 core');
  });

  it('放在沒有標 kind: journal 的延伸章（例如本益比延伸章）也報錯', () => {
    const chapters = [chapter('ch_n3f8q1', 1), chapter('ch_x4d9p2', 2), chapter('ch_e4j7r2', 3, 'extension')];
    const issues = validateBundle({ ...bundleWith([qJournal]), chapters });
    expect(rulesOf(issues)).toEqual(['ans.journalScope']);
    expect(issues[0]!.message).toContain('沒有標 kind: journal');
  });

  it('acct.entryBlocked 仍有效：用帶 entryQuestionBlockedBy 的範本出分錄題被擋', () => {
    const events = [{ id: 'e1', template: 'tpl.test_blocked_amortise', params: { years: 5 } }];
    const q = { ...qJournal, scenario: { ...qJournal.scenario, opening: { storyRef: 'story_q7m2v9', afterStep: 'st_f4g5h6' }, events } };
    const bundle = bundleWith([q], { templates: [blockedTemplateEntry] });
    const acct = runAccountingChecks(parseBundle(bundle), { samples: 2 });
    expect(acct.issues.filter((i) => i.rule === 'acct.entryBlocked' && i.severity === 'error')).toHaveLength(1);
  });
});

describe('struct.examScope 與 struct.chapterKind：期中考範圍（T32）與借貸與分錄章只有一章（D1）', () => {
  const withChapters = (...extra: ReturnType<typeof chapter>[]) => validateBundle({ ...bundleWith([]), chapters: [...bundleWith([]).chapters, ...extra] });

  it('主線 midterm、延伸 not_in_exam 的已發布章節通過', () => {
    expect(withChapters(chapter('ch_m2t7q4', 4), chapter('ch_s0525x', 5, 'extension'))).toEqual([]);
  });

  it('已發布章節的 examScope 是 unconfirmed：struct.examScope 報錯；草稿可以先 unconfirmed', () => {
    const issues = withChapters(chapter('ch_m2t7q4', 4, 'core', { examScope: 'unconfirmed' }));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rule: 'struct.examScope', file: 'content/chapters/ch_m2t7q4.json', path: 'examScope' });
    expect(issues[0]!.message).toContain('midterm');
    expect(withChapters(chapter('ch_m2t7q4', 4, 'core', { examScope: 'unconfirmed', status: 'draft' }))).toEqual([]);
  });

  it('延伸章標成 midterm 或 unconfirmed：schema 層擋下（延伸章一律 not_in_exam）', () => {
    for (const examScope of ['midterm', 'unconfirmed']) {
      const issues = withChapters(chapter('ch_m2t7q4', 4, 'extension', { examScope }));
      expect(issues.map((i) => i.path)).toEqual(['examScope']);
      expect(issues[0]!.message).toContain('not_in_exam');
    }
  });

  it('kind: journal 只能是延伸章；全站只能有一章 kind: journal', () => {
    const core = withChapters(chapter('ch_m2t7q4', 4, 'core', { kind: 'journal' }));
    expect(core.map((i) => i.path)).toEqual(['kind']);
    const second = withChapters(chapter('ch_m2t7q4', 4, 'extension', { kind: 'journal' }));
    const hits = second.filter((i) => i.rule === 'struct.chapterKind');
    expect(hits.map((i) => i.file).sort()).toEqual(['content/chapters/ch_e4j7r2.json', 'content/chapters/ch_m2t7q4.json']);
    expect(hits[0]!.message).toContain('2 章');
    // 不認得的 kind 由 schema 擋
    expect(withChapters(chapter('ch_m2t7q4', 4, 'extension', { kind: 'ratio' })).map((i) => i.path)).toEqual(['kind']);
  });
});

describe('judgment 不計分、ratio_numeric 的 ratioRef 與 acceptStatus（10 第 10 節完成標準）', () => {
  const judgment = {
    id: 'q_j7dgm3nt',
    ...managed,
    type: 'judgment',
    chapterId: 'ch_n3f8q1',
    objectiveId: 'obj_5vk2m7',
    difficulty: 2,
    tags: ['tradeoff'],
    termRefs: [],
    scored: false,
    prompt: lt('你會選哪一個方案？', 'Which plan would you choose?'),
    explanation: lt('三個方案各有取捨。', 'Each plan has trade-offs.'),
    options: ['o_a1b2', 'o_c3d4', 'o_e5f6'].map((id) => ({
      id,
      text: lt(`方案 ${id}`, `Plan ${id}`),
      upside: lt('好處。', 'Upside.'),
      downside: lt('代價。', 'Downside.'),
    })),
    viewpoint: lt('網站的解說觀點。', "The site's viewpoint."),
    attribution: 'site',
  };

  it('judgment 的 scored 必須是 false；attribution 固定 site', () => {
    expect(validateBundle(bundleWith([judgment]))).toEqual([]);
    expect(validateBundle(bundleWith([{ ...judgment, scored: true }])).map((i) => i.path)).toContain('scored');
    expect(validateBundle(bundleWith([{ ...judgment, attribution: 'teacher' }])).map((i) => i.path)).toContain('attribution');
  });

  it('ratio_numeric 沒有 compute.ratioRef 被 schema 擋；正解為 N/A 的題要有 acceptStatus（ans.acceptStatus）', () => {
    const { ratioRef: _r, ...noRef } = qRoa.compute;
    expect(validateBundle(bundleWith([{ ...qRoa, compute: noRef }])).map((i) => i.path)).toContain('compute.ratioRef');
    const { acceptStatus: _a, ...noAccept } = qCurrentRatioNa;
    const acct = runAccountingChecks(parseBundle(bundleWith([noAccept])), FAST);
    expect(acct.issues.filter((i) => i.rule === 'ans.acceptStatus' && i.severity === 'error').map((i) => i.path)).toEqual(['acceptStatus']);
  });
});

describe('content:coverage --check：每個 objectiveId 已發布預計題數（M3 完成標準第一條）', () => {
  const published = [q172, { ...qMulti, objectiveId: 'obj_5vk2m7' }];
  const objectives = [
    objectiveFile('ch_n3f8q1', [objective('obj_5vk2m7', 'ch_n3f8q1', 1), objective('obj_4tw8m3', 'ch_n3f8q1', 2, { plannedQuestions: 3 })]),
    objectiveFile('ch_x4d9p2', [
      objective('obj_8wc3k6', 'ch_x4d9p2', 1, { plannedQuestions: 1 }),
      objective('obj_2mz7r4', 'ch_x4d9p2', 2, { status: 'retired', plannedQuestions: 4 }),
    ]),
  ];

  it('達標時沒有缺口；缺口逐條附檔案、items 路徑、規則與建議修正；已下架的目標不算；草稿目標標出來', () => {
    const met = coverage(
      parseBundle({
        ...bundleWith([
          ...published,
          { ...qMulti, id: 'q_p9k4r7c2', objectiveId: 'obj_4tw8m3' },
          { ...qMulti, id: 'q_p9k4r7c3', objectiveId: 'obj_4tw8m3' },
          { ...qMulti, id: 'q_p9k4r7c4', objectiveId: 'obj_4tw8m3' },
          qRoa,
        ]),
        objectives,
        levels: [],
      }),
    );
    expect(coverageShortfalls(met)).toEqual([]);
    const rows = Object.fromEntries(met.rows.map((r) => [r.objectiveId, r]));
    expect(rows.obj_5vk2m7).toMatchObject({ file: 'content/objectives/ch_n3f8q1.json', path: 'items.0', chapterStatus: 'published' });

    const short = coverage(
      parseBundle({ ...bundleWith([...published, { ...qMulti, id: 'q_p9k4r7c2', objectiveId: 'obj_4tw8m3', status: 'draft' }]), objectives, levels: [] }),
    );
    const shortfalls = coverageShortfalls(short);
    expect(shortfalls.map((s) => `${s.file} ${s.path}`)).toEqual([
      'content/objectives/ch_n3f8q1.json items.1.plannedQuestions',
      'content/objectives/ch_x4d9p2.json items.0.plannedQuestions',
    ]);
    expect(shortfalls[0]).toMatchObject({ rule: 'coverage.planned' });
    expect(shortfalls[0]!.message).toContain('已發布 0 / 預計 3 題，草稿 1 題');
    expect(shortfalls[0]!.message).toContain('再發布 3 題');
    expect(shortfalls[1]!.message).toContain('已發布 0 / 預計 1 題');
    // 草稿目標也算，訊息標出來
    const draftObjective = coverage(
      parseBundle({ ...bundleWith([]), objectives: [objectiveFile('ch_n3f8q1', [objective('obj_5vk2m7', 'ch_n3f8q1', 1, { status: 'draft' })])], levels: [] }),
    );
    expect(coverageShortfalls(draftObjective)[0]!.message).toContain('目標本身仍是草稿');
  });

  it('objectiveId 不存在的題目列為 coverage.unassigned', () => {
    const result = coverage(parseBundle({ ...bundleWith([q172]), objectives: [], levels: [] }));
    expect(coverageShortfalls(result)).toEqual([
      { rule: 'coverage.unassigned', file: 'content/questions/q_tx7h2c9d.json', path: 'objectiveId', message: expect.stringContaining('obj_5vk2m7') },
    ]);
  });
});

describe('快照：manifest.chapters[] 帶 scope 與 examScope；名詞帶 firstLevel（03 第 2.10 節）', () => {
  // 兩章各一關；ch_x4d9p2 的關卡刻意排在 levels 陣列前面，確認 firstLevel 依章節 order 而不是檔案順序
  const termShared = 'tm_g5c2m8tw'; // q172 的 termRefs 第一個
  const termLater = 'tm_zz9999aa';
  const first = [q172, qMulti, { ...qMulti, id: 'q_p9k4r7c2' }, { ...qMulti, id: 'q_p9k4r7c3' }, { ...qMulti, id: 'q_p9k4r7c4' }];
  const later = Array.from({ length: 5 }, (_, i) => ({
    ...qMulti,
    id: `q_k4t3r00${i}`,
    chapterId: 'ch_x4d9p2',
    objectiveId: 'obj_8wc3k6',
    termRefs: [termShared, termLater],
  }));
  const draftLevelQuestion = { ...qMulti, id: 'q_dr4ft0t1', status: 'draft', termRefs: ['tm_dr4ft0t1'] };
  const base = bundleWith([...first, ...later, draftLevelQuestion]);
  const bundle = {
    ...base,
    chapters: [
      { ...base.chapters[0]!, data: { ...base.chapters[0]!.data, objectiveIds: ['obj_5vk2m7', 'obj_4tw8m3'], levelIds: ['lv_f1rst001'] } },
      { ...base.chapters[1]!, data: { ...base.chapters[1]!.data, objectiveIds: ['obj_8wc3k6'], levelIds: ['lv_k4t3r001'] } },
      base.chapters[2]!,
    ],
    objectives: [
      objectiveFile('ch_n3f8q1', [objective('obj_5vk2m7', 'ch_n3f8q1', 1), objective('obj_4tw8m3', 'ch_n3f8q1', 2)]),
      objectiveFile('ch_x4d9p2', [objective('obj_8wc3k6', 'ch_x4d9p2', 1)]),
    ],
    levels: [
      levelFile(
        'lv_k4t3r001',
        'ch_x4d9p2',
        1,
        later.map((q) => q.id),
      ),
      levelFile(
        'lv_f1rst001',
        'ch_n3f8q1',
        1,
        first.map((q) => q.id),
      ),
      levelFile('lv_dr4ft001', 'ch_n3f8q1', 2, ['q_dr4ft0t1'], 'draft'),
    ],
  };
  const build = (includeDrafts = false) => {
    expect(validateBundle(bundle)).toEqual([]);
    const parsed = parseBundle(bundle);
    const acct = runAccountingChecks(parsed, FAST);
    expect(acct.issues.filter((i) => i.severity === 'error')).toEqual([]);
    return buildSnapshot(parsed, acct.compiled, { contentVersion: 1, items: [] }, { gitCommit: 'abc1234', builtAt: '2026-10-24T00:00:00Z', includeDrafts });
  };
  const fileOf = (out: { files: Map<string, string> }, path: string) => JSON.parse(out.files.get(path.slice('content/'.length))!);
  const termsOf = (out: { manifest: { termIndex: Record<string, string> }; files: Map<string, string> }, locale: string) =>
    fileOf(out, out.manifest.termIndex[locale]!) as { id: string; firstLevel?: { levelId: string; chapterId: string } }[];

  it('manifest.chapters[] 有 scope 與 examScope（延伸章 not_in_exam 加 kind: journal），章節檔也有', () => {
    const { manifest, files } = build();
    expect(manifest.chapters.map((c: Record<string, unknown>) => [c.id, c.scope, c.examScope, c.kind])).toEqual([
      ['ch_n3f8q1', 'core', 'midterm', undefined],
      ['ch_x4d9p2', 'core', 'midterm', undefined],
      ['ch_e4j7r2', 'extension', 'not_in_exam', 'journal'],
    ]);
    const chapterFile = JSON.parse(files.get(manifest.chapters[2]!.files['zh-TW']!.slice('content/'.length))!).chapter;
    expect(chapterFile).toMatchObject({ scope: 'extension', examScope: 'not_in_exam', kind: 'journal' });
  });

  it('章節的 notices（決定 4，非投資建議）：manifest 的章節摘要、章節檔與章節索引都帶；沒標的章節三處都沒有這個欄位', () => {
    const marked = { ...bundle, chapters: bundle.chapters.map((c, i) => (i === 2 ? { ...c, data: { ...c.data, notices: ['not_investment_advice'] } } : c)) };
    expect(validateBundle(marked)).toEqual([]);
    const parsed = parseBundle(marked);
    const acct = runAccountingChecks(parsed, FAST);
    const out = buildSnapshot(parsed, acct.compiled, { contentVersion: 1, items: [] }, { gitCommit: 'abc1234', builtAt: '2026-10-24T00:00:00Z' });
    expect(out.manifest.chapters.map((c: Record<string, unknown>) => [c.id, c.notices])).toEqual([
      ['ch_n3f8q1', undefined],
      ['ch_x4d9p2', undefined],
      ['ch_e4j7r2', ['not_investment_advice']],
    ]);
    expect('notices' in out.manifest.chapters[0]!).toBe(false);
    for (const locale of ['zh-TW', 'en']) {
      expect(fileOf(out, out.manifest.chapters[2]!.files[locale]!).chapter.notices).toEqual(['not_investment_advice']);
      expect('notices' in fileOf(out, out.manifest.chapters[0]!.files[locale]!).chapter).toBe(false);
      const index = fileOf(out, out.manifest.chapterIndex[locale]) as Record<string, unknown>[];
      expect(index.map((c) => c.notices)).toEqual([undefined, undefined, ['not_investment_advice']]);
    }
  });

  it('notices 的 schema：只接受已知代號、不得重複、不得是空陣列', () => {
    const withNotices = (notices: unknown) =>
      validateBundle({ ...bundle, chapters: bundle.chapters.map((c, i) => (i === 2 ? { ...c, data: { ...c.data, notices } } : c)) }).map((i) => i.path);
    expect(withNotices(['not_investment_advice'])).toEqual([]);
    expect(withNotices(['investment'])).not.toEqual([]);
    expect(withNotices(['not_investment_advice', 'not_investment_advice'])).not.toEqual([]);
    expect(withNotices([])).not.toEqual([]);
  });

  it('firstLevel 是第一個 termRefs 含該名詞的已發布關卡（依章節 order 與 levelIds 順序）；沒遇到的名詞省略；兩種語系相同', () => {
    const out = build();
    const zh = termsOf(out, 'zh-TW');
    const byId = Object.fromEntries(zh.map((t) => [t.id, t.firstLevel]));
    expect(byId[termShared]).toEqual({ levelId: 'lv_f1rst001', chapterId: 'ch_n3f8q1' });
    expect(byId[termLater]).toEqual({ levelId: 'lv_k4t3r001', chapterId: 'ch_x4d9p2' });
    // 只被範本或故事步驟引用、沒有題目用到的名詞沒有 firstLevel；草稿關卡的名詞在正式快照也沒有
    const untouched = zh.find((t) => t.firstLevel === undefined);
    expect(untouched).toBeDefined();
    expect('firstLevel' in untouched!).toBe(false);
    expect(byId['tm_dr4ft0t1']).toBeUndefined();
    expect(Object.fromEntries(termsOf(out, 'en').map((t) => [t.id, t.firstLevel]))).toEqual(byId);
    // 含草稿模式：草稿關卡接在章節後面，草稿題的名詞也有 firstLevel
    const drafts = build(true);
    expect(Object.fromEntries(termsOf(drafts, 'zh-TW').map((t) => [t.id, t.firstLevel]))['tm_dr4ft0t1']).toEqual({
      levelId: 'lv_dr4ft001',
      chapterId: 'ch_n3f8q1',
    });
  });

  it('名詞兩層（schemaVersion 3）：索引只有 TERM_INDEX_FIELDS；完整內容依 ID 分 8 桶，桶的聯集就是全部名詞；兩者的 firstLevel 相同', () => {
    const out = build();
    expect(out.manifest.schemaVersion).toBe(3);
    expect('terms' in out.manifest).toBe(false);
    for (const locale of ['zh-TW', 'en']) {
      const index = termsOf(out, locale) as Record<string, unknown>[];
      for (const t of index) for (const k of Object.keys(t)) expect(TERM_INDEX_FIELDS).toContain(k);
      expect(index.every((t) => !('definition' in t) && !('related' in t) && !('misconception' in t))).toBe(true);
      const buckets = out.manifest.termDetails[locale] as Record<string, string>;
      const details = Object.entries(buckets).flatMap(([b, path]) => {
        expect(b).toMatch(/^[0-7]$/);
        expect(path).toMatch(new RegExp(`^content/${locale}/terms-${b}\\.[0-9a-f]{6}\\.json$`));
        const list = fileOf(out, path) as Record<string, unknown>[];
        for (const t of list) expect(termDetailBucket(t.id as string)).toBe(b);
        return list;
      });
      expect(details.map((t) => t.id).sort()).toEqual(index.map((t) => t.id).sort());
      expect(details.every((t) => typeof t.definition === 'string' && !('authorNotes' in t))).toBe(true);
      const firstOf = (list: Record<string, unknown>[]) => Object.fromEntries(list.map((t) => [t.id, t.firstLevel]));
      expect(firstOf(details)).toEqual(firstOf(index));
    }
    // 'e' 的字元碼 101 除以 8 餘 5；'0' 是 48 餘 0、'z' 是 122 餘 2
    expect(termDetailBucket('tm_r4w8n2qe')).toBe('5');
    expect(termDetailBucket('tm_abcdefg0')).toBe('0');
    expect(termDetailBucket('tm_abcdefgz')).toBe('2');
  });

  it('草稿章節裡已發布的關卡不進正式快照（core-4）：manifest.levels、關卡檔與名詞的 firstLevel 都沒有它；含草稿模式才收', () => {
    const draftChapter = {
      ...bundle,
      chapters: bundle.chapters.map((c, i) => (i === 1 ? { ...c, data: { ...c.data, status: 'draft' } } : c)),
    };
    const parsed = parseBundle(draftChapter);
    const acct = runAccountingChecks(parsed, FAST);
    const meta = { gitCommit: 'abc1234', builtAt: '2026-10-24T00:00:00Z' };
    const out = buildSnapshot(parsed, acct.compiled, { contentVersion: 1, items: [] }, meta);
    expect(out.manifest.chapters.map((c: { id: string }) => c.id)).toEqual(['ch_n3f8q1', 'ch_e4j7r2']);
    expect(out.manifest.levels.map((l: { id: string }) => l.id)).toEqual(['lv_f1rst001']);
    expect(out.counts.levels).toBe(1);
    // 草稿章節沒有章節包，它的關卡也不會出現在任何檔案裡
    expect([...out.files.keys()].some((k) => k.includes('ch_x4d9p2'))).toBe(false);
    expect([...out.files.values()].some((t) => t.includes('lv_k4t3r001'))).toBe(false);
    // termLater 只在草稿章節的關卡出現：正式快照裡沒有 firstLevel
    expect(Object.fromEntries(termsOf(out, 'zh-TW').map((t) => [t.id, t.firstLevel]))[termLater]).toBeUndefined();
    const drafts = buildSnapshot(parsed, acct.compiled, { contentVersion: 1, items: [] }, { ...meta, includeDrafts: true });
    expect(drafts.manifest.levels.map((l: { id: string }) => l.id).sort()).toEqual(['lv_dr4ft001', 'lv_f1rst001', 'lv_k4t3r001']);
  });

  it('名詞索引帶 element（站規 1.11.4）：科目類名詞由 accountRef 查核心科目表的會計要素；查不到或不是科目類時省略；完整內容檔相同', () => {
    const [a, b, c, d] = bundle.terms;
    const asAccount = (e: (typeof bundle.terms)[number], accountRef: string) => ({ ...e, data: { ...e.data, category: 'account', accountRef } });
    const marked = {
      ...bundle,
      terms: [asAccount(a!, 'cash'), asAccount(b!, 'accounts_payable'), asAccount(c!, 'no_such_account'), d!, ...bundle.terms.slice(4)],
    };
    expect(validateBundle(marked)).toEqual([]);
    const parsed = parseBundle(marked);
    const acct = runAccountingChecks(parsed, FAST);
    const out = buildSnapshot(parsed, acct.compiled, { contentVersion: 1, items: [] }, { gitCommit: 'abc1234', builtAt: '2026-10-24T00:00:00Z' });
    expect(TERM_INDEX_FIELDS).toContain('element');
    for (const locale of ['zh-TW', 'en']) {
      const index = Object.fromEntries((termsOf(out, locale) as Record<string, unknown>[]).map((t) => [t.id, t]));
      expect(index[a!.data.id as string]).toMatchObject({ category: 'account', accountRef: 'cash', element: 'asset' });
      expect(index[b!.data.id as string]).toMatchObject({ category: 'account', accountRef: 'accounts_payable', element: 'liability' });
      expect('element' in index[c!.data.id as string]!).toBe(false);
      expect(index[d!.data.id as string]).toMatchObject({ category: 'concept' });
      expect('element' in index[d!.data.id as string]!).toBe(false);
      const details = Object.values(out.manifest.termDetails[locale] as Record<string, string>).flatMap((p) => fileOf(out, p) as Record<string, unknown>[]);
      expect(Object.fromEntries(details.filter((t) => t.element !== undefined).map((t) => [t.id, t.element]))).toEqual({
        [a!.data.id as string]: 'asset',
        [b!.data.id as string]: 'liability',
      });
    }
    // 測試可以換一份科目表（meta.accounts）：要素跟著換，證明是查表而不是寫死
    const swapped = buildSnapshot(
      parsed,
      acct.compiled,
      { contentVersion: 1, items: [] },
      { gitCommit: 'abc1234', builtAt: '2026-10-24T00:00:00Z', accounts: [{ id: 'cash', element: 'expense' }] },
    );
    const swappedIndex = Object.fromEntries((termsOf(swapped, 'zh-TW') as Record<string, unknown>[]).map((t) => [t.id, t.element]));
    expect(swappedIndex[a!.data.id as string]).toBe('expense');
    expect(swappedIndex[b!.data.id as string]).toBeUndefined();
  });

  it('章節索引：一個語系一檔、依 order 排列，只有 CHAPTER_INDEX_FIELDS 加上精簡的學習目標，和章節檔的內容一致', () => {
    const out = build();
    for (const locale of ['zh-TW', 'en']) {
      const index = fileOf(out, out.manifest.chapterIndex[locale]) as Record<string, any>[];
      expect(index.map((c) => c.id)).toEqual(out.manifest.chapters.map((c: { id: string }) => c.id));
      for (const [i, c] of index.entries()) {
        for (const k of Object.keys(c)) expect([...CHAPTER_INDEX_FIELDS, 'objectives']).toContain(k);
        const full = fileOf(out, out.manifest.chapters[i].files[locale]).chapter;
        expect(c.title).toBe(full.title);
        expect(c.levels).toEqual(full.levels);
        expect(c.objectives).toEqual(
          full.objectives.map((o: { id: string; order: number; statement: string }) => ({ id: o.id, order: o.order, statement: o.statement })),
        );
      }
    }
  });

  it('firstLevelByTerm 純函式：章節順序優先於關卡檔順序，同章依 levelIds 順序，同關依 questionIds 順序', () => {
    const chapters = [
      { id: 'ch_a', levelIds: ['lv_a2', 'lv_a1'] },
      { id: 'ch_b', levelIds: ['lv_b1'] },
    ];
    const levelById = new Map([
      ['lv_a1', { chapterId: 'ch_a', questionIds: ['q1'] }],
      ['lv_a2', { chapterId: 'ch_a', questionIds: ['q2', 'q3'] }],
      ['lv_b1', { chapterId: 'ch_b', questionIds: ['q4'] }],
      ['lv_missing', { chapterId: 'ch_b', questionIds: ['q5'] }],
    ]);
    const questionById = new Map([
      ['q1', { termRefs: ['t1', 't2'] }],
      ['q2', { termRefs: ['t3'] }],
      ['q3', { termRefs: ['t1'] }],
      ['q4', { termRefs: ['t2', 't4'] }],
      ['q5', { termRefs: ['t5'] }],
    ]);
    const map = firstLevelByTerm(chapters, levelById, questionById);
    expect(Object.fromEntries(map)).toEqual({
      t3: { levelId: 'lv_a2', chapterId: 'ch_a' },
      t1: { levelId: 'lv_a2', chapterId: 'ch_a' },
      t2: { levelId: 'lv_a1', chapterId: 'ch_a' },
      t4: { levelId: 'lv_b1', chapterId: 'ch_b' },
    });
  });
});

describe('five_step_fill 的 compiled.cells（判分的 expectedCells）', () => {
  const { choices: _choices, ...q172Base } = q172;
  const fiveStep = {
    ...q172Base,
    id: 'q_f1v3st3p',
    type: 'five_step_fill',
    scenario: { ...q172.scenario, targets: [] },
    openCells: ['bs_cash', 'bs_inventory', 'is_gross_profit'],
    prompt: lt('填入賣出存貨後的三個數字。', 'Fill in the three figures after the sale.'),
    explanation: lt('現金與毛利增加，存貨歸零。', 'Cash and gross profit rise; inventory falls to zero.'),
  };

  it('每個 openCells 的線對情境過帳後的金額（與 transaction_effect 的 after 一致），進快照', () => {
    const bundle = bundleWith([fiveStep]);
    expect(validateBundle(bundle)).toEqual([]);
    const parsed = parseBundle(bundle);
    const acct = runAccountingChecks(parsed, FAST);
    expect(acct.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(acct.compiled.get('q_f1v3st3p')?.cells).toEqual({
      bs_cash: q172Expected.t1.after,
      bs_inventory: q172Expected.t2.after,
      is_gross_profit: q172Expected.t3.after,
    });
    const { manifest, files } = buildSnapshot(
      {
        ...parsed,
        levels: [
          {
            file: 'content/levels/lv_f1v3st3p.json',
            data: { id: 'lv_f1v3st3p', ...managed, chapterId: 'ch_n3f8q1', order: 1, title: lt('關卡', 'Level'), questionIds: ['q_f1v3st3p'] },
          },
        ],
      },
      acct.compiled,
      { contentVersion: 1, items: [] },
      { builtAt: '2026-10-24T00:00:00Z' },
    );
    const chapterBundle = JSON.parse(files.get(manifest.levels[0]!.files['zh-TW']!.slice('content/'.length))!);
    const snapshot = chapterBundle.levels.find((l: { level: { id: string } }) => l.level.id === manifest.levels[0]!.id);
    expect(snapshot.questions[0].compiled.cells).toEqual({ bs_cash: q172Expected.t1.after, bs_inventory: 0, is_gross_profit: q172Expected.t3.after });
  });

  it('openCells 有版面上沒有的線：ref.layoutLine 報錯，這題沒有 compiled', () => {
    const acct = runAccountingChecks(parseBundle(bundleWith([{ ...fiveStep, openCells: ['bs_cash', 'bs_no_such_line'] }])), FAST);
    const hit = acct.issues.filter((i) => i.rule === 'ref.layoutLine');
    expect(hit).toHaveLength(1);
    expect(hit[0]).toMatchObject({ path: 'openCells', severity: 'error' });
    expect(hit[0]!.message).toContain('bs_no_such_line');
    expect(acct.compiled.has('q_f1v3st3p')).toBe(false);
  });
});

describe('ratio_interpret 的 ratioTable 與 compiled.ratios（畫面上方的指標小表格）', () => {
  const interpret = {
    id: 'q_1nt3rpr3',
    ...managed,
    type: 'ratio_interpret',
    chapterId: 'ch_x4d9p2',
    objectiveId: 'obj_8wc3k6',
    difficulty: 2,
    tags: ['current_ratio'],
    termRefs: [],
    scored: true,
    ratioRef: 'current_ratio@excel',
    prompt: lt('流動比率這樣的數字代表什麼？', 'What does a current ratio like this suggest?'),
    options: [
      { id: 'o_a1b2', text: lt('短期償債能力很強', 'Strong short-term liquidity'), feedback: lt('對。', 'Right.') },
      { id: 'o_c3d4', text: lt('公司一定賺錢', 'The company must be profitable'), feedback: lt('不對。', 'Not quite.') },
      { id: 'o_e5f6', text: lt('負債太高', 'Debt is too high'), feedback: lt('不對。', 'Not quite.') },
    ],
    correctOptionId: 'o_a1b2',
    explanation: lt('流動比率只看短期。', 'The current ratio only looks at the short term.'),
  };
  const compiledOf = (q: Record<string, unknown>) => {
    const bundle = bundleWith([q]);
    const schema = validateBundle(bundle);
    const acct = runAccountingChecks(parseBundle(bundle), FAST);
    return { schema, acct, errors: acct.issues.filter((i) => i.severity === 'error'), compiled: acct.compiled.get('q_1nt3rpr3') };
  };

  it('沒有 ratioTable：作者題，沒有 compiled，快照不帶 compiled.ratios', () => {
    const r = compiledOf(interpret);
    expect(r.schema).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.compiled).toEqual({});
  });

  it('ratioTable.scenario：每個 ratioRef 由核心依過帳後的報表算出，順序同 ratioRefs；題幹可引用事件參數', () => {
    const r = compiledOf({
      ...interpret,
      ratioTable: { ratioRefs: ['current_ratio@excel', 'roa@excel'], scenario: { ...q172.scenario, targets: [] } },
      prompt: lt('以 {{money:e1.price}} 賣出存貨後，流動比率代表什麼？', 'After selling for {{money:e1.price}}, what does the current ratio suggest?'),
    });
    expect(r.schema).toEqual([]);
    expect(r.errors).toEqual([]);
    const ratios = r.compiled?.ratios ?? [];
    expect(ratios.map((x) => x.ratioRef)).toEqual(['current_ratio@excel', 'roa@excel']);
    for (const x of ratios) {
      expect(['ok', 'zero', 'na', 'not_meaningful']).toContain(x.status);
      expect(Object.keys(x).sort()).toEqual(['displayValue', 'exact', 'ratioRef', 'status']);
    }
    // 這個期初沒有流動負債，流動比率是 N/A（照實寫）；ROA 算得出來
    expect(ratios[0]!.status).toBe('na');
    expect(ratios[1]!.status).toBe('ok');
    expect(typeof ratios[1]!.displayValue).toBe('number');
  });

  it('ratioTable.measures：作者 vars 給值，公式用到的線看聯集；N/A 照實寫，不擋', () => {
    const r = compiledOf({
      ...interpret,
      vars: { ca: 1860000, cl: 0, ni: 1180000, ta: 4720000 },
      ratioTable: {
        ratioRefs: ['current_ratio@excel', 'roa@excel'],
        measures: { bs_current_assets: 'vars.ca', bs_current_liabilities: 'vars.cl', is_net_income: 'vars.ni', bs_total_assets: 'vars.ta' },
      },
    });
    expect(r.schema).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.compiled?.ratios).toEqual([
      { ratioRef: 'current_ratio@excel', status: 'na', exact: null, displayValue: null },
      { ratioRef: 'roa@excel', status: 'ok', exact: { num: '1', den: '4' }, displayValue: 25 },
    ]);
  });

  it('刻意失敗：ratioRef 不在登錄檔（ref.ratio）、measures 缺線或多給（ans.ratioTableFields）、schema 層的四條', () => {
    const scenario = { ...q172.scenario, targets: [] };
    expect(compiledOf({ ...interpret, ratioTable: { ratioRefs: ['no_such_ratio@excel'], scenario } }).errors.map((i) => `${i.rule} ${i.path}`)).toEqual([
      'ref.ratio ratioTable.ratioRefs',
    ]);
    const vars = { ca: 1, cl: 2, x: 3 };
    const missing = compiledOf({ ...interpret, vars, ratioTable: { ratioRefs: ['current_ratio@excel'], measures: { bs_current_assets: 'vars.ca' } } });
    expect(missing.errors.map((i) => `${i.rule} ${i.path}`)).toEqual(['ans.ratioTableFields ratioTable.measures']);
    expect(missing.errors[0]!.message).toContain('bs_current_liabilities');
    const extra = compiledOf({
      ...interpret,
      vars,
      ratioTable: { ratioRefs: ['current_ratio@excel'], measures: { bs_current_assets: 'vars.ca', bs_current_liabilities: 'vars.cl', bs_cash: 'vars.x' } },
    });
    expect(extra.errors.map((i) => i.rule)).toEqual(['ans.ratioTableFields']);
    expect(extra.errors[0]!.message).toContain('bs_cash');
    expect(
      compiledOf({ ...interpret, vars, ratioTable: { ratioRefs: ['no_such_ratio@excel'], measures: { bs_current_assets: 'vars.ca' } } }).errors.map(
        (i) => i.rule,
      ),
    ).toEqual(['ref.ratio']);
    const paths = (q: Record<string, unknown>) => validateBundle(bundleWith([q])).map((i) => i.path);
    expect(paths({ ...interpret, ratioTable: { ratioRefs: ['roa@excel', 'roa@excel'], scenario } })).toEqual(['ratioTable.ratioRefs']);
    expect(paths({ ...interpret, ratioTable: { ratioRefs: ['roa@excel'] } })).toEqual(['ratioTable']);
    expect(paths({ ...interpret, ratioTable: { ratioRefs: ['roa@excel'], scenario, measures: { is_net_income: 'vars.ni' } } })).toContain('ratioTable');
    expect(paths({ ...interpret, ratioTable: { ratioRefs: ['roa@excel'], measures: { is_net_income: 'vars.ni' } } })).toEqual([
      'ratioTable.measures.is_net_income',
    ]);
    expect(paths({ ...interpret, ratioTable: { ratioRefs: [], scenario } })).toEqual(['ratioTable.ratioRefs']);
    // 其他題型不得帶 ratioTable
    expect(paths({ ...interpret, id: 'q_s1ng3ch0', type: 'single_choice', ratioTable: { ratioRefs: ['roa@excel'], scenario } })).toEqual(['ratioTable']);
    // 題幹引用 ratioTable.scenario 沒有的事件
    expect(paths({ ...interpret, ratioTable: { ratioRefs: ['roa@excel'], scenario }, prompt: lt('{{money:e9.price}}', '{{money:e9.price}}') })).toEqual([
      'prompt.zh-TW',
      'prompt.en',
    ]);
  });
});

describe('struct.levelSize 的例外：延伸章的全 judgment 關卡（E03），快照標 unscored', () => {
  const judgmentQ = (id: string, chapterId: string, objectiveId: string) => ({
    id,
    ...managed,
    type: 'judgment',
    chapterId,
    objectiveId,
    difficulty: 1,
    tags: ['tradeoff'],
    termRefs: [],
    scored: false,
    prompt: lt('你會怎麼選？', 'What would you choose?'),
    explanation: lt('各有取捨。', 'Each has trade-offs.'),
    options: ['o_a1b2', 'o_c3d4', 'o_e5f6'].map((oid) => ({
      id: oid,
      text: lt(`方案 ${oid}`, `Plan ${oid}`),
      upside: lt('好處。', 'Upside.'),
      downside: lt('代價。', 'Downside.'),
    })),
    viewpoint: lt('網站觀點。', 'Site viewpoint.'),
    attribution: 'site',
  });
  const j = (n: number, chapterId = 'ch_e4j7r2', objectiveId = 'obj_9wr3e6') =>
    Array.from({ length: n }, (_, i) => judgmentQ(`q_jdg${chapterId.slice(3, 5)}00${i}`, chapterId, objectiveId));
  const bundleFor = (
    questions: Record<string, unknown>[],
    chapterId: string,
    extraLevels: Record<string, unknown>[] = [],
    extraQuestions: Record<string, unknown>[] = [],
  ) => {
    const base = bundleWith([...questions, ...extraQuestions]);
    const objectiveId = chapterId === 'ch_e4j7r2' ? 'obj_9wr3e6' : 'obj_5vk2m7';
    return {
      ...base,
      chapters: base.chapters.map((c) => (c.data.id === chapterId ? { ...c, data: { ...c.data, objectiveIds: [objectiveId], levelIds: ['lv_jdgm3nt1'] } } : c)),
      objectives: [objectiveFile(chapterId, [objective(objectiveId, chapterId, 1)])],
      levels: [
        levelFile(
          'lv_jdgm3nt1',
          chapterId,
          1,
          questions.map((q) => String(q.id)),
        ),
        ...extraLevels,
      ],
    };
  };
  const levelIssues = (b: ReturnType<typeof bundleFor>) => validateBundle(b).filter((i) => i.file === 'content/levels/lv_jdgm3nt1.json');

  it('levelSizeIssue：allowUnscored 時 3 到 6 題全 judgment 通過；主線不允許；混計分題回到原本的規則', () => {
    const jq = { type: 'judgment', scored: false };
    const sq = { type: 'single_choice', scored: true };
    expect(levelSizeIssue(Array(4).fill(jq), { allowUnscored: true })).toBeNull();
    expect(levelSizeIssue(Array(3).fill(jq), { allowUnscored: true })).toBeNull();
    expect(levelSizeIssue(Array(6).fill(jq), { allowUnscored: true })).toBeNull();
    expect(levelSizeIssue(Array(2).fill(jq), { allowUnscored: true })).toMatch(/3 到 6/);
    expect(levelSizeIssue(Array(7).fill(jq), { allowUnscored: true })).toMatch(/3 到 6/);
    expect(levelSizeIssue(Array(4).fill(jq))).toMatch(/延伸章/);
    expect(levelSizeIssue([...Array(4).fill(jq), sq], { allowUnscored: true })).toMatch(/5 到 8/);
    expect(levelSizeIssue([...Array(5).fill(sq), jq], { allowUnscored: true })).toBeNull();
    expect(isUnscoredLevel(Array(3).fill(jq))).toBe(true);
    expect(isUnscoredLevel([])).toBe(false);
    expect(isUnscoredLevel([...Array(3).fill(jq), sq])).toBe(false);
  });

  it('validateBundle：延伸章已發布的全 judgment 關卡（4 題）通過；2 題或 7 題報 struct.levelSize；主線同樣的關卡報錯', () => {
    expect(validateBundle(bundleFor(j(4), 'ch_e4j7r2'))).toEqual([]);
    for (const n of [2, 7]) {
      const issues = levelIssues(bundleFor(j(n), 'ch_e4j7r2'));
      expect(issues.map((i) => i.rule)).toEqual(['struct.levelSize']);
      expect(issues[0]!.message).toContain('3 到 6');
    }
    const core = levelIssues(bundleFor(j(4, 'ch_n3f8q1', 'obj_5vk2m7'), 'ch_n3f8q1'));
    expect(core.map((i) => i.rule)).toEqual(['struct.levelSize']);
    expect(core[0]!.message).toContain('延伸章');
    // 延伸章混一題計分題：回到 5 到 8 題計分題的規則
    const mixed = levelIssues(bundleFor([...j(4), { ...qJournal }], 'ch_e4j7r2'));
    expect(mixed.map((i) => i.rule)).toEqual(['struct.levelSize']);
    expect(mixed[0]!.message).toContain('5 到 8');
  });

  it('快照：全 judgment 關卡在章節包的 level、chapter 的 levels 摘要與 manifest.levels 都標 unscored: true；一般關卡沒有這個欄位', () => {
    const scoredFive = [q172, qMulti, { ...qMulti, id: 'q_p9k4r7c2' }, { ...qMulti, id: 'q_p9k4r7c3' }, { ...qMulti, id: 'q_p9k4r7c4' }];
    const normal = levelFile(
      'lv_n0rm4701',
      'ch_n3f8q1',
      1,
      scoredFive.map((q) => q.id),
    );
    const bundle = bundleFor(j(4), 'ch_e4j7r2', [normal], scoredFive);
    const full = {
      ...bundle,
      chapters: bundle.chapters.map((c) =>
        c.data.id === 'ch_n3f8q1' ? { ...c, data: { ...c.data, objectiveIds: ['obj_5vk2m7', 'obj_4tw8m3'], levelIds: ['lv_n0rm4701'] } } : c,
      ),
      objectives: [...bundle.objectives, objectiveFile('ch_n3f8q1', [objective('obj_5vk2m7', 'ch_n3f8q1', 1), objective('obj_4tw8m3', 'ch_n3f8q1', 2)])],
    };
    expect(validateBundle(full).map((i) => `${i.file} ${i.path}：${i.message}`)).toEqual([]);
    const parsed = parseBundle(full);
    const acct = runAccountingChecks(parsed, FAST);
    const { manifest, files } = buildSnapshot(parsed, acct.compiled, { contentVersion: 1, items: [] }, { builtAt: '2026-10-24T00:00:00Z' });
    const entry = (id: string) => manifest.levels.find((l: { id: string }) => l.id === id);
    expect(entry('lv_jdgm3nt1')).toMatchObject({ unscored: true, questionIds: j(4).map((q) => q.id) });
    expect('unscored' in entry('lv_n0rm4701')).toBe(false);
    const levelFileOf = (id: string) =>
      JSON.parse(files.get(entry(id).files['zh-TW'].slice('content/'.length))!).levels.find((l: { level: { id: string } }) => l.level.id === id);
    expect(levelFileOf('lv_jdgm3nt1').level.unscored).toBe(true);
    expect('unscored' in levelFileOf('lv_n0rm4701').level).toBe(false);
    const chapterFileOf = (id: string) =>
      JSON.parse(files.get(manifest.chapters.find((c: { id: string }) => c.id === id)!.files['zh-TW']!.slice('content/'.length))!).chapter;
    expect(chapterFileOf('ch_e4j7r2').levels).toEqual([
      { id: 'lv_jdgm3nt1', order: 1, title: '關卡 lv_jdgm3nt1', objectiveIds: [], questionCount: 4, unscored: true },
    ]);
    expect('unscored' in chapterFileOf('ch_n3f8q1').levels[0]).toBe(false);
  });
});

describe('連鎖指標的 measures：公式引用 ratio.* 時，被引用指標的線也算需要', () => {
  const registry = defaultRatioRegistry();
  const pe = {
    ...qRoa,
    id: 'q_p3r4t100',
    vars: { ni: 1180000, sc: 2000000, price: 59, par: 10 },
    compute: {
      ratioRef: 'pe_ratio@slides02',
      measures: { is_net_income: 'vars.ni', bs_share_capital: 'vars.sc', 'input.share_price': 'vars.price', 'input.par_value': 'vars.par' },
    },
    answerUnit: 'multiple',
    prompt: lt('股價 {{money:vars.price}}，本益比是多少？', 'Share price {{money:vars.price}}. What is the P/E ratio?'),
    explanation: lt('先算每股盈餘，再用股價除以它。', 'Work out EPS first, then divide the share price by it.'),
  };
  const run = (q: Record<string, unknown>) => {
    const bundle = bundleWith([q]);
    const acct = runAccountingChecks(parseBundle(bundle), FAST);
    return { schema: validateBundle(bundle), errors: acct.issues.filter((i) => i.severity === 'error'), compiled: acct.compiled.get(String(q.id)) };
  };

  it('requiredLines 遞迴展開：pe_ratio@slides02 需要 eps 的 is_net_income 與 bs_share_capital', () => {
    expect([...requiredLines(registry, 'pe_ratio@slides02')].sort()).toEqual(['bs_share_capital', 'is_net_income']);
    expect([...requiredLines(registry, 'roa@excel')].sort()).toEqual(['bs_total_assets', 'is_net_income']);
    expect([...requiredLines(registry, 'no_such@excel')]).toEqual([]);
  });

  it('成功：給連鎖來源的線與兩個 input，核心算出本益比（股價除以每股盈餘）', () => {
    const r = run(pe);
    expect(r.schema.map((i) => `${i.path}：${i.message}`)).toEqual([]);
    expect(r.errors).toEqual([]);
    // 每股盈餘 = 1180000 / (2000000 / 10) = 5.9；本益比 = 59 / 5.9 = 10
    expect(r.compiled?.ratio).toMatchObject({ ratioRef: 'pe_ratio@slides02', status: 'ok', displayValue: 10 });
  });

  it('刻意失敗：少給連鎖來源的線是「沒有給值」而不是通過；多給無關的線仍是「多給」', () => {
    const { bs_share_capital: _s, ...missing } = pe.compute.measures;
    const r1 = run({ ...pe, compute: { ...pe.compute, measures: missing } });
    expect(r1.errors.map((i) => i.rule)).toEqual(['ans.ratioNumericFields']);
    expect(r1.errors[0]!.message).toContain('沒有給值：bs_share_capital');
    const r2 = run({ ...pe, vars: { ...pe.vars, x: 1 }, compute: { ...pe.compute, measures: { ...pe.compute.measures, bs_cash: 'vars.x' } } });
    expect(r2.errors.map((i) => i.rule)).toEqual(['ans.ratioNumericFields']);
    expect(r2.errors[0]!.message).toContain('多給：bs_cash');
  });

  it('ratioTable.measures 同樣展開：pe_ratio 與 eps 放同一張表只要給一組線', () => {
    const interpret = {
      ...pe,
      id: 'q_p3t4b730',
      type: 'ratio_interpret',
      ratioRef: 'pe_ratio@slides02',
      ratioTable: { ratioRefs: ['pe_ratio@slides02', 'eps@excel'], measures: pe.compute.measures },
      options: [
        { id: 'o_a1b2', text: lt('市場願意付十年的盈餘', 'The market pays ten years of earnings'), feedback: lt('對。', 'Right.') },
        { id: 'o_c3d4', text: lt('公司負債太多', 'Too much debt'), feedback: lt('不對。', 'Not quite.') },
        { id: 'o_e5f6', text: lt('每股虧損', 'A loss per share'), feedback: lt('不對。', 'Not quite.') },
      ],
      correctOptionId: 'o_a1b2',
    };
    const { compute: _c, answerUnit: _u, decimals: _d, tolerance: _t, ...q } = interpret;
    const r = run(q);
    expect(r.schema).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.compiled?.ratios?.map((x) => [x.ratioRef, x.status, x.displayValue])).toEqual([
      ['pe_ratio@slides02', 'ok', 10],
      ['eps@excel', 'ok', 5.9],
    ]);
    const { bs_share_capital: _s, ...missing } = pe.compute.measures;
    const bad = run({ ...q, ratioTable: { ...q.ratioTable, measures: missing } });
    expect(bad.errors.map((i) => `${i.rule} ${i.path}`)).toEqual(['ans.ratioTableFields ratioTable.measures']);
  });
});

describe('故事步驟的引用不受檔案順序影響（chapterEndLinks、labRefs、labRef 在故事登錄之後檢查）', () => {
  const link = { kind: 'lab', story: 'story_q7m2v9', step: 'st_h8q3z6' };
  const withLinks = (storyStatus: string) => {
    const base = bundleWith([q172]);
    const story = { ...storyEntry, data: { ...storyEntry.data, status: storyStatus } };
    return {
      ...base,
      stories: [story],
      chapters: base.chapters.map((c) =>
        c.data.id === 'ch_n3f8q1' ? { ...c, data: { ...c.data, objectiveIds: ['obj_5vk2m7'], chapterEndLinks: [link] } } : c,
      ),
      objectives: [objectiveFile('ch_n3f8q1', [objective('obj_5vk2m7', 'ch_n3f8q1', 1, { labRefs: [{ story: link.story, step: link.step }] })])],
      levels: [],
    };
  };

  it('成功：章節的 chapterEndLinks 與目標的 labRefs 指向存在的步驟，不再誤報「不屬於故事」', () => {
    expect(validateBundle(withLinks('published')).map((i) => `${i.file} ${i.path}：${i.message}`)).toEqual([]);
  });

  it('刻意失敗：步驟屬於別的故事或不存在仍報錯；重複的步驟 ID 仍報錯', () => {
    const b = withLinks('published');
    const wrongStep = {
      ...b,
      chapters: b.chapters.map((c) => ('chapterEndLinks' in c.data ? { ...c, data: { ...c.data, chapterEndLinks: [{ ...link, step: 'st_zz9999' }] } } : c)),
    };
    expect(validateBundle(wrongStep).map((i) => `${i.path}：${i.message}`)).toEqual(['chapterEndLinks：步驟 st_zz9999 不屬於故事 story_q7m2v9']);
    const dup = structuredClone(storyEntry.data) as { id: string; steps: { id: string }[] };
    dup.id = 'story_zz9999';
    const dupIssues = validateBundle({ ...b, stories: [storyEntry, { file: 'content/stories/story_zz9999.json', data: dup }] });
    expect(dupIssues.some((i) => i.file === 'content/stories/story_zz9999.json' && i.message.includes('步驟 ID 已在故事 story_q7m2v9 使用'))).toBe(true);
    // 連結仍正確解析到第一個登錄的故事，不會因重複而誤報章節
    expect(dupIssues.filter((i) => i.path === 'chapterEndLinks')).toEqual([]);
  });

  it('已發布內容引用草稿故事的步驟：validateBundle 通過，content:check 以 ref.publishedClosure 警告（故事 M4a 才發布）', () => {
    const b = withLinks('draft');
    expect(validateBundle(b)).toEqual([]);
    const warnings = runTextChecks(parseBundle(b)).filter((i) => i.rule === 'ref.publishedClosure');
    expect(warnings.map((i) => `${i.severity} ${i.file} ${i.path}`)).toEqual([
      'warning content/chapters/ch_n3f8q1.json chapterEndLinks.0',
      'warning content/objectives/ch_n3f8q1.json items.0.labRefs.0',
      'warning content/questions/q_tx7h2c9d.json labRef',
    ]);
    expect(runTextChecks(parseBundle(withLinks('published'))).filter((i) => i.rule === 'ref.publishedClosure')).toEqual([]);
  });
});

describe('ref.termRefsListed：題目文字裡的 {{term:x}} 必須列在 termRefs', () => {
  const ref = 'tm_g5c2m8tw';
  const other = 'tm_n7v3k8pq';
  const withTerms = (q: Record<string, unknown>) => {
    const base = bundleWith([q]);
    // 沒列在 termRefs 的名詞仍要存在，才不會先被 ref.term 擋下
    return parseBundle({
      ...base,
      terms: [...base.terms, ...[ref, other].filter((id) => !base.terms.some((t) => t.data.id === id)).map((id) => termEntry(id))],
    });
  };
  const hits = (q: Record<string, unknown>) =>
    runTextChecks(withTerms(q))
      .filter((i) => i.rule === 'ref.termRefsListed')
      .map((i) => `${i.severity} ${i.path}`);

  it('題幹、選項、回饋與解說用了沒列出的名詞：每個位置各一個錯誤，訊息指出名詞 ID', () => {
    const q = {
      ...qMulti,
      termRefs: [ref],
      prompt: lt(`哪些會讓{{term:${ref}}}增加？`, `Which of these increase {{term:${ref}}}?`),
      options: qMulti.options.map((o, i) =>
        i === 1 ? { ...o, feedback: lt(`這和{{term:${other}|plain}}有關。`, `This concerns {{term:${other}|plain}}.`) } : o,
      ),
      explanation: lt(`{{term:${other}}}不是本業收現。`, `{{term:${other}}} is not operating cash.`),
    };
    expect(hits(q).sort()).toEqual(['error explanation.en', 'error explanation.zh-TW', 'error options.1.feedback.en', 'error options.1.feedback.zh-TW']);
    const issue = runTextChecks(withTerms(q)).find((i) => i.rule === 'ref.termRefsListed')!;
    expect(issue.message).toContain(other);
    expect(issue.file).toBe('content/questions/q_p9k4r7cx.json');
  });

  it('列在 termRefs 的名詞（含 |plain）通過；沒有名詞佔位符的題目也通過', () => {
    const q = {
      ...qMulti,
      termRefs: [ref, other],
      explanation: lt(`{{term:${ref}}}與{{term:${other}|plain}}。`, `{{term:${ref}}} and {{term:${other}|plain}}.`),
    };
    expect(hits(q)).toEqual([]);
    expect(hits(qMulti)).toEqual([]);
  });
});

describe('style.sourceRefs 的學習端延伸：內部追蹤編號與教材單元編號不進學生看得到的文字', () => {
  it('純函式：T、D、W、V 加一到兩位數字、0-1 到 0-3、slides 加數字都抓到', () => {
    expect(learnerRefHit('理由見設計說明 T28。')).toEqual({ why: '內部追蹤編號', sample: 'T28' });
    expect(learnerRefHit('see design note T23)')).toEqual({ why: '內部追蹤編號', sample: 'T23' });
    expect(learnerRefHit('依 D10(e) 的決定')).toMatchObject({ sample: 'D10' });
    expect(learnerRefHit('（W3）')).toMatchObject({ sample: 'W3' });
    expect(learnerRefHit('實測 V19 之後')).toMatchObject({ sample: 'V19' });
    expect(learnerRefHit('【待確認T05】')).toMatchObject({ sample: 'T05' });
    expect(learnerRefHit('0-2 的簡化公式')).toEqual({ why: '教材單元編號', sample: '0-2' });
    expect(learnerRefHit('slides03 版的分母')).toEqual({ why: '教材單元編號', sample: 'slides03' });
    expect(learnerRefHit('see slide 12')).toMatchObject({ sample: 'slide 12' });
    expect(learnerRefHit('Follows unit 0-1.')).toMatchObject({ sample: '0-1' });
  });

  it('純函式：正常文字不誤判（T 字帳、T-account、金額、百分比、條號、年份、佔位符、英文單字）', () => {
    for (const ok of [
      '用 T 字帳記錄借方與貸方',
      'Use a T-account to record debits and credits.',
      'T 字帳的左邊是借方',
      '月底付款 {{money:vars.t1}}，利率 {{percent:vars.rate}}',
      '依 IAS 1.82(b) 與 IFRS 18',
      '{{raw:2027}} 年起適用，第 3 步',
      'Taiwan applies IFRS 18 from 2028; TV, DVD and W-2 forms are not relevant.',
      '營收 1,000、前期 800',
      'PT1 型號與 T100 不算',
      '比率 10.5 與 3D 圖',
      '2027-01-01 生效',
      'Version 0-10 不是教材編號',
      'the slides show a trend',
    ])
      expect({ ok, hit: learnerRefHit(ok) }).toEqual({ ok, hit: null });
  });

  it('runTextChecks：題目、名詞卡（formula、ifrsNote）、章節與關卡的學生文字報錯；pendingRefs、authorNotes 與 ratioRef 不報', () => {
    const q = {
      ...qMulti,
      explanation: lt('網站一律顯示 N/A，理由見設計說明 T28。', 'The site shows N/A (see design note T28).'),
      options: qMulti.options.map((o, i) => (i === 2 ? { ...o, feedback: lt('依 slides03 的分母。', 'Uses the slides03 denominator.') } : o)),
      authorNotes: '對應 T28 與 D13 的決定；指標用 cash_reinvestment@slides03',
    };
    const base = bundleWith([q]);
    const t = termEntry('tm_k8q2va4n');
    t.data = {
      ...t.data,
      pendingRefs: ['T24'],
      ratioRef: 'cash_reinvestment@slides03',
      formula: lt('分母依 W08 的版本', 'The denominator follows W08.'),
      ifrsNote: lt('IFRS 沒有這一項。', 'IFRS has no such line.'),
    };
    const parsed = parseBundle({
      ...base,
      terms: [...base.terms, t],
      chapters: base.chapters.map((c, i) => (i === 0 ? { ...c, data: { ...c.data, summary: lt('本章依 0-1 的順序。', 'Follows unit 0-1.') } } : c)),
      levels: [levelFile('lv_pb000000', 'ch_n3f8q1', 1, ['q_p9k4r7cx'])],
    });
    const hits = runTextChecks(parsed)
      .filter((i) => i.rule === 'style.sourceRefs')
      .map((i) => `${i.severity} ${i.file} ${i.path}`)
      .sort();
    expect(hits).toEqual(
      [
        'error content/chapters/ch_n3f8q1.json summary.en',
        'error content/chapters/ch_n3f8q1.json summary.zh-TW',
        'error content/questions/q_p9k4r7cx.json explanation.en',
        'error content/questions/q_p9k4r7cx.json explanation.zh-TW',
        'error content/questions/q_p9k4r7cx.json options.2.feedback.en',
        'error content/questions/q_p9k4r7cx.json options.2.feedback.zh-TW',
        'error content/terms/tm_k8q2va4n.json formula.en',
        'error content/terms/tm_k8q2va4n.json formula.zh-TW',
      ].sort(),
    );
    // 0-1 同時符合全欄位的規則（所有字串）和學習端延伸，只報一次；authorNotes 的 T28、D13 與 slides03 不報
    expect(hits.some((h) => h.includes('authorNotes') || h.includes('pendingRefs') || h.includes('ratioRef'))).toBe(false);
  });
});
