// 佔位符渲染（05 第 10 節）：把題目文字切成「一般文字」與「佔位符」兩種片段，數值類用 @ledgerland/i18n 的格式化函式換成字串，
// term 與 option 留給呼叫端決定怎麼呈現（Markup.tsx 把 term 做成 TermChip、option 換成選項文字）。純函式，不碰 React 與 DOM。
// 數值 ref 的作用範圍（一般內容）：vars.<name>（題目 vars）、<eventId>.<name>（compiled.values 的 'e1.price'）、expected.<targetId>.<欄位>（compiled.expected；
// ratio_numeric 的 expected.answer 由 compiled.ratio 推出）、數字字面值。
import { PLACEHOLDER_RE } from '@ledgerland/content-schema';
import { formatDate, formatMoney, formatMoneyCompact, formatNumber, formatPercent, formatUnit, type Locale } from '@ledgerland/i18n';
import type { CompiledRatio, QuestionSnapshot } from '../../lib/content.ts';

export type Segment = { kind: 'text'; text: string } | { kind: 'placeholder'; type: string; ref: string; options: string[] };

export interface ValueContext {
  readonly vars?: Readonly<Record<string, number>>;
  /** compiled.values：'e1.price' 這類鍵 */
  readonly values?: Readonly<Record<string, number>>;
  /** compiled.expected：以 target ID 為鍵的答案物件 */
  readonly expected?: Readonly<Record<string, unknown>>;
}

/** ratio_numeric 的答案固定以 target ID `answer` 引用（04 第 16.1 節、第 17 節）：`{{percent:expected.answer.value}}` 取精確值
 *  （0.25 顯示為 25.00%），不是已四捨五入、以百分點表示的 displayValue。快照只存 compiled.ratio（核心 RatioResult 的子集），
 *  所以由 exact 的分數換成數字；正解是 N/A（exact 為 null）時 value 是 null，佔位符解析不到，內容依 04 本來就不該引用它 */
export function ratioAnswerTarget(ratio: CompiledRatio): { value: number | null; status: CompiledRatio['status'] } {
  const exact = ratio.exact;
  if (exact === null) return { value: null, status: ratio.status };
  const num = Number(exact.num);
  const den = Number(exact.den);
  return { value: Number.isFinite(num) && Number.isFinite(den) && den !== 0 ? num / den : null, status: ratio.status };
}

/** 題目快照的佔位符值來源：vars、compiled.values、compiled.expected；ratio_numeric 另把 compiled.ratio 補成 expected.answer
 *  （快照本身已有 answer 時以快照為準） */
export function valueContextOf(q: QuestionSnapshot): ValueContext {
  const ratio = q.type === 'ratio_numeric' ? q.compiled?.ratio : undefined;
  const expected =
    ratio === undefined || q.compiled?.expected?.['answer'] !== undefined
      ? q.compiled?.expected
      : { ...q.compiled?.expected, answer: ratioAnswerTarget(ratio) };
  return {
    ...(q.vars === undefined ? {} : { vars: q.vars }),
    ...(q.compiled?.values === undefined ? {} : { values: q.compiled.values }),
    ...(expected === undefined ? {} : { expected }),
  };
}

export function splitMarkup(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    const index = m.index ?? 0;
    if (index > last) out.push({ kind: 'text', text: text.slice(last, index) });
    out.push({ kind: 'placeholder', type: m[1]!, ref: m[2]!.trim(), options: m[3] ? m[3].split(',').map((o) => o.trim()) : [] });
    last = index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

/** 內容長文的分段（名詞定義等）：空行（\n\n，中間可以有空白）分段，每段去掉前後空白，空段落略過。
 *  段內的單一換行保留給呼叫端（HTML 的 white-space: normal 會當成空白） */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '');
}

/** 解析數值 ref；找不到時回傳 undefined（渲染時留空並由內容驗證器在建置期攔下） */
export function resolveValueRef(ref: string, ctx: ValueContext): number | string | undefined {
  if (/^-?\d+(\.\d+)?$/.test(ref)) return Number(ref);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ref)) return ref;
  if (ref.startsWith('vars.')) return ctx.vars?.[ref.slice('vars.'.length)];
  if (ref.startsWith('expected.')) {
    const [, targetId, field] = ref.split('.');
    if (!targetId || !field) return undefined;
    const target = ctx.expected?.[targetId];
    if (target === null || typeof target !== 'object') return undefined;
    const v = (target as Record<string, unknown>)[field];
    return typeof v === 'number' || typeof v === 'string' ? v : undefined;
  }
  return ctx.values?.[ref];
}

function optionMap(options: readonly string[]): Map<string, string | true> {
  const m = new Map<string, string | true>();
  for (const o of options) {
    const i = o.indexOf('=');
    if (i === -1) m.set(o, true);
    else m.set(o.slice(0, i), o.slice(i + 1));
  }
  return m;
}

