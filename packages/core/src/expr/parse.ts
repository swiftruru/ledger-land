// 受控運算式的 parser（04 第 8.1 節的 EBNF）：手寫詞法分析加遞迴下降，沒有 eval、沒有 new Function。
// 只接受白名單內的語法：數字、五個命名空間的參照、六個函式、四則、比較與邏輯。字串、屬性存取、陣列、科學記號、十六進位一律是 expr.parse。
import { type CoreError, type Result, coreError, err, ok } from '../result.ts';
import {
  ACCOUNT_ID_RE,
  type AccountNode,
  type Ast,
  type BinaryOp,
  type ComparisonOp,
  type FunctionName,
  IDENT_RE,
  type Namespace,
  astDepth,
  astNodeCount,
  isFunctionName,
  isNamespace,
} from './ast.ts';

/** 單一運算式的上限（04 第 8.1 節） */
export const EXPR_LIMITS = Object.freeze({ maxLength: 300, maxNodes: 256, maxDepth: 32 });

type Token =
  | { readonly kind: 'number'; readonly text: string; readonly pos: number }
  | { readonly kind: 'ident'; readonly text: string; readonly pos: number }
  | { readonly kind: 'punct'; readonly text: string; readonly pos: number }
  | { readonly kind: 'eof'; readonly text: ''; readonly pos: number };

/** parser 內部的失敗訊號；只在這個模組內 throw 與 catch，對外一律是 Result */
class ParseFailure {
  readonly error: CoreError;
  constructor(error: CoreError) {
    this.error = error;
  }
}

function fail(pos: number, reason: string, found?: string): never {
  const params: Record<string, string | number> = found === undefined ? { at: pos, reason } : { at: pos, reason, found };
  throw new ParseFailure(coreError('expr.parse', params));
}

const isDigit = (c: string): boolean => c >= '0' && c <= '9';
const isIdentStart = (c: string): boolean => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
const isIdentPart = (c: string): boolean => isIdentStart(c) || isDigit(c);
const isSpace = (c: string): boolean => c === ' ' || c === '\t' || c === '\n' || c === '\r';
const TWO_CHAR_PUNCT: readonly string[] = ['&&', '||', '==', '!=', '<=', '>='];
const ONE_CHAR_PUNCT: readonly string[] = ['(', ')', ',', '.', '+', '-', '*', '/', '!', '<', '>'];

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i] as string;
    if (isSpace(c)) {
      i++;
      continue;
    }
    const start = i;
    if (isDigit(c)) {
      while (i < source.length && isDigit(source[i] as string)) i++;
      if (source[i] === '.') {
        i++;
        if (!(i < source.length && isDigit(source[i] as string))) fail(i, 'digit_expected_after_point');
        while (i < source.length && isDigit(source[i] as string)) i++;
      }
      // 數字後面直接接字母、底線或第二個小數點：科學記號、十六進位、1.2.3 都不支援
      if (i < source.length && (isIdentPart(source[i] as string) || source[i] === '.')) fail(i, 'unexpected_after_number', source[i]);
      tokens.push({ kind: 'number', text: source.slice(start, i), pos: start });
      continue;
    }
    if (isIdentStart(c)) {
      while (i < source.length && isIdentPart(source[i] as string)) i++;
      tokens.push({ kind: 'ident', text: source.slice(start, i), pos: start });
      continue;
    }
    const two = source.slice(i, i + 2);
    if (TWO_CHAR_PUNCT.includes(two)) {
      tokens.push({ kind: 'punct', text: two, pos: start });
      i += 2;
      continue;
    }
    if (ONE_CHAR_PUNCT.includes(c)) {
      tokens.push({ kind: 'punct', text: c, pos: start });
      i++;
      continue;
    }
    fail(start, 'unexpected_character', c);
  }
  tokens.push({ kind: 'eof', text: '', pos: source.length });
  return tokens;
}

const CMP_OPS: readonly ComparisonOp[] = ['==', '!=', '<', '<=', '>', '>='];

