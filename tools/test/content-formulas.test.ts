// 會計公式（2026-11-07）：runFormulaChecks 的登錄檔規則、文字規則對 content/formulas 的檔名與教材出處、lock 的 formula 種類、
// buildSnapshot 的 formulaIndex 與 formulaDetails（講義出處與相關題由對照檔換成 hq_ ID，草稿不進、下架成墓碑）。文字都是自己編的。
import { describe, expect, it } from 'vitest';
import { allEntityIds, currentLockItems, normaliseLock, nextLock } from '../lib/content-lock.mjs';
import { parseBundle, runAccountingChecks, runFormulaChecks } from '../lib/content-rules.mjs';
import { buildSnapshot, deckCodeOfVersion, formulaSnapshots } from '../lib/content-snapshot.mjs';
import { runTextChecks } from '../lib/content-text.mjs';
import { bundleWith, term } from './fixtures.ts';

const lt = (zh: string, en = `${zh} (en)`) => ({ 'zh-TW': zh, en });
const formula = (id: string, extra: Record<string, unknown> = {}) => ({
  file: `content/formulas/${id}.json`,
  data: {
    id,
    rev: 1,
    revKind: 'text',
    status: 'published',
    kind: 'ratio',
    termRef: 'tm_f0rm0001',
    ratioRef: 'roe',
    formula: lt('本期淨利 ÷ 股東權益'),
    versions: [{ version: 'slides03', formula: lt('平均權益版'), note: lt('分母用平均') }],
    components: [{ term: 'tm_f0rm0002', meaning: lt('最後賺到的錢') }],
    example: lt('{{money:240000}} ÷ {{money:1200000}} ＝ {{percent:0.2|digits=0}}'),
    reading: lt('越高越好，但要看是不是靠借錢。'),
    ...extra,
  },
});
const ratios = [
  { id: 'roe', category: 'profitability', versions: { excel: {}, slides03: {} } },
  { id: 'roa', category: 'profitability', versions: { excel: {} } },
];
const bundle = (formulas: ReturnType<typeof formula>[]) => ({ ...bundleWith([], { terms: [term('tm_f0rm0001'), term('tm_f0rm0002')] }), formulas });

describe('runFormulaChecks', () => {
  it('ratioRef 要在登錄檔、一個指標只能一條、版本名要是該指標有的；沒有公式的指標是警告', () => {
    const parsed = parseBundle(
      bundle([
        formula('fm_f0rm0001'),
        formula('fm_f0rm0002'),
        formula('fm_f0rm0003', { ratioRef: 'nope', versions: [{ version: 'excel', formula: lt('x') }] }),
      ]),
    );
    const issues = runFormulaChecks(parsed, ratios);
    const text = issues.map((i) => `${i.severity} ${i.rule} ${i.file} ${i.path}`).join('\n');
    expect(text).toContain('error ref.formulaRatioUnique content/formulas/fm_f0rm0002.json ratioRef');
    expect(text).toContain('error ref.ratioExists content/formulas/fm_f0rm0003.json ratioRef');
    expect(text).toContain('warning ref.formulaCoverage (ratios) roa');
    const bad = runFormulaChecks(parseBundle(bundle([formula('fm_f0rm0001', { versions: [{ version: 'slides02', formula: lt('x') }] })])), ratios);
    expect(bad.map((i) => i.rule)).toContain('ref.ratioVersionExists');
    const rel = runFormulaChecks(
      parseBundle(
        bundle([formula('fm_f0rm0001', { kind: 'relation', ratioRef: undefined, category: 'statement', versions: [{ version: 'excel', formula: lt('x') }] })]),
      ),
      ratios,
    );
    expect(rel.filter((i) => i.severity === 'error').map((i) => i.rule)).toEqual(['ref.ratioVersionExists']);
  });
});

