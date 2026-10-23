// 受控運算式的求值器（04 第 8.4 節）：對節點種類做 switch 的純函式，用 bigint 有理數運算。
// 參照一律從 Map 或查詢函式取值，名稱先以 ident 規則驗證；沒有 eval、new Function 與動態屬性存取。
// 執行期的預期錯誤只有 expr.division_by_zero 與 money.overflow；環境缺值或 AST 與型別不合是程式錯誤，直接 throw。
import {
  type Money,
  type Rat,
  isMoney,
  ratAdd,
  ratCmp,
  ratDiv,
  ratFromDecimalString,
  ratFromInt,
  ratMax,
  ratMin,
  ratMul,
  ratNeg,
  ratRoundHalfAwayFromZero,
  ratSub,
  ratToMoney,
} from '../money.ts';
import { type CoreError, type Result, coreError, err, ok } from '../result.ts';
import { ACCOUNT_ID_RE, type AccountNode, type AnyAst, IDENT_RE, type RefNode, ratioRefOf, refToString } from './ast.ts';

/** 值的來源：Map 或查詢函式；查不到回傳 undefined */
export type Lookup<V> = ReadonlyMap<string, V> | ((name: string) => V | undefined);

export interface EvalEnv {
  readonly param?: Lookup<Rat>;
  readonly derived?: Lookup<Rat>;
  /** 線的期末值 */
  readonly line?: Lookup<Rat>;
  /** 線的期初值；有提供時 avg(line.x) 取期初與期末平均，沒有就回傳期末值並加 single_period_approx 旗標 */
  readonly lineOpening?: Lookup<Rat>;
  readonly input?: Lookup<Rat>;
  /** 以 ratioRef（<id>@<version>）查連鎖指標的值 */
  readonly ratio?: Lookup<Rat>;
  /** 該科目在這個事件之前的正常餘額 */
  readonly balance?: (accountId: string) => Money | undefined;
  /** 該資產科目累計的借方合計（取得成本） */
  readonly cost?: (accountId: string) => Money | undefined;
}

export const FLAG_SINGLE_PERIOD_APPROX = 'single_period_approx';

export interface EvalResult {
  readonly value: Rat | boolean;
  readonly flags: ReadonlySet<string>;
}

class EvalFailure {
  readonly error: CoreError;
  constructor(error: CoreError) {
    this.error = error;
  }
}

function lookup<V>(source: Lookup<V> | undefined, key: string, what: string): V {
  if (source === undefined) throw new Error(`evaluate：環境沒有提供 ${what}，無法取得 ${key}`);
  const v = typeof source === 'function' ? source(key) : source.get(key);
  if (v === undefined) throw new Error(`evaluate：環境缺少 ${what} ${key}`);
  return v;
}

function assertIdent(name: string): void {
  if (!IDENT_RE.test(name)) throw new TypeError(`evaluate：名稱不合 ident 規則 ${JSON.stringify(name)}`);
}

const MONEY_OVERFLOW_HI = BigInt(Number.MAX_SAFE_INTEGER);
const MONEY_OVERFLOW_LO = BigInt(Number.MIN_SAFE_INTEGER);

class Evaluator {
  readonly flags = new Set<string>();
  private readonly env: EvalEnv;
  constructor(env: EvalEnv) {
    this.env = env;
  }

  rat(node: AnyAst): Rat {
    const v = this.value(node);
    if (typeof v === 'boolean') throw new TypeError('evaluate：這裡需要數值，卻得到布林（AST 未經型別檢查）');
    return v;
  }

  bool(node: AnyAst): boolean {
    const v = this.value(node);
    if (typeof v !== 'boolean') throw new TypeError('evaluate：這裡需要布林，卻得到數值（AST 未經型別檢查）');
    return v;
  }

  value(node: AnyAst): Rat | boolean {
    switch (node.type) {
      case 'number':
        return ratFromDecimalString(node.value);
      case 'ref':
        return this.ref(node);
      case 'unary':
        return node.op === '-' ? ratNeg(this.rat(node.operand)) : !this.bool(node.operand);
      case 'binary':
        return this.binary(node.op, node.left, node.right);
      case 'call':
        return this.call(node.fn, node.args);
    }
    throw new TypeError(`evaluate：不認得的節點 ${JSON.stringify(node)}`);
  }

  private ref(node: RefNode): Rat {
    assertIdent(node.name);
    switch (node.ns) {
      case 'param':
        return lookup(this.env.param, node.name, 'param');
      case 'derived':
        return lookup(this.env.derived, node.name, 'derived');
      case 'line':
        return lookup(this.env.line, node.name, 'line');
      case 'input':
        return lookup(this.env.input, node.name, 'input');
      case 'ratio':
        if (node.version === undefined) throw new TypeError(`evaluate：ratio 參照缺少版本 ${refToString(node)}`);
        assertIdent(node.version);
        return lookup(this.env.ratio, ratioRefOf(node), 'ratio');
    }
    throw new TypeError(`evaluate：不認得的命名空間 ${JSON.stringify(node)}`);
  }

