// M2 內容管線（08 第 1.2、4.1、5.5、5.7、7.3 節）：content:new 的 ID 唯一與骨架、content:coverage 的統計、content:build 的快照形狀、
// 文字與結構規則（ans.multiCountHint、ans.noLetterRefs、ans.feedbackEveryOption、style.sourceRefs、style.rawNumbers、struct.levelSize、struct.filename）。
// 全部直接呼叫 tools/lib 的純函式，搭配 fixtures.ts 的題目與核心的自編故事。
import { Level, Objective, QUESTION_TYPES, Question, validateBundle } from '@ledgerland/content-schema';
import { describe, expect, it } from 'vitest';
import { coverage, coverageMarkdown } from '../lib/content-coverage.mjs';
import { collectIds, skeleton, uniqueId } from '../lib/content-new.mjs';
import { parseBundle, runAccountingChecks } from '../lib/content-rules.mjs';
import { buildSnapshot } from '../lib/content-snapshot.mjs';
import { hasLetterRef, hasMultiCountHint, rawNumberHit, runTextChecks, sourceRefHit } from '../lib/content-text.mjs';
import { bundleWith, q172, q172Expected, qJournal, qMulti, qRoa } from './fixtures.ts';

const lt = (zh: string, en: string) => ({ 'zh-TW': zh, en });
const managed = { rev: 1, revKind: 'text', status: 'published' };
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
/** fixtures 的題目分屬三章；每章一個學習目標檔 */
const objectiveFiles = [
  {
    file: 'content/objectives/ch_n3f8q1.json',
    data: { chapterId: 'ch_n3f8q1', items: [objective('obj_5vk2m7', 'ch_n3f8q1', 1), objective('obj_4tw8m3', 'ch_n3f8q1', 2, { status: 'draft' })] },
  },
  {
    file: 'content/objectives/ch_x4d9p2.json',
    data: { chapterId: 'ch_x4d9p2', items: [objective('obj_8wc3k6', 'ch_x4d9p2', 1), objective('obj_2mz7r4', 'ch_x4d9p2', 2)] },
  },
  { file: 'content/objectives/ch_e4j7r2.json', data: { chapterId: 'ch_e4j7r2', items: [objective('obj_9wr3e6', 'ch_e4j7r2', 1)] } },
];
const levelFile = (id: string, chapterId: string, questionIds: string[], status = 'published') => ({
  file: `content/levels/${id}.json`,
  data: { id, ...managed, status, chapterId, order: 1, title: lt('測試關卡', 'Test level'), questionIds },
});
const FAST = { samples: 0 };