describe('文字與結構規則對公式', () => {
  it('檔名要等於 id；任何欄位出現頁碼、講義編號或投影片都擋；數字要用佔位符', () => {
    const parsed = parseBundle({
      ...bundle([
        { ...formula('fm_f0rm0001'), file: 'content/formulas/wrong.json' },
        formula('fm_f0rm0002', { versions: [{ version: 'slides03', formula: lt('x'), note: lt('講義 0-3 第 47 頁的寫法') }] }),
        formula('fm_f0rm0003', { example: lt('240000 ÷ 1200000 ＝ 20%') }),
      ]),
    });
    const rules = runTextChecks(parsed).map((i) => `${i.rule} ${i.file}`);
    expect(rules).toContain('struct.filename content/formulas/wrong.json');
    expect(rules).toContain('style.sourceRefs content/formulas/fm_f0rm0002.json');
    expect(rules).toContain('style.rawNumbers content/formulas/fm_f0rm0003.json');
  });
});

describe('lock 的 formula 種類', () => {
  it('已發布的公式進 lock、沒有 answerHash、排在最後；草稿不進', () => {
    const parsed = parseBundle(bundle([formula('fm_f0rm0001'), formula('fm_f0rm0002', { ratioRef: 'roa', status: 'draft' })]));
    const acct = runAccountingChecks(parsed, { samples: 0 });
    const current = currentLockItems(parsed, acct.compiled);
    expect(current.get('fm_f0rm0001')).toMatchObject({ kind: 'formula', rev: 1, answerRev: 1, optionIds: [] });
    expect(current.get('fm_f0rm0001')).not.toHaveProperty('answerHash');
    expect(current.has('fm_f0rm0002')).toBe(false);
    expect(allEntityIds(parsed).get('fm_f0rm0002')).toEqual({ kind: 'formula', status: 'draft' });
    const lock = nextLock(normaliseLock({ lockVersion: 1, contentVersion: 1, items: [] }), current);
    expect(lock.items.at(-1)?.kind).toBe('formula');
  });
});

