// 數值佔位符解析得到數字（08 第 5.5 節 ans.placeholderResolves）：題目文字裡的 {{money:…}}、{{percent:…}}、{{number:…}}，
// 依快照的資料（題目 vars、compiled.values、compiled.expected）都要解析得到有限數字，否則畫面會留空。
// packages/content-schema 的 validateBundle 只確認 ref 在作用範圍內（target 存在、vars 有宣告），不知道核心算出了什麼；這裡用
// runAccountingChecks 的 compiled（也就是快照裡原樣寫入的 compiled）重做一次學習端的解析，讓 apps/web 的 placeholders.ts
// 「找不到值時由內容驗證器在建置期攔下」真的成立。
// ratio_numeric 的 expected.answer（04 第 16.1 節）：快照只存 compiled.ratio，學習端的 valueContextOf 由 exact 換成比例補成
// expected.answer.value（0.08 顯示為 8.00%，不用以百分點表示的 displayValue）。這裡用同一套規則；2026-10-24 決定採用這個做法，
// 不另在快照寫入 compiled.expected.answer（04 第 17.3 節的編譯結果範例是邏輯上的形狀，不是快照的實際欄位）。
// 這個模組不讀檔也不列印。
import { parsePlaceholders } from '@ledgerland/content-schema';

const VALUE_TYPES = new Set(['money', 'percent', 'number']);
const NUMBER_LITERAL_RE = /^-?\d+(\.\d+)?$/;
const LOCALE_KEYS = new Set(['zh-TW', 'en']);

/**
 * ratio_numeric 的正解換成數字：exact 的分數相除；正解是 N/A（exact 為 null）時是 null。和 apps/web 的 ratioAnswerTarget 相同。
 * @param {import('./content-rules.mjs').CompiledRatio} ratio
 * @returns {number | null}
 */
export function ratioAnswerValue(ratio) {
  if (ratio.exact === null) return null;
  const num = Number(ratio.exact.num);
  const den = Number(ratio.exact.den);
  return Number.isFinite(num) && Number.isFinite(den) && den !== 0 ? num / den : null;
}

/**
 * 一題的佔位符值來源，形狀與學習端 valueContextOf 相同：快照已有 expected.answer 時以快照為準。
 * @param {any} q 題目資料
 * @param {import('./content-rules.mjs').CompiledQuestion | undefined} compiled
 */
export function placeholderValueContext(q, compiled) {
  const ratio = q.type === 'ratio_numeric' ? compiled?.ratio : undefined;
  const expected =
    ratio === undefined || compiled?.expected?.['answer'] !== undefined
      ? (compiled?.expected ?? {})
      : { ...(compiled?.expected ?? {}), answer: { value: ratioAnswerValue(ratio), status: ratio.status } };
  return { vars: q.vars ?? {}, values: compiled?.values ?? {}, expected };
}

/**
 * 解析一個數值 ref；和 apps/web 的 resolveValueRef 同一套規則。找不到時回傳 undefined。
 * @param {string} ref
 * @param {ReturnType<typeof placeholderValueContext>} ctx
 * @returns {unknown}
 */
export function resolvePlaceholderValue(ref, ctx) {
  if (NUMBER_LITERAL_RE.test(ref)) return Number(ref);
  if (ref.startsWith('vars.')) return ctx.vars[ref.slice('vars.'.length)];
  if (ref.startsWith('expected.')) {
    const [, targetId, field] = ref.split('.');
    if (!targetId || !field) return undefined;
    const target = ctx.expected[targetId];
    if (target === null || typeof target !== 'object') return undefined;
    return /** @type {Record<string, unknown>} */ (target)[field];
  }
  return ctx.values[ref];
}

/** 走訪題目裡所有多語文字欄位（{ "zh-TW": …, "en": … }），回傳 [JSON 路徑, 語系, 文字] */
function* localizedStrings(value, path) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* localizedStrings(value[i], [...path, String(i)]);
    return;
  }
  const keys = Object.keys(value);
  if (keys.length > 0 && keys.every((k) => LOCALE_KEYS.has(k))) {
    for (const k of keys) if (typeof value[k] === 'string') yield [[...path, k].join('.'), k, value[k]];
    return;
  }
  for (const k of keys) yield* localizedStrings(value[k], [...path, k]);
}

/**
 * ans.placeholderResolves：題目文字的數值佔位符都解析得到有限數字。已發布題目是錯誤，草稿是警告（草稿只進本機與 E2E 的快照）。
 * 核心算不出答案的題目（compiled 沒有這一題）略過，那一題已有 acct.* 或 ans.* 的錯誤。
 * @param {import('./content-rules.mjs').Parsed[]} questions
 * @param {Map<string, import('./content-rules.mjs').CompiledQuestion>} compiled
 * @returns {import('./content-rules.mjs').RuleIssue[]}
 */
export function checkPlaceholderValues(questions, compiled) {
  /** @type {import('./content-rules.mjs').RuleIssue[]} */
  const issues = [];
  for (const { file, data: q } of questions) {
    const c = compiled.get(q.id);
    if (c === undefined) continue;
    const ctx = placeholderValueContext(q, c);
    const severity = q.status === 'published' ? 'error' : 'warning';
    for (const [path, , text] of localizedStrings(q, [])) {
      if (!text.includes('{{')) continue;
      for (const p of parsePlaceholders(text)) {
        if (!VALUE_TYPES.has(p.type)) continue;
        const v = resolvePlaceholderValue(p.ref, ctx);
        if (typeof v === 'number' && Number.isFinite(v)) continue;
        const answer = /** @type {{ value?: unknown } | undefined} */ (ctx.expected['answer']);
        const naAnswer = q.type === 'ratio_numeric' && p.ref.startsWith('expected.answer.') && answer?.value === null;
        issues.push({
          rule: 'ans.placeholderResolves',
          file,
          path,
          severity,
          message: naAnswer
            ? `{{${p.type}:${p.ref}}} 解析不到數字：這題的正解是 N/A（exact 為 null），解說不得引用 expected.answer.value（04 第 17.3 節）`
            : `{{${p.type}:${p.ref}}} 依快照的 vars、compiled.values 與 compiled.expected 解析不到數字（${v === undefined ? '找不到這個值' : `值是 ${JSON.stringify(v)}`}），畫面會留空`,
        });
      }
    }
  }
  return issues;
}
