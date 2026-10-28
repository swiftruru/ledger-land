// content:build 的純函式（08 第 7.3 節、04 第 15.2 節）：把 Zod 通過的內容加核心算出的答案，做成依語系、依章節切分的快照與 content-manifest。
// 草稿不進快照；已下架項目只以墓碑形式出現；authorNotes 不進快照；答案（compiled.expected 等）寫進快照供本機判分（04 第 15.2 節第 9 步）。
// pick_line 題另帶 compiled.lines（該報表 after 狀態的可見列與金額，label 依語系展開）；章節檔的 chapter 另帶 levels（已發布關卡的摘要：id、order、title、objectiveIds、questionCount），
// 讓地圖與章節頁不必為了關卡名稱逐關載入關卡。manifest 的 chapters 另帶 scope 與 examScope（M3，T32），地圖不必載入章節檔就能標示「不在期中考範圍」。
// 章節檔是一章一檔的「章節包」（schemaVersion 3，2026-10-29）：{ chapter, levels }，chapter 是章節本身加學習目標與關卡摘要，levels 是該章每一關的 { level, questions }，
// 依 chapter.levelIds 的順序，章節漏列但已發布的關卡接在後面。關卡不再各自一檔：Workbox 的 precache 是一個項目一個項目抓的，47 關乘兩種語言就是 94 趟往返，
// 併進章節檔後一章一趟（06 第 3.2 節）。manifest.levels[].files 指向所屬章節的檔，學習端讀章節包再取關卡（apps/web/src/lib/content.ts 的 loadLevel）。
// 章節的 notices（例如 not_investment_advice，2026-10-24 決定 4）在章節檔、章節索引與 manifest 的章節摘要都帶：用代號或 QR 直接進關卡的作答頁只讀 manifest 就能標「非投資建議」。
// 全部是 judgment 的關卡（延伸章 E03）在關卡檔的 level、章節檔的 levels 摘要與 manifest.levels 都標 unscored: true：沒有星星，結果頁與地圖顯示「已讀完」而不是星等。
// 名詞檔每個名詞另帶 firstLevel（03 第 2.10 節：第一個 termRefs 含該名詞的已發布關卡與其章節），名詞圖鑑用它顯示「在哪一關會遇到」；沒有任何關卡用到時省略。
// 名詞分兩層（schemaVersion 2，2026-10-24）：每個語系一份小的名詞索引（termIndex：關卡、名詞 chip、圖鑑列表與搜尋要的欄位，見 TERM_INDEX_FIELDS），
// 加上依名詞 ID 分桶的完整內容檔（termDetails）；學習端由 ID 就算得出要讀哪一桶，不必先讀索引（06 第 8.2 節的 LCP 預算）。
// 桶數從「ID 最後一個字元一桶」（最多 32 桶、每桶約 5 個名詞）改成固定 8 桶（schemaVersion 3，2026-10-29，每桶約 20 個名詞、約 11 KB gzip），同樣是為了 precache 的項目數（兩種語言從 64 項變 16 項）。
// 名詞索引另帶 element（站規 1.11.4，2026-10-25）：科目類名詞以 accountRef 查核心科目表（packages/core/data/accounts.json）的會計要素，名詞卡不必載入完整內容就能畫要素徽記；
// 查不到時省略，卡片退回中性的類別徽記。這是建置時算出的衍生欄位，內容檔不新增欄位。
// 章節同理另有每個語系一份章節索引（chapterIndex：全部章節的標題、摘要、徽章、關卡摘要與學習目標的敘述），地圖與名詞圖鑑讀一檔就好；每章的章節包照舊輸出。
// 關卡只收所屬章節也進快照的（2026-10-25）：草稿章節裡已發布的關卡（連同只在那一關的題目）不進正式快照；已發布章節漏列的關卡照舊收（content:check 另有警告）。
// 不讀檔也不寫檔：回傳 { manifest, files: Map<相對路徑, JSON 文字> }，content-build.mjs 負責寫到 apps/web/public/content/。
import { createHash } from 'node:crypto';
import { defaultAccounts } from '@ledgerland/core';
import { LOCALES } from '@ledgerland/i18n';
import { isUnscoredLevel } from './content-schema-bridge.mjs';