describe('快照裡的公式', () => {
  const decks = {
    title: '題庫',
    decks: [
      { id: 'd1', order: 1, code: '0-1', title: '第一份', file: 'one.pptx', sections: [{ id: 'd1s1', title: '段一', slides: [2, 9] }] },
      { id: 'd3', order: 3, code: '0-3', title: '第三份', file: 'three.pptx', sections: [{ id: 'd3s1', title: '段一', slides: [3, 6] }] },
    ],
    exclusions: [],
  };
  const question = (id: string, deck: string, section: string, slide: number) => ({
    id,
    rev: 1,
    revKind: 'text',
    answerRev: 1,
    deck,
    section,
    slide,
    topic: `主題 ${slide}`,
    scenario: '情境。',
    question: '問題？',
    options: [
      { letter: 'A', text: '甲' },
      { letter: 'B', text: '乙' },
      { letter: 'C', text: '丙' },
    ],
    answer: ['B'],
    explanation: '解析。',
    status: 'included',
  });
  const bank = { id: 'midterm', rev: 1, title: '題庫', questions: [question('hq_aaaaaaa1', 'd1', 'd1s1', 3), question('hq_aaaaaaa3', 'd3', 'd3s1', 4)] };
  const handout = {
    decks,
    bank,
    resolvedLinks: [
      {
        formula: 'fm_f0rm0001',
        sources: [
          { deck: 'd1', slides: [1, 5] },
          { deck: 'd3', slides: [2] },
        ],
        questions: { formula: ['hq_aaaaaaa3'], numeric: [], concept: ['hq_aaaaaaa1'] },
      },
    ],
  };
  it('版本名對講義編號', () => {
    expect(deckCodeOfVersion('slides03')).toBe('0-3');
    expect(deckCodeOfVersion('excel')).toBeNull();
    expect(deckCodeOfVersion('dupont')).toBeNull();
  });
  it('索引與完整內容：名稱從名詞取、分類從登錄檔取、版本帶講義、出處與題目換成 hq_ ID 並帶 topic', () => {
    const parsed = parseBundle(bundle([formula('fm_f0rm0001')]));
    const termById = new Map(parsed.terms.map((t) => [t.data.id, t.data]));
    const [snap] = formulaSnapshots(
      parsed.formulas.map((f) => f.data),
      termById,
      handout,
      ratios,
    );
    expect(snap!.index).toMatchObject({
      id: 'fm_f0rm0001',
      kind: 'ratio',
      category: 'profitability',
      termRef: 'tm_f0rm0001',
      ratioRef: 'roe',
      questionIds: ['hq_aaaaaaa3', 'hq_aaaaaaa1'],
    });
    expect(snap!.index.label).toEqual(termById.get('tm_f0rm0001')!.label);
    expect(snap!.detail.versions).toEqual([
      { version: 'slides03', deck: { id: 'd3', code: '0-3', title: '第三份' }, formula: lt('平均權益版'), note: lt('分母用平均') },
    ]);
    expect(snap!.detail.components[0]).toEqual({ term: 'tm_f0rm0002', label: termById.get('tm_f0rm0002')!.label, meaning: lt('最後賺到的錢') });
    expect(snap!.detail.sources).toEqual([
      { id: 'd1', code: '0-1', title: '第一份', slides: [1, 5] },
      { id: 'd3', code: '0-3', title: '第三份', slides: [2] },
    ]);
    expect(snap!.detail.questions).toEqual({
      formula: [{ id: 'hq_aaaaaaa3', deck: 'd3', topic: '主題 4' }],
      numeric: [],
      concept: [{ id: 'hq_aaaaaaa1', deck: 'd1', topic: '主題 3' }],
    });
    // 沒有講義題庫：出處與題目都是空的
    const [bare] = formulaSnapshots(
      parsed.formulas.map((f) => f.data),
      termById,
      null,
      ratios,
    );
    expect(bare!.detail.sources).toEqual([]);
    expect(bare!.index.questionIds).toEqual([]);
  });
  it('buildSnapshot：每個語系一份索引與一份完整內容，草稿不進，下架的成墓碑', () => {
    const parsed = parseBundle(
      bundle([
        formula('fm_f0rm0001'),
        formula('fm_f0rm0002', { ratioRef: 'roa', status: 'draft' }),
        formula('fm_f0rm0003', {
          kind: 'relation',
          ratioRef: undefined,
          category: 'statement',
          status: 'retired',
          versions: undefined,
          retiredNote: lt('併進別條'),
        }),
      ]),
    );
    const acct = runAccountingChecks(parsed, { samples: 0 });
    const { manifest, files, counts } = buildSnapshot(
      parsed,
      acct.compiled,
      { contentVersion: 1, items: [] },
      { builtAt: '2026-11-07T00:00:00Z', handout, ratios },
    );
    expect(counts.formulas).toBe(1);
    const index = JSON.parse(files.get(manifest.formulaIndex['zh-TW'].replace(/^content\//, ''))!);
    expect(index.map((f: { id: string; label: string }) => [f.id, f.label])).toEqual([['fm_f0rm0001', termById(parsed, 'tm_f0rm0001')['zh-TW']]]);
    const details = JSON.parse(files.get(manifest.formulaDetails.en.replace(/^content\//, ''))!);
    expect(details[0].reading).toBe('越高越好，但要看是不是靠借錢。 (en)');
    expect(details[0].versions[0].deck.code).toBe('0-3');
    expect(manifest.formulaIndex['zh-TW']).toMatch(/^content\/zh-TW\/formula-index\.[0-9a-f]{6}\.json$/);
    expect(manifest.formulaDetails['zh-TW']).toMatch(/^content\/zh-TW\/formulas\.[0-9a-f]{6}\.json$/);
    const tombstones = JSON.parse(files.get(manifest.tombstones.replace(/^content\//, ''))!);
    expect(tombstones).toContainEqual({ kind: 'formula', id: 'fm_f0rm0003', retiredNote: lt('併進別條') });
  });
});

function termById(parsed: ReturnType<typeof parseBundle>, id: string): Record<string, string> {
  return parsed.terms.find((t) => t.data.id === id)!.data.label;
}
