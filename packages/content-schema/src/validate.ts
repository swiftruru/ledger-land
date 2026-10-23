// 內容驗證規則（08 第 5 節的 M1 子集）：結構、多語系、引用存在、佔位符語法與作用範圍、ID 不重複、章節範圍。
// 純 TypeScript，不讀檔（讀檔在 tools/）。會計語意（借貸平衡、線是否存在於版面、方向歧義）由核心的 content:compile 檢查。
import { LOCALE_CODES, type Locale } from '@ledgerland/i18n';
import { z } from 'zod';
import { Chapter } from './chapter.ts';
import { EVENT_ID_RE, PLACEHOLDER_TYPES, RATIO_REF_RE, idPattern, parsePlaceholders, placeholderKey } from './common.ts';
import { Question, questionScope } from './question.ts';
import { Story } from './story.ts';
import { TransactionTemplate } from './template.ts';
import { Term } from './term.ts';

export interface ContentEntry {
  file: string;
  data: unknown;
}

export interface ContentBundle {
  terms: ContentEntry[];
  chapters: ContentEntry[];
  /** M1 起選填：交易範本、故事、題目（content/ 還沒有時可以省略） */
  templates?: ContentEntry[];
  stories?: ContentEntry[];
  questions?: ContentEntry[];
}

export interface ContentIssue {
  file: string;
  path: string;
  message: string;
}

/** 佔位符的作用範圍（05 第 10.1 節）：undefined 的集合代表這類內容沒有這種來源可引用 */
export interface PlaceholderScope {
  /** template 範圍另可用 param.、derived.（只有範本的 summary 與 explanation） */
  kind: 'general' | 'template';
  vars?: ReadonlySet<string>;
  eventIds?: ReadonlySet<string>;
  targetIds?: ReadonlySet<string>;
  params?: ReadonlySet<string>;
  derived?: ReadonlySet<string>;
  optionIds?: ReadonlySet<string>;
}

type ScopeResolver = (path: string[]) => PlaceholderScope;
const NO_SCOPE: PlaceholderScope = { kind: 'general' };
const NUMBER_LITERAL_RE = /^\d+(\.\d+)?$/;

function zodIssues(file: string, r: z.ZodSafeParseResult<unknown>): ContentIssue[] {
  if (r.success) return [];
  return r.error.issues.map((i) => ({ file, path: i.path.join('.') || '(root)', message: i.message }));
}

/** 數值類佔位符（money、percent、number、date）的 ref 是否在作用範圍內（05 第 10.5 節第 2 條） */
function checkValueRef(ref: string, scope: PlaceholderScope): string | null {
  if (NUMBER_LITERAL_RE.test(ref)) return null;
  if (ref === 'amount') return 'amount 只能用在核心 effects 的片語樣板';
  const [head, ...rest] = ref.split('.');
  const name = rest.join('.');
  if (head === 'param' || head === 'derived') {
    if (scope.kind !== 'template') return `${head}.* 只能用在交易範本的 summary 與 explanation，一般內容請改用事件參照（例如 e1.${name}）`;
    const declared = head === 'param' ? scope.params : scope.derived;
    if (!declared?.has(name)) return `引用未宣告的 ${ref}`;
    return null;
  }
  if (head === 'vars') {
    if (!scope.vars) return '這類內容沒有 vars 可引用';
    if (!scope.vars.has(name)) return `引用未宣告的 ${ref}`;
    return null;
  }
  if (head === 'expected') {
    const [targetId, field] = rest;
    if (!scope.targetIds) return '這類內容沒有 target 可引用';
    if (!targetId || !field) return 'expected 的寫法是 expected.<targetId>.<欄位>';
    if (!scope.targetIds.has(targetId)) return `引用不存在的 target ${targetId}`;
    return null;
  }
  if (head && EVENT_ID_RE.test(head)) {
    if (!scope.eventIds) return '這類內容沒有事件可引用';
    if (!scope.eventIds.has(head)) return `引用不存在的事件 ${head}`;
    if (!name) return '事件參照的寫法是 <事件 ID>.<參數或推導值>';
    return null;
  }
  return `無法辨識的數值參照 ${ref}`;
}

interface CheckContext {
  termIds: ReadonlySet<string>;
}