describe('content:new（08 第 4.1 節）', () => {
  it('collectIds 收集內容與 lock 的 ID（含選項）；uniqueId 碰撞時重抽', () => {
    const bundle = bundleWith([qMulti]);
    const taken = collectIds(bundle, { items: [{ id: 'q_l0ck0000' }] });
    expect(taken.has('q_p9k4r7cx')).toBe(true);
    expect(taken.has('o_f3k8')).toBe(true);
    expect(taken.has('q_l0ck0000')).toBe(true);
    // 固定 random 會先產生同一個 ID；第一次拿到，第二次必須重抽到不同的值
    const seq = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    let i = 0;
    const random = () => seq[i++ % seq.length] as number;
    const set = new Set<string>();
    const a = uniqueId('question', set, random);
    const b = uniqueId('question', set, random);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^q_[0-9a-hjkmnp-tv-z]{8}$/);
    expect(set.size).toBe(2);
    expect(() => uniqueId('question', new Set([a]), () => 0.5, 3)).toThrow(/碰撞/);
  });

  it('每種骨架都通過該實體的 schema（草稿）；objective 與 level 需要 chapterId', () => {
    const taken = new Set<string>();
    expect(Objective.safeParse(skeleton('objective', { chapterId: 'ch_c5f8w2' }, taken).data).success).toBe(true);
    expect(Level.safeParse(skeleton('level', { chapterId: 'ch_c5f8w2' }, taken).data).success).toBe(true);
    const results = QUESTION_TYPES.map((type) => ({
      type,
      ok: Question.safeParse(skeleton('question', { chapterId: 'ch_c5f8w2', type }, taken).data).success,
    }));
    expect(results).toEqual(QUESTION_TYPES.map((type) => ({ type, ok: true })));
    expect(() => skeleton('question', {}, taken)).toThrow(/--chapter/);
    expect(() => skeleton('question', { chapterId: 'ch_c5f8w2', type: 'essay' }, taken)).toThrow(/題型/);
    const ids = [...taken];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('content:coverage（08 第 1.2 節）', () => {
  it('每個目標的預計、草稿、已發布、題型與難度分布、迷思使用次數', () => {
    const multiWithMc = { ...qMulti, status: 'draft', options: qMulti.options.map((o, i) => (i === 1 ? { ...o, misconceptionId: 'mc_7f2d' } : o)) };
    const files = structuredClone(objectiveFiles);
    files[0]!.data.items[1] = objective('obj_4tw8m3', 'ch_n3f8q1', 2, { misconceptions: [{ id: 'mc_7f2d', text: lt('迷思', 'Misconception') }] });
    const bundle = { ...bundleWith([q172, multiWithMc, qRoa]), objectives: files, levels: [] };
    const result = coverage(parseBundle(bundle));
    const byId = Object.fromEntries(result.rows.map((r) => [r.objectiveId, r]));
    expect(byId.obj_5vk2m7).toMatchObject({ planned: 2, draft: 0, published: 1, byDifficulty: { 1: 0, 2: 1, 3: 0 } });
    expect(byId.obj_5vk2m7?.byType.transaction_effect).toBe(1);
    expect(byId.obj_4tw8m3).toMatchObject({ draft: 1, published: 0, misconceptions: [{ id: 'mc_7f2d', used: 1 }] });
    expect(byId.obj_8wc3k6?.byType.ratio_numeric).toBe(1);
    expect(result.totals).toEqual({ planned: 10, draft: 1, published: 2 });
    expect(result.rows.map((r) => r.chapterOrder)).toEqual([1, 1, 2, 2, 3]);
    const md = coverageMarkdown(result, { builtAt: '2026-10-23T00:00:00Z' });
    expect(md).toContain('| obj_5vk2m7 |');
    expect(md).toContain('尚未達到預計題數');
  });
  it('objectiveId 不存在的題目列在 unassigned', () => {
    const result = coverage(parseBundle({ ...bundleWith([q172]), objectives: [], levels: [] }));
    expect(result.rows).toEqual([]);
    expect(result.unassigned).toEqual([{ id: 'q_tx7h2c9d', objectiveId: 'obj_5vk2m7', file: 'content/questions/q_tx7h2c9d.json' }]);
  });
});

describe('content:build 的快照形狀（08 第 7.3 節、04 第 15.2 節）', () => {
  const scoredFive = [q172, qMulti, { ...qMulti, id: 'q_p9k4r7c2' }, { ...qMulti, id: 'q_p9k4r7c3' }, { ...qMulti, id: 'q_p9k4r7c4', authorNotes: '不進快照' }];
  const draft = { ...qMulti, id: 'q_p9k4r7c5', status: 'draft' };
  const level = levelFile(
    'lv_k7m2q9xd',
    'ch_n3f8q1',
    scoredFive.map((q) => q.id),
  );
  const chapters = [
    { file: 'content/chapters/ch_n3f8q1.json', data: { ...bundleWith([]).chapters[0]!.data, objectiveIds: ['obj_5vk2m7'], levelIds: ['lv_k7m2q9xd'] } },
    bundleWith([]).chapters[1]!,
    bundleWith([]).chapters[2]!,
  ];
  const files = structuredClone(objectiveFiles);
  files[0]!.data.items[1]!.status = 'published';
  const bundle = {
    ...bundleWith([...scoredFive, draft, qJournal, qRoa]),
    chapters,
    objectives: files,
    levels: [level, levelFile('lv_dr4ft000', 'ch_n3f8q1', [], 'draft')],
  };

  it('引用自洽；manifest 列出章節的 levelIds 與每關的 questionIds 與檔案；章節包含該章的關卡、題目與核心答案；草稿與 authorNotes 不進快照', () => {
    expect(validateBundle(bundle)).toEqual([]);
    const parsed = parseBundle(bundle);
    const acct = runAccountingChecks(parsed, FAST);
    expect(acct.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const lock = { contentVersion: 7, items: [{ id: 'q_tx7h2c9d', rev: 3, answerRev: 2 }] };
    const { manifest, files: out, counts } = buildSnapshot(parsed, acct.compiled, lock, { gitCommit: 'abc1234', builtAt: '2026-10-23T00:00:00Z' });
    expect(counts).toEqual({ chapters: 3, objectives: 5, levels: 1, questions: 7, terms: counts.terms });
    expect(manifest.contentVersion).toBe(7);
    expect(manifest.chapters[0]).toMatchObject({ id: 'ch_n3f8q1', order: 1, levelIds: ['lv_k7m2q9xd'] });
    expect(manifest.levels).toHaveLength(1);
    expect(manifest.levels[0]).toMatchObject({ id: 'lv_k7m2q9xd', chapterId: 'ch_n3f8q1', order: 1, questionIds: scoredFive.map((q) => q.id) });
    for (const locale of ['zh-TW', 'en']) {
      // 關卡的檔就是所屬章節的章節包（schemaVersion 3）：{ chapter, levels }
      const path = manifest.levels[0]!.files[locale]!;
      expect(path).toMatch(new RegExp(`^content/${locale}/ch_n3f8q1\\.[0-9a-f]{6}\\.json$`));
      expect(path).toBe(manifest.chapters[0]!.files[locale]);
      const bundle = JSON.parse(out.get(path.slice('content/'.length))!);
      expect(Object.keys(bundle)).toEqual(['chapter', 'levels']);
      expect(bundle.levels.map((l: { level: { id: string } }) => l.level.id)).toEqual(['lv_k7m2q9xd']);
      const snapshot = bundle.levels[0];
      expect(snapshot.level).toMatchObject({ id: 'lv_k7m2q9xd', questionIds: scoredFive.map((q) => q.id) });
      expect(snapshot.questions.map((q: { id: string }) => q.id)).toEqual(scoredFive.map((q) => q.id));
      const first = snapshot.questions[0];
      expect(first.answerRev).toBe(2);
      expect(first.compiled.expected).toEqual(q172Expected);
      expect(first.compiled.values['e1.price']).toBe(1120000);
      expect(typeof first.prompt).toBe('string');
      expect(first.prompt).toContain('{{money:e1.price}}');
      expect(snapshot.questions[1].answerRev).toBe(1);
      expect(snapshot.questions[1].compiled).toBeUndefined();
      expect(snapshot.questions[4].authorNotes).toBeUndefined();
      expect(JSON.stringify(snapshot)).not.toContain('q_p9k4r7c5');
      const chapterFile = bundle.chapter;
      expect(chapterFile.levelIds).toEqual(['lv_k7m2q9xd']);
      expect(chapterFile.objectives.map((o: { id: string }) => o.id)).toEqual(['obj_5vk2m7', 'obj_4tw8m3']);
      expect(typeof chapterFile.objectives[0].statement).toBe('string');
    }
    expect(JSON.parse(out.get(manifest.levels[0]!.files.en!.slice('content/'.length))!).levels[0].questions[0].prompt).toMatch(/^Lime Leaf/);
    expect(manifest.tombstones).toMatch(/^content\/tombstones\.[0-9a-f]{6}\.json$/);
  });

  it('章節包 chapter 的 levels：已發布關卡的摘要（id、order、title、objectiveIds、questionCount），順序同 levelIds，title 依語系展開', () => {
    const withObjectives = { ...level, data: { ...level.data, objectiveIds: ['obj_5vk2m7'] } };
    const parsed = parseBundle({ ...bundle, levels: [withObjectives, levelFile('lv_dr4ft000', 'ch_n3f8q1', [], 'draft')] });
    const acct = runAccountingChecks(parsed, FAST);
    const { manifest, files: out } = buildSnapshot(parsed, acct.compiled, { contentVersion: 1, items: [] }, { builtAt: '2026-10-23T00:00:00Z' });
    const zh = JSON.parse(out.get(manifest.chapters[0]!.files['zh-TW']!.slice('content/'.length))!).chapter;
    const en = JSON.parse(out.get(manifest.chapters[0]!.files.en!.slice('content/'.length))!).chapter;
    expect(zh.levels).toEqual([{ id: 'lv_k7m2q9xd', order: 1, title: '測試關卡', objectiveIds: ['obj_5vk2m7'], questionCount: 5 }]);
    expect(en.levels[0]).toMatchObject({ id: 'lv_k7m2q9xd', title: 'Test level', questionCount: 5 });
    expect(zh.levels.map((l: { id: string }) => l.id)).toEqual(zh.levelIds);
    // 其他章沒有關卡：levels 是空陣列而不是缺欄位
    const empty = JSON.parse(out.get(manifest.chapters[1]!.files['zh-TW']!.slice('content/'.length))!);
    expect(empty.chapter.levels).toEqual([]);
    expect(empty.levels).toEqual([]);
    // 含草稿模式：草稿關卡接在後面，questionCount 只算快照收進來的題目
    const drafts = buildSnapshot(parsed, acct.compiled, { contentVersion: 1, items: [] }, { includeDrafts: true });
    const draftBundle = JSON.parse(drafts.files.get(drafts.manifest.chapters[0]!.files['zh-TW']!.slice('content/'.length))!);
    const draftChapter = draftBundle.chapter;
    // 章節包的 levels 和摘要同序，草稿關卡也在
    expect(draftBundle.levels.map((l: { level: { id: string } }) => l.level.id)).toEqual(['lv_k7m2q9xd', 'lv_dr4ft000']);
    expect(draftChapter.levels.map((l: { id: string; questionCount: number }) => [l.id, l.questionCount])).toEqual([
      ['lv_k7m2q9xd', 5],
      ['lv_dr4ft000', 0],
    ]);
  });

  it('pick_line 題的 compiled.lines：該報表交易後的可見列、雙語 label 依語系展開、金額來自核心', () => {
    const { choices: _choices, ...q172Base } = q172;
    const pickLine = {
      ...q172Base,
      id: 'q_pk7m1ne0',
      type: 'pick_line',
      scenario: { ...q172.scenario, targets: [] },
      statement: 'bs',
      correctLines: ['bs_cash'],
      prompt: lt('賣出存貨後，現金在資產負債表的哪一列？', 'After the sale, which balance sheet line holds cash?'),
      explanation: lt('現金是流動資產的第一列。', 'Cash is the first current asset line.'),
    };
    const five = [pickLine, qMulti, { ...qMulti, id: 'q_p9k4r7c2' }, { ...qMulti, id: 'q_p9k4r7c3' }, { ...qMulti, id: 'q_p9k4r7c4' }];
    const pickBundle = {
      ...bundleWith(five),
      chapters,
      objectives: files,
      levels: [
        levelFile(
          'lv_k7m2q9xd',
          'ch_n3f8q1',
          five.map((q) => q.id),
        ),
      ],
    };
    expect(validateBundle(pickBundle)).toEqual([]);
    const parsed = parseBundle(pickBundle);
    const acct = runAccountingChecks(parsed, FAST);
    expect(acct.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const compiled = acct.compiled.get('q_pk7m1ne0')!;
    expect(compiled.lines).toBeDefined();
    const cash = compiled.lines!.find((l) => l.id === 'bs_cash')!;
    expect(cash).toEqual({ id: 'bs_cash', label: { 'zh-TW': cash.label['zh-TW'], en: cash.label.en }, value: q172Expected.t1.after });
    expect(typeof cash.label['zh-TW']).toBe('string');
    expect(cash.label.en).toMatch(/cash/i);
    const inventory = compiled.lines!.find((l) => l.id === 'bs_inventory')!;
    expect(inventory.value).toBe(0);
    // 只有該報表的列；合計列標 total，群組標題列標 heading；每個 value 都是安全整數
    expect(compiled.lines!.every((l) => l.id.startsWith('bs_'))).toBe(true);
    expect(compiled.lines!.some((l) => l.total === true)).toBe(true);
    expect(compiled.lines!.every((l) => Number.isSafeInteger(l.value))).toBe(true);
    expect(compiled.lines!.some((l) => l.heading === true && l.total === undefined)).toBe(true);
    // 其他題型沒有 lines；lock 的 answerHash 不含 lines（questionAnswerFields 只取 expected）
    expect(acct.compiled.get('q_p9k4r7cx')?.lines).toBeUndefined();
    const { manifest, files: out } = buildSnapshot(parsed, acct.compiled, { contentVersion: 1, items: [] }, { builtAt: '2026-10-23T00:00:00Z' });
    const zh = JSON.parse(out.get(manifest.levels[0]!.files['zh-TW']!.slice('content/'.length))!).levels[0].questions[0];
    const en = JSON.parse(out.get(manifest.levels[0]!.files.en!.slice('content/'.length))!).levels[0].questions[0];
    expect(zh.compiled.lines.find((l: { id: string }) => l.id === 'bs_cash')).toEqual({
      id: 'bs_cash',
      label: cash.label['zh-TW'],
      value: q172Expected.t1.after,
    });
    expect(en.compiled.lines.find((l: { id: string }) => l.id === 'bs_cash')).toEqual({ id: 'bs_cash', label: cash.label.en, value: q172Expected.t1.after });
    expect(zh.compiled.expected).toEqual({});
  });
});

describe('文字與結構規則（08 第 5.1、5.5、5.7 節）', () => {
  it('純函式：數量提示、字母引用、頁碼樣式、寫死數字', () => {
    expect(hasMultiCountHint('下面哪些會增加現金？請選出兩個。')).toBe(true);
    expect(hasMultiCountHint('Choose two of the following.')).toBe(true);
    expect(hasMultiCountHint('哪些會讓營業活動的現金流量增加？')).toBe(false);
    expect(hasLetterRef('選項 A 是錯的')).toBe(true);
    expect(hasLetterRef('(B) 混淆了收入與現金')).toBe(true);
    expect(hasLetterRef('Option C mixes things up')).toBe(true);
    expect(hasLetterRef('{{option:o_k5p1}}混淆了')).toBe(false);
    expect(hasLetterRef('An answer about cash')).toBe(false);
    expect(sourceRefHit('見第 12 頁')).toBe('第 12 頁');
    expect(sourceRefHit('see p.12 of the notes')).toBe('p.12');
    expect(sourceRefHit('lecture.pdf')).toBe('.pdf');
    expect(sourceRefHit('0-2 的簡化公式')).toBe('0-2');
    expect(sourceRefHit('in the 0-3 slides')).toBe('0-3');
    expect(sourceRefHit('slides02 版的指標')).toBeNull();
    expect(sourceRefHit('2027-01-01 生效')).toBeNull();
    expect(sourceRefHit('p. 的下一步')).toBeNull();
    expect(rawNumberHit('月底才付款 {{money:vars.amount}}')).toBeNull();
    expect(rawNumberHit('月底才付款 260,000 元')).toMatchObject({ why: '帶千分位的數字' });
    expect(rawNumberHit('年利率 5%')).toMatchObject({ why: '緊鄰單位的數字' });
    expect(rawNumberHit('2027 年才到期')).toMatchObject({ why: '4 位數以上的數字' });
    expect(rawNumberHit('{{raw:2027}} 年才到期')).toBeNull();
    expect(rawNumberHit('第 3 步，5 年')).toBeNull();
    expect(rawNumberHit('全形 １２')).toMatchObject({ why: '全形數字' });
  });

  it('runTextChecks：規則代號、嚴重度與位置', () => {
    const bad = {
      ...qMulti,
      prompt: lt('哪兩個會讓營業活動的現金流量增加？選出兩個。', 'Which two increase operating cash flows? Choose two.'),
      explanation: lt('選項 A 是本業收現，見第 3 頁。', 'Option A is cash from operations, see page 3.'),
      options: qMulti.options.map((o, i) => (i === 0 ? { ...o, feedback: lt('收到 1,200 元。', 'You receive 1,200 dollars.') } : o)),
      authorNotes: '取材自 lecture.pdf',
    };
    const parsed = parseBundle({
      ...bundleWith([bad]),
      objectives: [],
      levels: [levelFile('lv_dr4ft000', 'ch_n3f8q1', ['q_p9k4r7cx'], 'draft'), levelFile('lv_pb000000', 'ch_n3f8q1', ['q_p9k4r7cx'])],
    });
    const issues = runTextChecks(parsed);
    const by = (rule: string) => issues.filter((i) => i.rule === rule);
    expect(by('ans.multiCountHint').map((i) => `${i.severity} ${i.path}`)).toEqual(['warning prompt.zh-TW', 'warning prompt.en']);
    expect(
      by('ans.noLetterRefs')
        .map((i) => i.path)
        .sort(),
    ).toEqual(['explanation.en', 'explanation.zh-TW']);
    expect(
      by('style.sourceRefs')
        .map((i) => i.path)
        .sort(),
    ).toEqual(['authorNotes', 'explanation.en', 'explanation.zh-TW']);
    expect(
      by('style.rawNumbers')
        .map((i) => i.path)
        .sort(),
    ).toEqual(['options.0.feedback.en', 'options.0.feedback.zh-TW']);
    expect(by('struct.levelSize').map((i) => `${i.severity} ${i.file}`)).toEqual(['warning content/levels/lv_dr4ft000.json']);
    expect(by('ref.orphan').map((i) => i.file)).toEqual(['content/levels/lv_pb000000.json']);
    expect(issues.every((i) => ['error', 'warning'].includes(i.severity))).toBe(true);
  });

  it('ans.feedbackEveryOption 只對已發布的題目；struct.filename 檢查題目資料夾與檔名', () => {
    const blankFeedback = { ...qMulti, options: qMulti.options.map((o, i) => (i === 2 ? { ...o, feedback: lt(' ', ' ') } : o)) };
    const good = runTextChecks(parseBundle(bundleWith([qMulti])));
    expect(good.filter((i) => i.rule === 'ans.feedbackEveryOption')).toEqual([]);
    const published = runTextChecks(parseBundle(bundleWith([blankFeedback])));
    expect(published.filter((i) => i.rule === 'ans.feedbackEveryOption').map((i) => i.path)).toEqual(['options.2.feedback']);
    const draft = runTextChecks(parseBundle(bundleWith([{ ...blankFeedback, status: 'draft' }])));
    expect(draft.filter((i) => i.rule === 'ans.feedbackEveryOption')).toEqual([]);
    const misplaced = parseBundle({
      ...bundleWith([]),
      questions: [
        { file: 'content/questions/ch_x4d9p2/q_p9k4r7cx.json', data: qMulti },
        { file: 'content/questions/ch_n3f8q1/q_wrong000.json', data: { ...qMulti, id: 'q_p9k4r7c2' } },
      ],
      objectives: [{ file: 'content/objectives/ch_x4d9p2.json', data: { chapterId: 'ch_n3f8q1', items: [objective('obj_5vk2m7', 'ch_n3f8q1', 1)] } }],
    });
    const names = runTextChecks(misplaced).filter((i) => i.rule === 'struct.filename');
    expect(names.map((i) => `${i.file} ${i.path}`)).toEqual([
      'content/questions/ch_x4d9p2/q_p9k4r7cx.json chapterId',
      'content/questions/ch_n3f8q1/q_wrong000.json id',
      'content/objectives/ch_x4d9p2.json chapterId',
    ]);
  });
});