class Parser {
  private index = 0;
  private readonly tokens: readonly Token[];
  constructor(tokens: readonly Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.index] as Token;
  }
  private next(): Token {
    const t = this.peek();
    if (t.kind !== 'eof') this.index++;
    return t;
  }
  private isPunct(text: string): boolean {
    const t = this.peek();
    return t.kind === 'punct' && t.text === text;
  }
  private expectPunct(text: string): void {
    const t = this.peek();
    if (t.kind !== 'punct' || t.text !== text) fail(t.pos, `expected_${text}`, t.text);
    this.index++;
  }
  private expectIdent(re: RegExp, reason: string): string {
    const t = this.next();
    if (t.kind !== 'ident' || !re.test(t.text)) fail(t.pos, reason, t.text);
    return t.text;
  }

  parseAll(): Ast {
    const ast = this.parseOr();
    const t = this.peek();
    if (t.kind !== 'eof') fail(t.pos, 'unexpected_token', t.text);
    return ast;
  }

  private parseOr(): Ast {
    let left = this.parseAnd();
    while (this.isPunct('||')) {
      this.next();
      left = { type: 'binary', op: '||', left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Ast {
    let left = this.parseCmp();
    while (this.isPunct('&&')) {
      this.next();
      left = { type: 'binary', op: '&&', left, right: this.parseCmp() };
    }
    return left;
  }

  /** 比較不可串接：a < b < c 會在第二個 < 停下，由上層回報 unexpected_token */
  private parseCmp(): Ast {
    const left = this.parseAdd();
    const t = this.peek();
    if (t.kind === 'punct' && (CMP_OPS as readonly string[]).includes(t.text)) {
      this.next();
      return { type: 'binary', op: t.text as ComparisonOp, left, right: this.parseAdd() };
    }
    return left;
  }

  private parseAdd(): Ast {
    let left = this.parseMul();
    while (this.isPunct('+') || this.isPunct('-')) {
      const op = this.next().text as BinaryOp;
      left = { type: 'binary', op, left, right: this.parseMul() };
    }
    return left;
  }

  private parseMul(): Ast {
    let left = this.parseUnary();
    while (this.isPunct('*') || this.isPunct('/')) {
      const op = this.next().text as BinaryOp;
      left = { type: 'binary', op, left, right: this.parseUnary() };
    }
    return left;
  }

  /** EBNF 只允許一個前置運算子；--x 或 -!x 要寫成 -(-x) */
  private parseUnary(): Ast {
    if (this.isPunct('-') || this.isPunct('!')) {
      const op = this.next().text as '-' | '!';
      return { type: 'unary', op, operand: this.parsePrimary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Ast {
    const t = this.peek();
    if (t.kind === 'number') {
      this.next();
      return { type: 'number', value: t.text };
    }
    if (t.kind === 'punct' && t.text === '(') {
      this.next();
      const inner = this.parseOr();
      this.expectPunct(')');
      return inner;
    }
    if (t.kind === 'ident') {
      this.next();
      if (isNamespace(t.text)) return this.parseRef(t.text);
      if (isFunctionName(t.text)) return this.parseCall(t.text, t.pos);
      // 其他識別字（foo、constructor、__proto__、true）都不在白名單
      return fail(t.pos, 'unknown_identifier', t.text);
    }
    return fail(t.pos, 'primary_expected', t.text);
  }

  private parseRef(ns: Namespace): Ast {
    if (!this.isPunct('.')) fail(this.peek().pos, 'namespace_requires_member', ns);
    this.next();
    const name = this.expectIdent(IDENT_RE, 'invalid_ident');
    if (ns === 'ratio') {
      // ratio 參照固定三段：ratio.<id>.<version>
      if (!this.isPunct('.')) fail(this.peek().pos, 'ratio_requires_version', `${ns}.${name}`);
      this.next();
      const version = this.expectIdent(IDENT_RE, 'invalid_ident');
      if (this.isPunct('.')) fail(this.peek().pos, 'too_many_segments', `${ns}.${name}.${version}`);
      return { type: 'ref', ns, name, version };
    }
    if (this.isPunct('.')) fail(this.peek().pos, 'too_many_segments', `${ns}.${name}`);
    return { type: 'ref', ns, name };
  }

  private parseCall(fn: FunctionName, pos: number): Ast {
    if (!this.isPunct('(')) fail(this.peek().pos, 'function_requires_call', fn);
    this.next();
    if (fn === 'balance' || fn === 'cost') {
      const id = this.expectIdent(ACCOUNT_ID_RE, 'invalid_account_id');
      this.expectPunct(')');
      const account: AccountNode = { type: 'account', id };
      return { type: 'call', fn, args: [account] };
    }
    const args: Ast[] = [];
    if (!this.isPunct(')')) {
      args.push(this.parseOr());
      while (this.isPunct(',')) {
        this.next();
        args.push(this.parseOr());
      }
    }
    this.expectPunct(')');
    const arity = fn === 'round' || fn === 'avg' ? { min: 1, max: 1 } : { min: 2, max: Number.POSITIVE_INFINITY };
    if (args.length < arity.min || args.length > arity.max) fail(pos, 'wrong_arity', `${fn}/${args.length}`);
    return { type: 'call', fn, args };
  }
}

/** 解析成未標型別的 AST；超過長度、節點數或深度上限回傳 expr.limit，語法不合回傳 expr.parse */
export function parseExpr(source: string): Result<Ast, CoreError> {
  if (typeof source !== 'string') throw new TypeError('parseExpr：source 必須是字串');
  if (source.length > EXPR_LIMITS.maxLength) return err(coreError('expr.limit', { limit: 'length', max: EXPR_LIMITS.maxLength, actual: source.length }));
  let ast: Ast;
  try {
    ast = new Parser(tokenize(source)).parseAll();
  } catch (e) {
    if (e instanceof ParseFailure) return err(e.error);
    throw e;
  }
  const nodes = astNodeCount(ast);
  if (nodes > EXPR_LIMITS.maxNodes) return err(coreError('expr.limit', { limit: 'nodes', max: EXPR_LIMITS.maxNodes, actual: nodes }));
  const depth = astDepth(ast);
  if (depth > EXPR_LIMITS.maxDepth) return err(coreError('expr.limit', { limit: 'depth', max: EXPR_LIMITS.maxDepth, actual: depth }));
  return ok(ast);
}