export const SNAPSHOT_SCHEMA_VERSION = 3;

/** 名詞索引收的欄位（08 第 7.3 節）：作答頁的名詞 chip 與科目、指標名稱（accountRef、ratioRef），圖鑑的列表、分組（firstLevel、unlock）與搜尋（各種名稱與兩種語言的別名），
 *  名詞卡收合時的標題列（label、teacherLabel、currentTwLabel、ifrsEnglish、flags），名詞卡的類別與要素徽記（category、element，站規 1.11.4）。
 *  定義、例子、常見誤解、IFRS 說明、相關名詞等長文只在完整內容檔 */
export const TERM_INDEX_FIELDS = Object.freeze([
  'id',
  'category',
  'label',
  'teacherLabel',
  'currentTwLabel',
  'ifrsEnglish',
  'aliases',
  'flags',
  'accountRef',
  'element',
  'ratioRef',
  'firstLevel',
  'unlock',
]);

/** 章節索引收的欄位（08 第 7.3 節）；objectives 另外只留 id、order、statement */
export const CHAPTER_INDEX_FIELDS = Object.freeze([
  'id',
  'order',
  'scope',
  'examScope',
  'kind',
  'notices',
  'title',
  'summary',
  'levelIds',
  'badge',
  'levels',
  'chapterEndLinks',
]);

/** 完整內容檔的桶數（schemaVersion 3）：每桶約 20 個名詞；改桶數就是改快照格式，學習端、殼層與 E2E 的同名常數都要跟著改 */
export const TERM_DETAIL_BUCKETS = 8;
/** 完整內容檔的分桶：名詞 ID 最後一個字元的字元碼除以桶數的餘數（'0' 到 '7'）。
 *  學習端 apps/web/src/lib/content.ts 的 termDetailBucket、殼層 apps/web/src/shell/boot.js 的預先載入與 E2E 的 apps/web/e2e/glossary-data.ts 必須一致 */
export const termDetailBucket = (id) => String(id.charCodeAt(id.length - 1) % TERM_DETAIL_BUCKETS);

/** 依語系取出 LocalizedText 的單一文字；正式快照只放已發布的內容，所以 en 一定存在（缺字時退回 zh-TW，只會發生在預覽） */
export function localize(value, locale) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length && keys.every((k) => LOCALES.some((l) => l.code === k)) && keys.every((k) => typeof value[k] === 'string'))
      return value[locale] ?? value['zh-TW'];
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localize(v, locale)]));
  }
  if (Array.isArray(value)) return value.map((v) => localize(v, locale));
  return value;
}
const strip = ({ authorNotes: _a, ...rest }) => rest;
const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 6);
/** 正式快照只收已發布的項目；含草稿模式（LL_INCLUDE_DRAFTS=1，只給本機開發與 E2E）另收 draft，已下架的仍只以墓碑出現 */
const selectItems = (list, includeDrafts) =>
  list.filter((x) => x.data.status === 'published' || (includeDrafts && x.data.status === 'draft')).map((x) => x.data);

/** 關卡進快照的題目（只算快照收進來的） */
const levelQuestions = (level, questionById) => level.questionIds.filter((id) => questionById.has(id)).map((id) => questionById.get(id));
/** 全 judgment 關卡的旗標：有就是 { unscored: true }，其餘不帶欄位 */
const unscoredFlag = (level, questionById) => (isUnscoredLevel(levelQuestions(level, questionById)) ? { unscored: true } : {});

/** 已發布關卡的摘要（章節檔的 levels）：order 與 title 來自關卡檔，questionCount 只算已發布的題目；全 judgment 關卡帶 unscored: true */
function levelSummary(level, questionById) {
  return {
    id: level.id,
    order: level.order,
    title: level.title,
    objectiveIds: level.objectiveIds ?? [],
    questionCount: levelQuestions(level, questionById).length,
    ...unscoredFlag(level, questionById),
  };
}

