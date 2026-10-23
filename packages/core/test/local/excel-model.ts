// 極小的 Excel 公式求值器（只給 *.local.test.ts 用，04 第 18.3 節）。
// 只支援老師檔案用到的子集：數字、字串常數、儲存格參照、跨工作表參照（含單引號包起來的工作表名）、
// 範圍、SUM（範圍與多參數）、IFERROR、四則運算、括號、一元正負號。
// 數值以 bigint 有理數計算，除法結果保留分子分母，不經過浮點數；空白輸入格視為 0（Excel 行為）。
import type { Cell, Sheet, Workbook } from './xlsx.ts';

export interface Rational {
  readonly num: bigint;
  readonly den: bigint;
}

export type EvalResult =
  | { readonly kind: 'number'; readonly value: number; readonly exact: Rational }
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'error'; readonly code: string };

export type SheetResults = Map<string, EvalResult>;
export type WorkbookResults = Map<string, SheetResults>;

// ---------- 有理數 ----------

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

export function rational(num: bigint, den = 1n): Rational {
  if (den === 0n) throw new Error('excel-model：分母為 0 的有理數');
  const sign = den < 0n ? -1n : 1n;
  const g = gcd(num, den);
  const d = g === 0n ? 1n : g;
  return { num: (sign * num) / d, den: (sign * den) / d };
}

export const ZERO: Rational = rational(0n);

export function add(a: Rational, b: Rational): Rational {
  return rational(a.num * b.den + b.num * a.den, a.den * b.den);
}
export function sub(a: Rational, b: Rational): Rational {
  return rational(a.num * b.den - b.num * a.den, a.den * b.den);
}
export function mul(a: Rational, b: Rational): Rational {
  return rational(a.num * b.num, a.den * b.den);
}
/** 回傳 null 表示除以 0 */
export function div(a: Rational, b: Rational): Rational | null {
  if (b.num === 0n) return null;
  return rational(a.num * b.den, a.den * b.num);
}
export function equals(a: Rational, b: Rational): boolean {
  return a.num === b.num && a.den === b.den;
}

/** 十進位字串（整數、小數、科學記號）轉成精確的有理數 */
export function rationalFromDecimal(text: string): Rational {
  const m = text.trim().match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
  if (m === null) throw new Error(`excel-model：無法解析數字「${text}」`);
  const sign = m[1] === '-' ? -1n : 1n;
  const frac = m[3] ?? '';
  let num = BigInt((m[2] as string) + frac) * sign;
  let den = 10n ** BigInt(frac.length);
  const exp = m[4] === undefined ? 0 : Number.parseInt(m[4], 10);
  if (exp > 0) num *= 10n ** BigInt(exp);
  else if (exp < 0) den *= 10n ** BigInt(-exp);
  return rational(num, den);
}

export function rationalFromNumber(n: number): Rational {
  if (!Number.isFinite(n)) throw new Error(`excel-model：${n} 不是有限數`);
  return rationalFromDecimal(n.toString());
}

export function toNumber(r: Rational): number {
  const whole = r.num / r.den;
  const rest = r.num % r.den;
  return Number(whole) + Number(rest) / Number(r.den);
}

export function formatRational(r: Rational): string {
  return r.den === 1n ? r.num.toString() : `${r.num.toString()}/${r.den.toString()}`;
}

// ---------- 公式字串 → token ----------

type Token =
  | { readonly t: 'num'; readonly v: Rational }
  | { readonly t: 'str'; readonly v: string }
  | { readonly t: 'ref'; readonly sheet: string | undefined; readonly from: string; readonly to: string | undefined }
  | { readonly t: 'func'; readonly name: string }
  | { readonly t: 'op'; readonly v: '+' | '-' | '*' | '/' | '(' | ')' | ',' };

const CELL_REF = /^\$?[A-Za-z]{1,3}\$?\d+$/;

function isNameChar(ch: string): boolean {
  return /[\p{L}\p{N}_.$]/u.test(ch);
}

