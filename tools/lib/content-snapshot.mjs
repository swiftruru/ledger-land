// content:build 的純函式（08 第 7.3 節、04 第 15.2 節）：把 Zod 通過的內容加核心算出的答案，做成依語系、依章節切分的快照與 content-manifest。
// 草稿不進快照；已下架項目只以墓碑形式出現；authorNotes 不進快照；答案（compiled.expected 等）寫進快照供本機判分（04 第 15.2 節第 9 步）。
// pick_line 題另帶 compiled.lines（該報表 after 狀態的可見列與金額，label 依語系展開）；章節檔另帶 levels（已發布關卡的摘要：id、order、title、objectiveIds、questionCount），
// 讓地圖與章節頁不必為了關卡名稱逐關載入關卡檔。
// 不讀檔也不寫檔：回傳 { manifest, files: Map<相對路徑, JSON 文字> }，content-build.mjs 負責寫到 apps/web/public/content/。
import { createHash } from 'node:crypto';
import { LOCALES } from '@ledgerland/i18n';

export const SNAPSHOT_SCHEMA_VERSION = 1;

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

/** 已發布關卡的摘要（章節檔的 levels）：order 與 title 來自關卡檔，questionCount 只算已發布的題目 */
function levelSummary(level, questionById) {
  return {
    id: level.id,
    order: level.order,
    title: level.title,
    objectiveIds: level.objectiveIds ?? [],
    questionCount: level.questionIds.filter((id) => questionById.has(id)).length,
  };
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
 * @param {{ gitCommit?: string; builtAt?: string; includeDrafts?: boolean }} [meta] includeDrafts：快照連草稿一起收（manifest 標 includesDrafts），
 *   只給本機開發與 E2E；CI 與部署不設
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

  const terms = selectItems(parsed.terms, includeDrafts);
  const chapters = selectItems(parsed.chapters, includeDrafts).sort((a, b) => a.order - b.order);
  const objectives = selectItems(parsed.objectives, includeDrafts);
  const levels = selectItems(parsed.levels, includeDrafts);
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

  const manifest = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    contentVersion: lock.contentVersion ?? 1,
    builtAt: meta.builtAt ?? new Date().toISOString(),
    gitCommit: meta.gitCommit ?? 'unknown',
    ...(includeDrafts ? { includesDrafts: true } : {}),
    locales: Object.fromEntries(LOCALES.map((l) => [l.code, { status: l.status }])),
    // 章節檔：章節本身加該章已發布的學習目標（objectives）；levelIds 只列已發布的關卡，順序依 chapter.levelIds
    chapters: chapters.map((c) => {
      const chapterObjectives = objectives.filter((o) => o.chapterId === c.id).sort((a, b) => a.order - b.order);
      // 含草稿模式：章節還沒把草稿關卡列進 levelIds 時，依 order 接在後面，讓地圖與作答頁看得到
      const listed = c.levelIds.filter((id) => levelById.has(id));
      const unlisted = includeDrafts
        ? levels
            .filter((l) => l.chapterId === c.id && !listed.includes(l.id))
            .sort((a, b) => a.order - b.order)
            .map((l) => l.id)
        : [];
      const levelIds = [...listed, ...unlisted];
      const chapterLevels = levelIds.map((id) => levelSummary(levelById.get(id), questionById));
      return {
        id: c.id,
        order: c.order,
        levelIds,
        files: perLocale(c.id, (locale) => ({
          ...localize(strip(c), locale),
          levelIds,
          levels: chapterLevels.map((l) => localize(l, locale)),
          objectives: chapterObjectives.map((o) => localize(strip(o), locale)),
        })),
      };
    }),
    // 關卡檔：{ level, questions }，questions 依 questionIds 順序，只含已發布的題目，每題帶 answerRev 與 compiled
    levels: levels
      .sort((a, b) => a.chapterId.localeCompare(b.chapterId) || a.order - b.order)
      .map((l) => {
        const questionIds = l.questionIds.filter((id) => questionById.has(id));
        return {
          id: l.id,
          chapterId: l.chapterId,
          order: l.order,
          questionIds,
          files: perLocale(l.id, (locale) => ({
            level: { ...localize(strip(l), locale), questionIds },
            questions: questionIds.map((id) =>
              localize(questionSnapshot(questionById.get(id), compiled.get(id), answerRevOf.get(id) ?? questionById.get(id).rev), locale),
            ),
          })),
        };
      }),
    terms: perLocale('terms', (locale) => terms.map((t) => localize(strip(t), locale))),
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