/**
 * 每個名詞第一次出現的關卡（03 第 2.10 節「在哪一關會遇到」）：依章節 order、章節 levelIds 的順序、關卡 questionIds 的順序，
 * 找第一個 termRefs 含該名詞的題目所在的關卡。只看進快照的章節、關卡與題目（正式快照是已發布的；含草稿模式連草稿一起算）。
 * @param {{ id: string; levelIds: string[] }[]} chapters 已依 order 排序，levelIds 是快照實際列出的關卡
 * @param {Map<string, { chapterId: string; questionIds: string[] }>} levelById
 * @param {Map<string, { termRefs?: string[] }>} questionById
 * @returns {Map<string, { levelId: string; chapterId: string }>}
 */
export function firstLevelByTerm(chapters, levelById, questionById) {
  /** @type {Map<string, { levelId: string; chapterId: string }>} */
  const out = new Map();
  for (const c of chapters) {
    for (const levelId of c.levelIds) {
      const level = levelById.get(levelId);
      if (level === undefined) continue;
      for (const qid of level.questionIds) {
        const q = questionById.get(qid);
        for (const term of q?.termRefs ?? []) if (!out.has(term)) out.set(term, { levelId, chapterId: c.id });
      }
    }
  }
  return out;
}

/** 題目進快照的形狀：去掉 authorNotes 與作者填的 scenario.expected，加上 answerRev 與核心算出的 compiled */
function questionSnapshot(q, compiled, answerRev) {
  const base = strip(q);
  const out = /** @type {Record<string, any>} */ ({ ...base, answerRev });
  if ('scenario' in base && base.scenario && base.scenario.expected !== undefined) {
    const { expected: _e, ...scenario } = base.scenario;
    out.scenario = scenario;
  }
  if (compiled !== undefined && Object.keys(compiled).length > 0) out.compiled = compiled; // 作者題（選擇、是非）沒有核心答案，不帶 compiled
  return out;
}

/**
 * @param {import('./content-rules.mjs').ParsedBundle} parsed Zod 通過的內容（validateBundle 應已無錯誤）
 * @param {Map<string, import('./content-rules.mjs').CompiledQuestion>} compiled runAccountingChecks 的結果
 * @param {{ contentVersion?: number; items?: { id: string; answerRev?: number; rev: number }[] }} lock published.lock.json
 * @param {{ gitCommit?: string; builtAt?: string; includeDrafts?: boolean; accounts?: readonly { id: string; element: string }[] }} [meta] includeDrafts：快照連草稿一起收（manifest 標 includesDrafts），
 *   只給本機開發與 E2E；CI 與部署不設。accounts：查名詞要素用的科目表，預設是核心內建的科目表（測試可以換）
 */