  private binary(op: string, leftNode: AnyAst, rightNode: AnyAst): Rat | boolean {
    switch (op) {
      case '&&':
        // 短路：左邊為 false 就不求右邊，右邊的除以 0 不會被回報
        return this.bool(leftNode) ? this.bool(rightNode) : false;
      case '||':
        return this.bool(leftNode) ? true : this.bool(rightNode);
      default:
        break;
    }
    const left = this.rat(leftNode);
    const right = this.rat(rightNode);
    switch (op) {
      case '+':
        return ratAdd(left, right);
      case '-':
        return ratSub(left, right);
      case '*':
        return ratMul(left, right);
      case '/': {
        const r = ratDiv(left, right);
        if (!r.ok) throw new EvalFailure(r.error);
        return r.value;
      }
      case '==':
        return ratCmp(left, right) === 0;
      case '!=':
        return ratCmp(left, right) !== 0;
      case '<':
        return ratCmp(left, right) < 0;
      case '<=':
        return ratCmp(left, right) <= 0;
      case '>':
        return ratCmp(left, right) > 0;
      case '>=':
        return ratCmp(left, right) >= 0;
      default:
        throw new TypeError(`evaluate：不認得的運算子 ${op}`);
    }
  }

  private account(fn: string, args: readonly (AnyAst | AccountNode)[]): string {
    const arg = args[0];
    if (args.length !== 1 || arg === undefined || arg.type !== 'account') throw new TypeError(`evaluate：${fn} 需要一個科目引數`);
    if (!ACCOUNT_ID_RE.test(arg.id)) throw new TypeError(`evaluate：科目 ID 不合規則 ${JSON.stringify(arg.id)}`);
    return arg.id;
  }

  private moneyFromEnv(fn: 'balance' | 'cost', id: string): Rat {
    const f = fn === 'balance' ? this.env.balance : this.env.cost;
    if (f === undefined) throw new Error(`evaluate：環境沒有提供 ${fn}`);
    const m = f(id);
    if (m === undefined || !isMoney(m)) throw new Error(`evaluate：${fn}(${id}) 沒有值或不是安全整數`);
    return ratFromInt(m);
  }

  private valueArgs(fn: string, args: readonly (AnyAst | AccountNode)[]): Rat[] {
    return args.map((a) => {
      if (a.type === 'account') throw new TypeError(`evaluate：${fn} 不接受科目引數`);
      return this.rat(a);
    });
  }

  private call(fn: string, args: readonly (AnyAst | AccountNode)[]): Rat {
    switch (fn) {
      case 'balance':
      case 'cost':
        return this.moneyFromEnv(fn, this.account(fn, args));
      case 'round': {
        const [x] = this.valueArgs(fn, args);
        if (x === undefined || args.length !== 1) throw new TypeError('evaluate：round 需要一個引數');
        const rounded = ratRoundHalfAwayFromZero(x);
        if (rounded.num > MONEY_OVERFLOW_HI || rounded.num < MONEY_OVERFLOW_LO)
          throw new EvalFailure(coreError('money.overflow', { fn, value: rounded.num.toString() }));
        return rounded;
      }
      case 'min':
      case 'max': {
        const xs = this.valueArgs(fn, args);
        const first = xs[0];
        if (first === undefined || xs.length < 2) throw new TypeError(`evaluate：${fn} 至少需要兩個引數`);
        const pick = fn === 'min' ? ratMin : ratMax;
        let acc = first;
        for (let i = 1; i < xs.length; i++) acc = pick(acc, xs[i] as Rat);
        return acc;
      }
      case 'avg': {
        const arg = args[0];
        if (args.length !== 1 || arg === undefined || arg.type !== 'ref' || arg.ns !== 'line') throw new TypeError('evaluate：avg 需要一個 line 參照');
        assertIdent(arg.name);
        const closing = lookup(this.env.line, arg.name, 'line');
        const opening =
          this.env.lineOpening === undefined
            ? undefined
            : typeof this.env.lineOpening === 'function'
              ? this.env.lineOpening(arg.name)
              : this.env.lineOpening.get(arg.name);
        if (opening === undefined) {
          this.flags.add(FLAG_SINGLE_PERIOD_APPROX);
          return closing;
        }
        return ratMul(ratAdd(opening, closing), { num: 1n, den: 2n });
      }
      default:
        throw new TypeError(`evaluate：不認得的函式 ${fn}`);
    }
  }
}

/** 求值；相同的 AST 與環境一定得到相同結果。預期錯誤只有 expr.division_by_zero 與 money.overflow */
export function evaluate(ast: AnyAst, env: EvalEnv): Result<EvalResult, CoreError> {
  const ev = new Evaluator(env);
  try {
    const value = ev.value(ast);
    return ok({ value, flags: ev.flags });
  } catch (e) {
    if (e instanceof EvalFailure) return err(e.error);
    throw e;
  }
}

/** 數值運算式的求值；結果是布林時是程式錯誤 */
export function evaluateRat(ast: AnyAst, env: EvalEnv): Result<{ readonly value: Rat; readonly flags: ReadonlySet<string> }, CoreError> {
  const r = evaluate(ast, env);
  if (!r.ok) return r;
  if (typeof r.value.value === 'boolean') throw new TypeError('evaluateRat：運算式的結果是布林');
  return ok({ value: r.value.value, flags: r.value.flags });
}

/** 金額運算式的求值：結果必須是安全整數，否則 money.not_integer 或 money.overflow */
export function evaluateMoney(ast: AnyAst, env: EvalEnv): Result<{ readonly value: Money; readonly flags: ReadonlySet<string> }, CoreError> {
  const r = evaluateRat(ast, env);
  if (!r.ok) return r;
  const m = ratToMoney(r.value.value);
  if (!m.ok) return m;
  return ok({ value: m.value, flags: r.value.flags });
}

/** 布林運算式（前置條件）的求值；結果是數值時是程式錯誤 */
export function evaluateBool(ast: AnyAst, env: EvalEnv): Result<boolean, CoreError> {
  const r = evaluate(ast, env);
  if (!r.ok) return r;
  if (typeof r.value.value !== 'boolean') throw new TypeError('evaluateBool：運算式的結果不是布林');
  return ok(r.value.value);
}