export function tokenise(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const src = formula.startsWith('=') ? formula.slice(1) : formula;
  const readName = (): string => {
    let s = '';
    while (i < src.length && isNameChar(src[i] as string)) s += src[i++];
    return s;
  };
  while (i < src.length) {
    const ch = src[i] as string;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if ('+-*/(),'.includes(ch)) {
      tokens.push({ t: 'op', v: ch as '+' | '-' | '*' | '/' | '(' | ')' | ',' });
      i++;
      continue;
    }
    if (ch === '"') {
      let s = '';
      i++;
      for (;;) {
        if (i >= src.length) throw new Error(`excel-model：字串常數沒有結尾引號：${formula}`);
        if (src[i] === '"') {
          if (src[i + 1] === '"') {
            s += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        s += src[i++];
      }
      tokens.push({ t: 'str', v: s });
      continue;
    }
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(src[i + 1] ?? ''))) {
      const m = src.slice(i).match(/^(\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
      if (m === null) throw new Error(`excel-model：無法解析數字：${formula}`);
      tokens.push({ t: 'num', v: rationalFromDecimal(m[0]) });
      i += m[0].length;
      continue;
    }
    let sheet: string | undefined;
    if (ch === "'") {
      let s = '';
      i++;
      for (;;) {
        if (i >= src.length) throw new Error(`excel-model：工作表名稱沒有結尾引號：${formula}`);
        if (src[i] === "'") {
          if (src[i + 1] === "'") {
            s += "'";
            i += 2;
            continue;
          }
          i++;
          break;
        }
        s += src[i++];
      }
      if (src[i] !== '!') throw new Error(`excel-model：引號工作表名稱後面不是「!」：${formula}`);
      i++;
      sheet = s;
    } else if (isNameChar(ch)) {
      const name = readName();
      if (src[i] === '!') {
        i++;
        sheet = name;
      } else if (src[i] === '(') {
        tokens.push({ t: 'func', name: name.toUpperCase() });
        continue;
      } else {
        if (!CELL_REF.test(name)) throw new Error(`excel-model：不支援的名稱「${name}」：${formula}`);
        let to: string | undefined;
        if (src[i] === ':') {
          i++;
          to = readName();
          if (!CELL_REF.test(to)) throw new Error(`excel-model：範圍結尾「${to}」不是儲存格：${formula}`);
        }
        tokens.push({ t: 'ref', sheet: undefined, from: name, to });
        continue;
      }
    } else {
      throw new Error(`excel-model：不支援的字元「${ch}」：${formula}`);
    }
    // 走到這裡表示已讀到工作表前綴，接著一定是儲存格或範圍
    const from = readName();
    if (!CELL_REF.test(from)) throw new Error(`excel-model：工作表「${sheet}」後面的「${from}」不是儲存格：${formula}`);
    let to: string | undefined;
    if (src[i] === ':') {
      i++;
      to = readName();
      if (!CELL_REF.test(to)) throw new Error(`excel-model：範圍結尾「${to}」不是儲存格：${formula}`);
    }
    tokens.push({ t: 'ref', sheet, from, to });
  }
  return tokens;
}

// ---------- token → AST ----------

export type Node =
  | { readonly kind: 'num'; readonly value: Rational }
  | { readonly kind: 'str'; readonly value: string }
  | { readonly kind: 'ref'; readonly sheet: string | undefined; readonly from: string; readonly to: string | undefined }
  | { readonly kind: 'neg'; readonly arg: Node }
  | { readonly kind: 'bin'; readonly op: '+' | '-' | '*' | '/'; readonly left: Node; readonly right: Node }
  | { readonly kind: 'call'; readonly name: string; readonly args: readonly Node[] };

const SUPPORTED_FUNCTIONS: ReadonlySet<string> = new Set(['SUM', 'IFERROR']);

export function parseFormula(formula: string): Node {
  const tokens = tokenise(formula);
  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];
  const isOp = (v: string): boolean => {
    const t = peek();
    return t !== undefined && t.t === 'op' && t.v === v;
  };
  const expect = (v: string): void => {
    if (!isOp(v)) throw new Error(`excel-model：預期「${v}」：${formula}`);
    pos++;
  };
  const expr = (): Node => {
    let left = term();
    while (isOp('+') || isOp('-')) {
      const op = (tokens[pos++] as { v: '+' | '-' }).v;
      left = { kind: 'bin', op, left, right: term() };
    }
    return left;
  };
  const term = (): Node => {
    let left = unary();
    while (isOp('*') || isOp('/')) {
      const op = (tokens[pos++] as { v: '*' | '/' }).v;
      left = { kind: 'bin', op, left, right: unary() };
    }
    return left;
  };
  const unary = (): Node => {
    if (isOp('-')) {
      pos++;
      return { kind: 'neg', arg: unary() };
    }
    if (isOp('+')) {
      pos++;
      return unary();
    }
    return primary();
  };
  const primary = (): Node => {
    const t = peek();
    if (t === undefined) throw new Error(`excel-model：公式提前結束：${formula}`);
    pos++;
    switch (t.t) {
      case 'num':
        return { kind: 'num', value: t.v };
      case 'str':
        return { kind: 'str', value: t.v };
      case 'ref':
        return { kind: 'ref', sheet: t.sheet, from: t.from, to: t.to };
      case 'func': {
        if (!SUPPORTED_FUNCTIONS.has(t.name)) throw new Error(`excel-model：不支援的函式 ${t.name}：${formula}`);
        expect('(');
        const args: Node[] = [];
        if (!isOp(')')) {
          args.push(expr());
          while (isOp(',')) {
            pos++;
            args.push(expr());
          }
        }
        expect(')');
        return { kind: 'call', name: t.name, args };
      }
      case 'op':
        if (t.v === '(') {
          const inner = expr();
          expect(')');
          return inner;
        }
        throw new Error(`excel-model：此處不能出現「${t.v}」：${formula}`);
    }
  };
  const root = expr();
  if (pos !== tokens.length) throw new Error(`excel-model：公式結尾有多餘的內容：${formula}`);
  return root;
}

// ---------- 儲存格位址 ----------

export function columnIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function columnLetters(index: number): string {
  let s = '';
  let n = index;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = (n - 1 - r) / 26;
  }
  return s;
}