/** 走訪物件裡所有 LocalizedText 形狀的欄位，檢查佔位符語法、作用範圍、引用與跨語言一致（05 第 10.5 節第 1 到 3 條） */
function checkPlaceholders(file: string, value: unknown, path: string[], out: ContentIssue[], ctx: CheckContext, resolve?: ScopeResolver): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => checkPlaceholders(file, v, [...path, String(i)], out, ctx, resolve));
    return;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  const isLocalized = keys.length > 0 && keys.every((k) => (LOCALE_CODES as readonly string[]).includes(k)) && keys.every((k) => typeof obj[k] === 'string');
  if (!isLocalized) {
    for (const k of keys) checkPlaceholders(file, obj[k], [...path, k], out, ctx, resolve);
    return;
  }
  const scope = resolve?.(path);
  const sets = new Map<Locale, string[]>();
  for (const k of keys as Locale[]) {
    const fieldPath = [...path, k].join('.');
    const push = (message: string) => out.push({ file, path: fieldPath, message });
    const phs = parsePlaceholders(obj[k] as string);
    for (const p of phs) {
      if (!(PLACEHOLDER_TYPES as readonly string[]).includes(p.type)) {
        push(`未知的佔位符類型 ${p.type}`);
        continue;
      }
      if (p.options.includes('sign') && !['money', 'percent', 'number'].includes(p.type)) push('sign 只能用在 money、percent、number');
      if (p.options.includes('sign') && p.options.includes('compact')) push('sign 不能和 compact 並用');
      switch (p.type) {
        case 'money':
        case 'percent':
        case 'number':
        case 'date': {
          if (!scope) break;
          const err = checkValueRef(p.ref, scope);
          if (err) push(`佔位符 ${p.ref}：${err}`);
          break;
        }
        case 'term':
          if (!idPattern('term').test(p.ref)) push(`term 佔位符的 ref 必須是名詞 ID：${p.ref}`);
          else if (!ctx.termIds.has(p.ref)) push(`引用不存在的名詞 ${p.ref}`);
          break;
        case 'option':
          if (!scope) break;
          if (!scope.optionIds) push('這類內容沒有選項可引用');
          else if (!scope.optionIds.has(p.ref)) push(`引用不存在的選項 ${p.ref}`);
          break;
        case 'ratio':
          if (!RATIO_REF_RE.test(p.ref)) push(`ratio 佔位符的 ref 寫成指標 ID 加 @ 加版本：${p.ref}`);
          break;
        default:
          break;
      }
    }
    sets.set(k, phs.map(placeholderKey).sort());
  }
  const base = sets.get('zh-TW') ?? [];
  for (const [k, s] of sets) {
    if (k === 'zh-TW') continue;
    if (s.join('\n') !== base.join('\n')) out.push({ file, path: [...path, k].join('.'), message: '各語系引用的佔位符集合必須完全相同' });
  }
}

/** published 的內容兩種語言都要齊全（08 第 5.2 節）：走訪所有 LocalizedText 形狀的欄位 */
function requireEnEverywhere(file: string, value: unknown, path: string[], out: ContentIssue[]): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => requireEnEverywhere(file, v, [...path, String(i)], out));
    return;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  const isLocalized = keys.length > 0 && keys.every((k) => (LOCALE_CODES as readonly string[]).includes(k)) && keys.every((k) => typeof obj[k] === 'string');
  if (isLocalized) {
    if (!obj.en) out.push({ file, path: [...path, 'en'].join('.'), message: 'published 的內容必須有 en 文字' });
    return;
  }
  for (const k of keys) requireEnEverywhere(file, obj[k], [...path, k], out);
}

function parseAll<T>(entries: ContentEntry[] | undefined, schema: z.ZodType<T>, issues: ContentIssue[], label: string): { file: string; data: T }[] {
  const out: { file: string; data: T }[] = [];
  const ids = new Set<string>();
  for (const e of entries ?? []) {
    const r = schema.safeParse(e.data);
    issues.push(...zodIssues(e.file, r));
    if (!r.success) continue;
    const id = (r.data as { id: string }).id;
    if (ids.has(id)) issues.push({ file: e.file, path: 'id', message: `${label}ID 重複：${id}` });
    ids.add(id);
    out.push({ file: e.file, data: r.data });
  }
  return out;
}