export function buildSnapshot(parsed, compiled, lock, meta = {}) {
  const includeDrafts = meta.includeDrafts === true;
  /** @type {Map<string, string>} */
  const files = new Map();
  const write = (locale, name, data) => {
    const text = JSON.stringify(data);
    const file = `${name}.${hash(text)}.json`;
    files.set(`${locale}/${file}`, text);
    return `content/${locale}/${file}`;
  };
  const perLocale = (name, make) => Object.fromEntries(LOCALES.map((l) => [l.code, write(l.code, name, make(l.code))]));
  const answerRevOf = new Map((lock.items ?? []).map((i) => [i.id, i.answerRev ?? i.rev]));
  /** @type {readonly { id: string; element: string }[]} */
  const accounts = meta.accounts ?? defaultAccounts;
  const elementOfAccount = new Map(accounts.map((a) => /** @type {[string, string]} */ ([a.id, a.element])));

  const terms = selectItems(parsed.terms, includeDrafts);
  const chapters = selectItems(parsed.chapters, includeDrafts).sort((a, b) => a.order - b.order);
  const objectives = selectItems(parsed.objectives, includeDrafts);
  // 關卡只收所屬章節也進快照的（core-4）：草稿章節裡先標成已發布的關卡不提早公開；這是最後一道防線，驗證端也應以 ref.publishedClosure 擋下
  const chapterIds = new Set(chapters.map((c) => c.id));
  const levels = selectItems(parsed.levels, includeDrafts).filter((l) => chapterIds.has(l.chapterId));
  const questions = selectItems(parsed.questions, includeDrafts);
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const levelById = new Map(levels.map((l) => [l.id, l]));
  const tombstones = [
    ...parsed.terms.map((x) => ({ kind: 'term', ...x.data })),
    ...parsed.chapters.map((x) => ({ kind: 'chapter', ...x.data })),
    ...parsed.objectives.map((x) => ({ kind: 'objective', ...x.data })),
    ...parsed.levels.map((x) => ({ kind: 'level', ...x.data })),
    ...parsed.questions.map((x) => ({ kind: 'question', ...x.data })),
    ...parsed.stories.map((x) => ({ kind: 'story', ...x.data })),
  ]
    .filter((x) => x.status === 'retired')
    .map((x) => ({ kind: x.kind, id: x.id, supersededBy: x.supersededBy, retiredNote: x.retiredNote }));

  // 每章實際列出的關卡：已發布且在 chapter.levelIds 裡的；含草稿模式另把章節還沒列進 levelIds 的草稿關卡依 order 接在後面，讓地圖與作答頁看得到
  const chapterLevelIds = chapters.map((c) => {
    const listed = c.levelIds.filter((id) => levelById.has(id));
    const unlisted = includeDrafts
      ? levels
          .filter((l) => l.chapterId === c.id && !listed.includes(l.id))
          .sort((a, b) => a.order - b.order)
          .map((l) => l.id)
      : [];
    return { chapter: c, levelIds: [...listed, ...unlisted] };
  });
  const firstLevel = firstLevelByTerm(
    chapterLevelIds.map(({ chapter: c, levelIds }) => ({ id: c.id, levelIds })),
    levelById,
    questionById,
  );
  // 名詞的衍生欄位：firstLevel（第一個用到的關卡）與 element（科目類名詞的會計要素）；算不出來的就不帶欄位
  const termSnapshot = (t) => {
    const first = firstLevel.get(t.id);
    const element = t.category === 'account' && t.accountRef !== undefined ? elementOfAccount.get(t.accountRef) : undefined;
    return { ...strip(t), ...(element === undefined ? {} : { element }), ...(first === undefined ? {} : { firstLevel: first }) };
  };

  // 章節檔的內容（依語系）：章節本身加該章已發布的學習目標與關卡摘要；章節索引（chapterIndex）由同一份資料摘出
  const chapterFileData = chapterLevelIds.map(({ chapter: c, levelIds }) => {
    const chapterObjectives = objectives.filter((o) => o.chapterId === c.id).sort((a, b) => a.order - b.order);
    const chapterLevels = levelIds.map((id) => levelSummary(levelById.get(id), questionById));
    return {
      chapter: c,
      levelIds,
      data: (locale) => ({
        ...localize(strip(c), locale),
        levelIds,
        levels: chapterLevels.map((l) => localize(l, locale)),
        objectives: chapterObjectives.map((o) => localize(strip(o), locale)),
      }),
    };
  });

  // 關卡進快照的形狀：{ level, questions }，questions 依 questionIds 順序，只含已發布的題目，每題帶 answerRev 與 compiled
  const levelSnapshot = (l, locale) => {
    const questionIds = l.questionIds.filter((id) => questionById.has(id));
    const flag = unscoredFlag(l, questionById);
    return {
      level: { ...localize(strip(l), locale), questionIds, ...flag },
      questions: questionIds.map((id) =>
        localize(questionSnapshot(questionById.get(id), compiled.get(id), answerRevOf.get(id) ?? questionById.get(id).rev), locale),
      ),
    };
  };
  // 章節包（一章一檔）：chapter 加該章每一關的快照。順序依 chapter.levelIds（含草稿模式接在後面的草稿關卡）；已發布章節漏列的關卡（content:check 有警告）
  // 不在 levelIds 裡但仍進快照，依 order 接在最後，manifest.levels 才找得到它的檔
  const chapterFiles = new Map(
    chapterFileData.map(({ chapter: c, levelIds, data }) => {
      const unlisted = levels.filter((l) => l.chapterId === c.id && !levelIds.includes(l.id)).sort((a, b) => a.order - b.order);
      const bundleLevels = [...levelIds.map((id) => levelById.get(id)), ...unlisted];
      return [c.id, perLocale(c.id, (locale) => ({ chapter: data(locale), levels: bundleLevels.map((l) => levelSnapshot(l, locale)) }))];
    }),
  );

  const manifest = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    contentVersion: lock.contentVersion ?? 1,
    builtAt: meta.builtAt ?? new Date().toISOString(),
    gitCommit: meta.gitCommit ?? 'unknown',
    ...(includeDrafts ? { includesDrafts: true } : {}),
    locales: Object.fromEntries(LOCALES.map((l) => [l.code, { status: l.status }])),
    // 章節包：{ chapter, levels }，chapter 是章節本身加該章已發布的學習目標（objectives）；levelIds 只列已發布的關卡，順序依 chapter.levelIds；
    // scope 與 examScope 同時放進 manifest，地圖與章節列表不必載入章節檔就能標示「不在期中考範圍」（T32）；notices 同理（作答頁的「非投資建議」）
    chapters: chapterFileData.map(({ chapter: c, levelIds }) => ({
      id: c.id,
      order: c.order,
      scope: c.scope,
      examScope: c.examScope,
      ...(c.kind === undefined ? {} : { kind: c.kind }),
      ...(c.notices === undefined ? {} : { notices: c.notices }),
      levelIds,
      files: chapterFiles.get(c.id),
    })),
    // 章節索引（schemaVersion 2，2026-10-24）：每個語系一檔、依 order 排列，只放地圖、章節頁、名詞圖鑑與徽章要的欄位（CHAPTER_INDEX_FIELDS，
    // 學習目標只留 id、order、statement）；地圖第一次繪製讀一檔就好，不必讀每一章的章節檔（06 第 8.2 節）
    chapterIndex: perLocale('chapter-index', (locale) =>
      chapterFileData.map(({ data }) => {
        const full = data(locale);
        const picked = Object.fromEntries(CHAPTER_INDEX_FIELDS.filter((k) => full[k] !== undefined).map((k) => [k, full[k]]));
        return { ...picked, objectives: full.objectives.map((o) => ({ id: o.id, order: o.order, statement: o.statement })) };
      }),
    ),
    // 關卡：files 指向所屬章節的章節包（schemaVersion 3 起關卡不另成檔），學習端讀章節包再依 level.id 取關卡
    levels: levels
      .sort((a, b) => a.chapterId.localeCompare(b.chapterId) || a.order - b.order)
      .map((l) => ({
        id: l.id,
        chapterId: l.chapterId,
        order: l.order,
        questionIds: l.questionIds.filter((id) => questionById.has(id)),
        ...unscoredFlag(l, questionById),
        files: chapterFiles.get(l.chapterId),
      })),
    // 名詞兩層：索引（每語系一檔）與依 ID 分桶的完整內容（termDetailBucket，8 桶；manifest 只列實際有名詞的桶）
    termIndex: perLocale('term-index', (locale) =>
      terms.map((t) => {
        const full = localize(termSnapshot(t), locale);
        return Object.fromEntries(TERM_INDEX_FIELDS.filter((k) => full[k] !== undefined).map((k) => [k, full[k]]));
      }),
    ),
    termDetails: (() => {
      const buckets = new Map();
      for (const t of [...terms].sort((a, b) => a.id.localeCompare(b.id))) {
        const b = termDetailBucket(t.id);
        if (!buckets.has(b)) buckets.set(b, []);
        buckets.get(b).push(t);
      }
      const keys = [...buckets.keys()].sort();
      return Object.fromEntries(
        LOCALES.map((l) => [
          l.code,
          Object.fromEntries(
            keys.map((b) => [
              b,
              write(
                l.code,
                `terms-${b}`,
                buckets.get(b).map((t) => localize(termSnapshot(t), l.code)),
              ),
            ]),
          ),
        ]),
      );
    })(),
    templates: {},
    stories: [],
    tombstones: (() => {
      const text = JSON.stringify(tombstones);
      const file = `tombstones.${hash(text)}.json`;
      files.set(file, text);
      return `content/${file}`;
    })(),
  };
  return {
    manifest,
    files,
    counts: { chapters: chapters.length, objectives: objectives.length, levels: levels.length, questions: questions.length, terms: terms.length },
  };
}