/** 數值類佔位符（money、percent、number、date）格式化成字串；值不存在時回傳空字串 */
export function formatValuePlaceholder(type: string, ref: string, options: readonly string[], ctx: ValueContext, locale: Locale): string {
  const raw = resolveValueRef(ref, ctx);
  if (raw === undefined) return '';
  const opts = optionMap(options);
  const sign = opts.has('sign');
  const digitsOpt = opts.get('digits');
  const digits = typeof digitsOpt === 'string' ? Number(digitsOpt) : undefined;
  switch (type) {
    case 'money': {
      if (typeof raw !== 'number') return '';
      if (opts.has('compact') && !sign) return formatMoneyCompact(raw, locale);
      return formatMoney(raw, locale, { sign });
    }
    case 'percent':
      return typeof raw === 'number' ? formatPercent(raw, locale, { ...(digits === undefined ? {} : { digits }), sign }) : '';
    case 'number': {
      if (typeof raw !== 'number') return '';
      const unit = opts.get('unit');
      if (unit === 'day' || unit === 'times' || unit === 'turns') return formatUnit(raw, locale, unit, { ...(digits === undefined ? {} : { digits }), sign });
      return formatNumber(raw, locale, { ...(digits === undefined ? {} : { digits }), sign });
    }
    case 'date': {
      const style = opts.get('style');
      return typeof raw === 'string' ? formatDate(raw, locale, style === 'long' || style === 'medium' ? style : undefined) : '';
    }
    default:
      return '';
  }
}

/** 名詞前面的文字是不是句首：段落開頭、換行之後，或句號、問號、驚嘆號之後（中間可以隔著右引號、右括號與左引號、左括號） */
export function isSentenceStart(before: string): boolean {
  if (/\n[ \t]*$/.test(before)) return true;
  const t = before.replace(/[\s"“‘'([]+$/, '');
  return t === '' || /[.!?]["”’')\]]*$/.test(t);
}

/** 英文句中的名詞（05 第 10 節）：名詞資料的 label 是句首大寫（sentence case），放在句中時把第一個字母轉小寫。
 *  第一個字含其他大寫或不是「大寫加小寫字母」開頭時保留（縮寫與專有寫法：ROA、R&D intensity、DuPont analysis、T-account、P/E ratio）。
 *  只用在英文；中文沒有大小寫，原樣回傳 */
export function inlineTermLabel(label: string, locale: Locale, before: string): string {
  if (locale !== 'en' || isSentenceStart(before)) return label;
  const first = label.split(/\s/, 1)[0] ?? '';
  if (!/^[A-Z][a-z]/.test(first) || /[A-Z]/.test(first.slice(1))) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** 解說引用的選項文字（Markup 的 {{option:…}}）外面由 CSS 加第一層引號（中文「」、英文用英式的 ‘ ’），選項自己帶的引號改成第二層：
 *  中文「」換成『』；英文成對的 ‘ ’ 換成 “ ”（字中間的撇號 ’ 不動，例如 gym’s；選項自己用的 “ ” 本來就是第二層，不動）。
 *  M3 驗收第 6 輪：選項含冒號與逗號時讀者分不出選項在哪裡結束；第 7 輪：英文第一層由 “ ” 改成英式的 ‘ ’ */
export function nestOptionQuotes(text: string, locale: Locale): string {
  return locale === 'en' ? text.replace(/‘((?:[^‘’]|’(?=\p{L}))*)’/gu, '“$1”') : text.replace(/「/g, '『').replace(/」/g, '』');
}

/** 片段在上下文中的純文字代表（判斷名詞是否在句首用）：佔位符一律當成一個一般字元 */
function contextText(s: Segment): string {
  return s.kind === 'text' ? s.text : 'x';
}

export interface PlainRenderers {
  /** 選項 ID 換成該選項的文字（short 優先） */
  readonly option?: (id: string) => string | undefined;
  /** 名詞 ID 換成名詞（介面語言的 label） */
  readonly term?: (id: string) => string | undefined;
}

/** 整段文字渲染成純文字（播報、aria 名稱、單元測試用）；term 與 option 用呼叫端給的函式，沒給就留 ID */
export function renderPlain(text: string, ctx: ValueContext, locale: Locale, renderers: PlainRenderers = {}): string {
  let before = '';
  return splitMarkup(text)
    .map((s) => {
      const prev = before;
      before += contextText(s);
      if (s.kind === 'text') return s.text;
      switch (s.type) {
        case 'money':
        case 'percent':
        case 'number':
        case 'date':
          return formatValuePlaceholder(s.type, s.ref, s.options, ctx, locale);
        case 'option':
          return renderers.option?.(s.ref) ?? s.ref;
        case 'term': {
          const label = renderers.term?.(s.ref);
          return label === undefined ? s.ref : inlineTermLabel(label, locale, prev);
        }
        case 'raw':
        case 'ratio':
        default:
          return s.ref;
      }
    })
    .join('');
}
