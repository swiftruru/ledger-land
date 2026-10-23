// 佔位符渲染（05 第 10 節）：把題目文字切成「一般文字」與「佔位符」兩種片段，數值類用 @ledgerland/i18n 的格式化函式換成字串，
// term 與 option 留給呼叫端決定怎麼呈現（Markup.tsx 把 term 做成 TermChip、option 換成選項文字）。純函式，不碰 React 與 DOM。
// 數值 ref 的作用範圍（一般內容）：vars.<name>（題目 vars）、<eventId>.<name>（compiled.values 的 'e1.price'）、expected.<targetId>.<欄位>（compiled.expected）、數字字面值。
import { PLACEHOLDER_RE } from '@ledgerland/content-schema';
import { formatDate, formatMoney, formatMoneyCompact, formatNumber, formatPercent, formatUnit, type Locale } from '@ledgerland/i18n';

export type Segment = { kind: 'text'; text: string } | { kind: 'placeholder'; type: string; ref: string; options: string[] };

export interface ValueContext {
  readonly vars?: Readonly<Record<string, number>>;
  /** compiled.values：'e1.price' 這類鍵 */
  readonly values?: Readonly<Record<string, number>>;
  /** compiled.expected：以 target ID 為鍵的答案物件 */
  readonly expected?: Readonly<Record<string, unknown>>;
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
      if (unit === 'day' || unit === 'times') return formatUnit(raw, locale, unit, { ...(digits === undefined ? {} : { digits }), sign });
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

export interface PlainRenderers {
  /** 選項 ID 換成該選項的文字（short 優先） */
  readonly option?: (id: string) => string | undefined;
  /** 名詞 ID 換成名詞（介面語言的 label） */
  readonly term?: (id: string) => string | undefined;
}

/** 整段文字渲染成純文字（播報、aria 名稱、單元測試用）；term 與 option 用呼叫端給的函式，沒給就留 ID */
export function renderPlain(text: string, ctx: ValueContext, locale: Locale, renderers: PlainRenderers = {}): string {
  return splitMarkup(text)
    .map((s) => {
      if (s.kind === 'text') return s.text;
      switch (s.type) {
        case 'money':
        case 'percent':
        case 'number':
        case 'date':
          return formatValuePlaceholder(s.type, s.ref, s.options, ctx, locale);
        case 'option':
          return renderers.option?.(s.ref) ?? s.ref;
        case 'term':
          return renderers.term?.(s.ref) ?? s.ref;
        case 'raw':
        case 'ratio':
        default:
          return s.ref;
      }
    })
    .join('');
}