export function validateBundle(bundle: ContentBundle): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const terms = parseAll(bundle.terms, Term, issues, '');
  const chapters = parseAll(bundle.chapters, Chapter, issues, '');
  const templates = parseAll(bundle.templates, TransactionTemplate, issues, '範本 ');
  const stories = parseAll(bundle.stories, Story, issues, '故事 ');
  const questions = parseAll(bundle.questions, Question, issues, '題目 ');

  const termIds = new Set(terms.map((t) => t.data.id));
  const chapterIds = new Set(chapters.map((c) => c.data.id));
  const chapterById = new Map(chapters.map((c) => [c.data.id, c.data]));
  const templateIds = new Set(templates.map((t) => t.data.id));
  const storyIds = new Set(stories.map((s) => s.data.id));
  const stepOwner = new Map<string, string>();
  const questionIds = new Set(questions.map((q) => q.data.id));
  const ctx: CheckContext = { termIds };
  const checkTemplateRef = bundle.templates !== undefined;

  // 佔位符（結構失敗的檔案只檢查語法與跨語言，不檢查作用範圍）
  const parsedFiles = new Set([...terms, ...chapters, ...templates, ...stories, ...questions].map((x) => x.file));
  for (const e of [...bundle.terms, ...bundle.chapters, ...(bundle.templates ?? []), ...(bundle.stories ?? []), ...(bundle.questions ?? [])]) {
    if (!parsedFiles.has(e.file)) checkPlaceholders(e.file, e.data, [], issues, ctx);
  }
  for (const t of terms) checkPlaceholders(t.file, t.data, [], issues, ctx, () => NO_SCOPE);
  for (const c of chapters) checkPlaceholders(c.file, c.data, [], issues, ctx, () => NO_SCOPE);
  for (const t of templates) {
    const templateScope: PlaceholderScope = {
      kind: 'template',
      params: new Set(t.data.params.map((p) => p.name)),
      derived: new Set(t.data.derived.map((d) => d.name)),
    };
    checkPlaceholders(t.file, t.data, [], issues, ctx, (path) => (path[0] === 'summary' || path[0] === 'explanation' ? templateScope : NO_SCOPE));
  }
  for (const s of stories) {
    const stepScopes = s.data.steps.map<PlaceholderScope>((step) => ({
      kind: 'general',
      eventIds: new Set(step.events.map((e) => e.id)),
      targetIds: new Set((step.predictTargets ?? []).map((t) => t.id)),
    }));
    checkPlaceholders(s.file, s.data, [], issues, ctx, (path) =>
      path[0] === 'steps' && path[1] !== undefined ? (stepScopes[Number(path[1])] ?? NO_SCOPE) : NO_SCOPE,
    );
  }
  for (const q of questions) {
    const scope: PlaceholderScope = { kind: 'general', ...questionScope(q.data) };
    checkPlaceholders(q.file, q.data, [], issues, ctx, () => scope);
  }

  // 引用存在（08 第 5.3 節）
  const need = (file: string, path: string, ok: boolean, message: string) => {
    if (!ok) issues.push({ file, path, message });
  };
  for (const t of terms) {
    for (const rel of t.data.related ?? []) need(t.file, 'related', termIds.has(rel), `引用不存在的名詞 ${rel}`);
    if (t.data.supersededBy) need(t.file, 'supersededBy', termIds.has(t.data.supersededBy), `引用不存在的名詞 ${t.data.supersededBy}`);
  }
  for (const c of chapters) {
    for (const ref of c.data.termRefs ?? []) need(c.file, 'termRefs', termIds.has(ref), `引用不存在的名詞 ${ref}`);
    for (const pre of c.data.prerequisites ?? []) need(c.file, 'prerequisites', chapterIds.has(pre), `引用不存在的章節 ${pre}`);
  }
  for (const t of templates) {
    for (const ref of t.data.termRefs) need(t.file, 'termRefs', termIds.has(ref), `引用不存在的名詞 ${ref}`);
    if (t.data.supersededBy) need(t.file, 'supersededBy', templateIds.has(t.data.supersededBy), `引用不存在的範本 ${t.data.supersededBy}`);
  }
  for (const s of stories) {
    if (s.data.supersededBy) need(s.file, 'supersededBy', storyIds.has(s.data.supersededBy), `引用不存在的故事 ${s.data.supersededBy}`);
    s.data.steps.forEach((step, i) => {
      const p = `steps.${i}`;
      if (stepOwner.has(step.id))
        issues.push({ file: s.file, path: `${p}.id`, message: `步驟 ID 已在故事 ${stepOwner.get(step.id)} 使用：${step.id}（步驟 ID 全站唯一）` });
      stepOwner.set(step.id, s.data.id);
      for (const ref of step.termRefs) need(s.file, `${p}.termRefs`, termIds.has(ref), `引用不存在的名詞 ${ref}`);
      for (const link of step.chapterLinks ?? []) need(s.file, `${p}.chapterLinks`, chapterIds.has(link.chapter), `引用不存在的章節 ${link.chapter}`);
      if (checkTemplateRef)
        step.events.forEach((e, j) => need(s.file, `${p}.events.${j}.template`, templateIds.has(e.template), `引用不存在的範本 ${e.template}`));
    });
  }
  for (const q of questions) {
    const d = q.data;
    need(q.file, 'chapterId', chapterIds.has(d.chapterId), `引用不存在的章節 ${d.chapterId}`);
    for (const ref of d.termRefs) need(q.file, 'termRefs', termIds.has(ref), `引用不存在的名詞 ${ref}`);
    if (d.supersededBy) need(q.file, 'supersededBy', questionIds.has(d.supersededBy), `引用不存在的題目 ${d.supersededBy}`);
    if (d.labRef) {
      need(q.file, 'labRef.story', storyIds.has(d.labRef.story), `引用不存在的故事 ${d.labRef.story}`);
      if (storyIds.has(d.labRef.story))
        need(q.file, 'labRef.step', stepOwner.get(d.labRef.step) === d.labRef.story, `步驟 ${d.labRef.step} 不屬於故事 ${d.labRef.story}`);
    }
    const scenario = 'scenario' in d ? d.scenario : d.type === 'ratio_numeric' ? d.compute.scenario : undefined;
    const scenarioPath = d.type === 'ratio_numeric' ? 'compute.scenario' : 'scenario';
    if (scenario) {
      if ('storyRef' in scenario.opening) {
        const { storyRef, afterStep } = scenario.opening;
        need(q.file, `${scenarioPath}.opening.storyRef`, storyIds.has(storyRef), `引用不存在的故事 ${storyRef}`);
        if (storyIds.has(storyRef))
          need(q.file, `${scenarioPath}.opening.afterStep`, stepOwner.get(afterStep) === storyRef, `步驟 ${afterStep} 不屬於故事 ${storyRef}`);
      }
      if (checkTemplateRef)
        scenario.events.forEach((e, j) => need(q.file, `${scenarioPath}.events.${j}.template`, templateIds.has(e.template), `引用不存在的範本 ${e.template}`));
      if (d.type === 'journal_entry') {
        scenario.events.forEach((e, j) => {
          const tpl = templates.find((t) => t.data.id === e.template)?.data;
          if (tpl && tpl.entryQuestionBlockedBy && tpl.entryQuestionBlockedBy.length > 0)
            issues.push({
              file: q.file,
              path: `${scenarioPath}.events.${j}.template`,
              message: `範本 ${e.template} 的 entryQuestionBlockedBy 非空，不得用來出分錄題`,
            });
        });
      }
    }
    // 分錄題只能放在「借貸與分錄」延伸章（D1）
    if (d.type === 'journal_entry') {
      const ch = chapterById.get(d.chapterId);
      if (ch && ch.scope !== 'extension')
        issues.push({
          file: q.file,
          path: 'chapterId',
          message: `journal_entry 只能放在 scope 為 extension 的延伸章，章節 ${d.chapterId} 的 scope 是 ${ch.scope}`,
        });
    }
  }

  // published 的內容兩種語言都要齊全（08 第 5.2 節）：名詞與章節維持 M0b 的最小欄位，新實體走訪所有多語欄位
  const requireEn = (file: string, name: string, lt: Record<string, string | undefined>) => {
    if (!lt.en) issues.push({ file, path: name, message: 'published 的內容必須有 en 文字' });
  };
  for (const t of terms)
    if (t.data.status === 'published') {
      requireEn(`term ${t.data.id}`, 'label.en', t.data.label);
      requireEn(`term ${t.data.id}`, 'definition.en', t.data.definition);
    }
  for (const c of chapters)
    if (c.data.status === 'published') {
      requireEn(`chapter ${c.data.id}`, 'title.en', c.data.title);
      requireEn(`chapter ${c.data.id}`, 'summary.en', c.data.summary);
    }
  for (const x of [...templates, ...stories, ...questions]) if (x.data.status === 'published') requireEnEverywhere(x.file, x.data, [], issues);

  // 章節順序不重複
  const orders = chapters.map((c) => c.data.order);
  if (new Set(orders).size !== orders.length) issues.push({ file: '(chapters)', path: 'order', message: '章節的 order 重複' });
  return issues;
}