function splitRef(ref: string): { col: number; row: number } {
  const m = ref.replace(/\$/g, '').match(/^([A-Za-z]+)(\d+)$/);
  if (m === null) throw new Error(`excel-model：「${ref}」不是儲存格位址`);
  return { col: columnIndex(m[1] as string), row: Number.parseInt(m[2] as string, 10) };
}

export function expandRange(from: string, to: string): string[] {
  const a = splitRef(from);
  const b = splitRef(to);
  const out: string[] = [];
  for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++) {
    for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) out.push(`${columnLetters(c)}${r}`);
  }
  return out;
}

// ---------- 求值 ----------

type Value =
  | { readonly kind: 'number'; readonly exact: Rational }
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly code: string }
  | { readonly kind: 'range'; readonly items: readonly Value[] };

type Scalar = Exclude<Value, { kind: 'range' } | { kind: 'empty' }>;
const DIV0: Scalar = { kind: 'error', code: '#DIV/0!' };
const VALUE_ERR: Scalar = { kind: 'error', code: '#VALUE!' };

class Evaluator {
  private readonly memo = new Map<string, Value>();
  private readonly visiting = new Set<string>();

  constructor(private readonly book: Workbook) {}

  cell(sheetName: string, ref: string): Value {
    const sheet = this.book.get(sheetName);
    if (sheet === undefined) throw new Error(`excel-model：找不到工作表「${sheetName}」`);
    const cell: Cell | undefined = sheet.get(ref.replace(/\$/g, '').toUpperCase());
    if (cell === undefined) return { kind: 'empty' };
    if (cell.formula !== undefined) {
      const key = `${sheetName}!${ref}`;
      const cached = this.memo.get(key);
      if (cached !== undefined) return cached;
      if (this.visiting.has(key)) throw new Error(`excel-model：${key} 的公式循環參照`);
      this.visiting.add(key);
      const v = this.node(parseFormula(cell.formula), sheetName);
      this.visiting.delete(key);
      this.memo.set(key, v);
      return v;
    }
    return inputValue(cell);
  }

  node(n: Node, sheetName: string): Value {
    switch (n.kind) {
      case 'num':
        return { kind: 'number', exact: n.value };
      case 'str':
        return { kind: 'text', value: n.value };
      case 'ref': {
        const target = n.sheet ?? sheetName;
        if (n.to === undefined) return this.cell(target, n.from);
        return { kind: 'range', items: expandRange(n.from, n.to).map((r) => this.cell(target, r)) };
      }
      case 'neg': {
        const v = toScalar(this.node(n.arg, sheetName));
        if (v.kind !== 'number') return v.kind === 'error' ? v : VALUE_ERR;
        return { kind: 'number', exact: sub(ZERO, v.exact) };
      }
      case 'bin': {
        const l = toScalar(this.node(n.left, sheetName));
        if (l.kind === 'error') return l;
        const r = toScalar(this.node(n.right, sheetName));
        if (r.kind === 'error') return r;
        if (l.kind !== 'number' || r.kind !== 'number') return VALUE_ERR;
        switch (n.op) {
          case '+':
            return { kind: 'number', exact: add(l.exact, r.exact) };
          case '-':
            return { kind: 'number', exact: sub(l.exact, r.exact) };
          case '*':
            return { kind: 'number', exact: mul(l.exact, r.exact) };
          case '/': {
            const q = div(l.exact, r.exact);
            return q === null ? DIV0 : { kind: 'number', exact: q };
          }
        }
        break;
      }
      case 'call':
        return this.call(n, sheetName);
    }
    throw new Error('excel-model：無法到達的節點');
  }

