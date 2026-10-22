// 內容驗證規則（08 第 5 節的 M0b 子集）：結構、多語系、引用存在、佔位符跨語言一致、ID 不重複。純 TypeScript，不讀檔（讀檔在 tools/）。
import { LOCALE_CODES, type Locale } from '@ledgerland/i18n';
import { z } from 'zod';
import { Chapter } from './chapter.ts';
import { PLACEHOLDER_TYPES, parsePlaceholders, placeholderKey } from './common.ts';
import { Term } from './term.ts';

export interface ContentBundle {
  terms: { file: string; data: unknown }[];
  chapters: { file: string; data: unknown }[];
}

export interface ContentIssue {
  file: string;
  path: string;
  message: string;
}

function zodIssues(file: string, r: z.ZodSafeParseResult<unknown>): ContentIssue[] {
  if (r.success) return [];
  return r.error.issues.map((i) => ({ file, path: i.path.join('.') || '(root)', message: i.message }));
}

/** 走訪物件裡所有 LocalizedText 形狀的欄位，檢查佔位符語法與跨語言一致（05 第 10.5 節第 1、3 條） */
function checkPlaceholders(file: string, value: unknown, path: string[], out: ContentIssue[]): void {
  if (!value || typeof value !== 'object') return;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  const isLocalized = keys.length > 0 && keys.every((k) => (LOCALE_CODES as readonly string[]).includes(k)) && keys.every((k) => typeof obj[k] === 'string');
  if (isLocalized) {
    const sets = new Map<Locale, string[]>();
    for (const k of keys as Locale[]) {
      const phs = parsePlaceholders(obj[k] as string);
      for (const p of phs) {
        if (!(PLACEHOLDER_TYPES as readonly string[]).includes(p.type)) out.push({ file, path: [...path, k].join('.'), message: `未知的佔位符類型 ${p.type}` });
        if (p.options.includes('sign') && !['money', 'percent', 'number'].includes(p.type))
          out.push({ file, path: [...path, k].join('.'), message: 'sign 只能用在 money、percent、number' });
        if (p.options.includes('sign') && p.options.includes('compact')) out.push({ file, path: [...path, k].join('.'), message: 'sign 不能和 compact 並用' });
      }
      sets.set(k, phs.map(placeholderKey).sort());
    }
    const base = sets.get('zh-TW') ?? [];
    for (const [k, s] of sets) {
      if (k === 'zh-TW') continue;
      if (s.join('\n') !== base.join('\n')) out.push({ file, path: [...path, k].join('.'), message: '各語系引用的佔位符集合必須完全相同' });
    }
    return;
  }
  for (const k of keys) checkPlaceholders(file, obj[k], [...path, k], out);
}

export function validateBundle(bundle: ContentBundle): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const termIds = new Set<string>();
  const chapterIds = new Set<string>();
  const terms: Term[] = [];
  const chapters: Chapter[] = [];
  for (const t of bundle.terms) {
    const r = Term.safeParse(t.data);
    issues.push(...zodIssues(t.file, r));
    checkPlaceholders(t.file, t.data, [], issues);
    if (r.success) {
      if (termIds.has(r.data.id)) issues.push({ file: t.file, path: 'id', message: `ID 重複：${r.data.id}` });
      termIds.add(r.data.id);
      terms.push(r.data);
    }
  }
  for (const c of bundle.chapters) {
    const r = Chapter.safeParse(c.data);
    issues.push(...zodIssues(c.file, r));
    checkPlaceholders(c.file, c.data, [], issues);
    if (r.success) {
      if (chapterIds.has(r.data.id)) issues.push({ file: c.file, path: 'id', message: `ID 重複：${r.data.id}` });
      chapterIds.add(r.data.id);
      chapters.push(r.data);
    }
  }
  // 引用存在（08 第 5.3 節）
  for (const t of bundle.terms) {
    const r = Term.safeParse(t.data);
    if (!r.success) continue;
    for (const rel of r.data.related ?? []) if (!termIds.has(rel)) issues.push({ file: t.file, path: 'related', message: `引用不存在的名詞 ${rel}` });
    if (r.data.supersededBy && !termIds.has(r.data.supersededBy))
      issues.push({ file: t.file, path: 'supersededBy', message: `引用不存在的名詞 ${r.data.supersededBy}` });
  }
  for (const c of bundle.chapters) {
    const r = Chapter.safeParse(c.data);
    if (!r.success) continue;
    for (const ref of r.data.termRefs ?? []) if (!termIds.has(ref)) issues.push({ file: c.file, path: 'termRefs', message: `引用不存在的名詞 ${ref}` });
    for (const pre of r.data.prerequisites ?? [])
      if (!chapterIds.has(pre)) issues.push({ file: c.file, path: 'prerequisites', message: `引用不存在的章節 ${pre}` });
  }
  // published 的內容兩種語言都要齊全（08 第 5.2 節）：只檢查 M0b 的最小欄位
  const requireEn = (file: string, name: string, lt: Record<string, string | undefined>) => {
    if (!lt.en) issues.push({ file, path: name, message: 'published 的內容必須有 en 文字' });
  };
  for (const t of terms)
    if (t.status === 'published') {
      requireEn(`term ${t.id}`, 'label.en', t.label);
      requireEn(`term ${t.id}`, 'definition.en', t.definition);
    }
  for (const c of chapters)
    if (c.status === 'published') {
      requireEn(`chapter ${c.id}`, 'title.en', c.title);
      requireEn(`chapter ${c.id}`, 'summary.en', c.summary);
    }
  // 章節順序不重複
  const orders = chapters.map((c) => c.order);
  if (new Set(orders).size !== orders.length) issues.push({ file: '(chapters)', path: 'order', message: '章節的 order 重複' });
  return issues;
}