  private call(n: Extract<Node, { kind: 'call' }>, sheetName: string): Value {
    if (n.name === 'SUM') {
      let total = ZERO;
      for (const arg of n.args) {
        const v = this.node(arg, sheetName);
        for (const item of flatten(v)) {
          if (item.kind === 'error') return item;
          // SUM：範圍裡的文字與空白略過；直接給的文字參數在 Excel 會嘗試轉數字，老師的檔案沒有這種用法
          if (item.kind === 'number') total = add(total, item.exact);
          else if (item.kind === 'text' && arg.kind !== 'ref') return VALUE_ERR;
        }
      }
      return { kind: 'number', exact: total };
    }
    if (n.name === 'IFERROR') {
      if (n.args.length !== 2) throw new Error('excel-model：IFERROR 需要兩個參數');
      const first = toScalar(this.node(n.args[0] as Node, sheetName));
      if (first.kind === 'error') return toScalar(this.node(n.args[1] as Node, sheetName));
      return first;
    }
    throw new Error(`excel-model：不支援的函式 ${n.name}`);
  }
}

function inputValue(cell: Cell): Value {
  const v = cell.value;
  if (v === undefined || v === null) return { kind: 'empty' };
  if (typeof v === 'number') return { kind: 'number', exact: rationalFromNumber(v) };
  if (v.startsWith('#')) return { kind: 'error', code: v };
  return { kind: 'text', value: v };
}

function flatten(v: Value): Value[] {
  return v.kind === 'range' ? v.items.flatMap(flatten) : [v];
}

/** 把值當成單一儲存格使用：空白視為 0，範圍不能直接參與運算 */
function toScalar(v: Value): Scalar {
  if (v.kind === 'empty') return { kind: 'number', exact: ZERO };
  if (v.kind === 'range') {
    if (v.items.length === 1) return toScalar(v.items[0] as Value);
    return VALUE_ERR;
  }
  return v;
}

function publish(v: Value): EvalResult {
  const s = toScalar(v);
  if (s.kind === 'number') return { kind: 'number', value: toNumber(s.exact), exact: s.exact };
  if (s.kind === 'text') return { kind: 'text', value: s.value };
  return { kind: 'error', code: s.code };
}

/** 逐一求出工作簿中每個公式格的值 */
export function evaluateWorkbook(book: Workbook): WorkbookResults {
  const ev = new Evaluator(book);
  const out: WorkbookResults = new Map();
  for (const [sheetName, sheet] of book) {
    const results: SheetResults = new Map();
    for (const [ref, cell] of sheet) {
      if (cell.formula === undefined) continue;
      try {
        results.set(ref, publish(ev.cell(sheetName, ref)));
      } catch (e) {
        throw new Error(`excel-model：${sheetName}!${ref} 的公式「${cell.formula}」無法求值：${e instanceof Error ? e.message : String(e)}`, { cause: e });
      }
    }
    out.set(sheetName, results);
  }
  return out;
}

/** 求單一儲存格（公式格重算、輸入格直接取值、空白為 0） */
export function evaluateCell(book: Workbook, sheetName: string, ref: string): EvalResult {
  return publish(new Evaluator(book).cell(sheetName, ref));
}

export interface InputCell {
  readonly ref: string;
  readonly value: number | string;
}

/** 列出工作表中有值的非公式格（輸入格與文字標籤） */
export function inputCells(book: Workbook, sheetName: string): InputCell[] {
  const sheet: Sheet | undefined = book.get(sheetName);
  if (sheet === undefined) throw new Error(`excel-model：找不到工作表「${sheetName}」`);
  const out: InputCell[] = [];
  for (const [ref, cell] of sheet) {
    if (cell.formula !== undefined) continue;
    if (cell.value === undefined || cell.value === null) continue;
    out.push({ ref, value: cell.value });
  }
  return out;
}

/** 列出工作表中的公式格 */
export function formulaCells(book: Workbook, sheetName: string): Array<{ ref: string; formula: string }> {
  const sheet: Sheet | undefined = book.get(sheetName);
  if (sheet === undefined) throw new Error(`excel-model：找不到工作表「${sheetName}」`);
  const out: Array<{ ref: string; formula: string }> = [];
  for (const [ref, cell] of sheet) if (cell.formula !== undefined) out.push({ ref, formula: cell.formula });
  return out;
}
