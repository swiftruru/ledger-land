// 受控運算式的型別檢查（04 第 8.2 節各情境可用的參照與函式、第 8.3 節型別規則）。
// 輸入是 parseExpr 的未標型別 AST 與宣告表；輸出是每個值節點都帶 valueType 的 TypedAst。
// 宣告表只用 Map 與 Set（不用物件），名稱先經 parser 的 ident 規則驗證，所以查不到就是真的沒宣告。
import { type CoreError, type Result, coreError, err, ok } from '../result.ts';
import {
  type AccountNode,
  type Ast,
  type FunctionName,
  type Namespace,
  type NumericType,
  type RefNode,
  type TypedAst,
  type ValueType,
  ratioRefOf,
  refToString,
} from './ast.ts';
import { parseExpr } from './parse.ts';

/** 運算式的使用位置（04 第 8.2 節的五列） */
export type ExprScope = 'template_derived' | 'template_line_amount' | 'precondition' | 'ratio_formula' | 'layout_formula';
export const EXPR_SCOPES: readonly ExprScope[] = ['template_derived', 'template_line_amount', 'precondition', 'ratio_formula', 'layout_formula'];

/** 呼叫端要求的結果型別；int 不滿足時回 expr.round_required，bool 不滿足時回 expr.type */
export type ExpectedType = ValueType | 'any';

/** 這個位置看得到的名稱：param 與 derived 帶型別（money 對應 int、number 對應 rat），其餘只要存在。derived 只應傳入先宣告的那些 */
export interface DeclaredRefs {
  readonly params?: ReadonlyMap<string, NumericType>;
  readonly derived?: ReadonlyMap<string, NumericType>;
  readonly accounts?: ReadonlySet<string>;
  readonly lines?: ReadonlySet<string>;
  readonly inputs?: ReadonlySet<string>;
  /** ratioRef 的集合：<id>@<version> */
  readonly ratios?: ReadonlySet<string>;
}

interface ScopeRule {
  readonly namespaces: ReadonlySet<Namespace>;
  readonly functions: ReadonlySet<FunctionName>;
  /** 比較、&&、||、! 只有前置條件可用 */
  readonly logic: boolean;
  /** 這個位置本身要求的結果型別；呼叫端的 expected 可以再收緊 */
  readonly result: ExpectedType;
}

const SCOPE_RULES: ReadonlyMap<ExprScope, ScopeRule> = new Map<ExprScope, ScopeRule>([
  [
    'template_derived',
    { namespaces: new Set(['param', 'derived']), functions: new Set(['balance', 'cost', 'round', 'min', 'max']), logic: false, result: 'any' },
  ],
  ['template_line_amount', { namespaces: new Set(['param', 'derived']), functions: new Set(['balance', 'cost', 'min', 'max']), logic: false, result: 'int' }],
  ['precondition', { namespaces: new Set(['param', 'derived']), functions: new Set(['balance', 'cost', 'round', 'min', 'max']), logic: true, result: 'bool' }],
  ['ratio_formula', { namespaces: new Set(['line', 'input', 'ratio']), functions: new Set(['avg', 'min', 'max']), logic: false, result: 'rat' }],
  ['layout_formula', { namespaces: new Set(['line']), functions: new Set(), logic: false, result: 'int' }],
]);

class TypeFailure {
  readonly error: CoreError;
  constructor(error: CoreError) {
    this.error = error;
  }
}
function fail(error: CoreError): never {
  throw new TypeFailure(error);
}

const isNumeric = (t: ValueType): boolean => t !== 'bool';
const wider = (a: NumericType, b: NumericType): NumericType => (a === 'rat' || b === 'rat' ? 'rat' : 'int');

function requireNumeric(node: TypedAst, where: string): NumericType {
  if (!isNumeric(node.valueType)) fail(coreError('expr.type', { reason: 'numeric_expected', where, actual: node.valueType }));
  return node.valueType as NumericType;
}
function requireBool(node: TypedAst, where: string): void {
  if (node.valueType !== 'bool') fail(coreError('expr.type', { reason: 'bool_expected', where, actual: node.valueType }));
}

class Checker {
  private readonly scope: ExprScope;
  private readonly rule: ScopeRule;
  private readonly declared: DeclaredRefs;
  constructor(scope: ExprScope, rule: ScopeRule, declared: DeclaredRefs) {
    this.scope = scope;
    this.rule = rule;
    this.declared = declared;
  }

  check(node: Ast): TypedAst {
    switch (node.type) {
      case 'number':
        return { ...node, valueType: node.value.includes('.') ? 'rat' : 'int' };
      case 'ref':
        return { ...node, valueType: this.refType(node) };
      case 'unary': {
        const operand = this.check(node.operand);
        if (node.op === '-') return { type: 'unary', op: '-', operand, valueType: requireNumeric(operand, 'unary -') };
        this.requireLogic('!');
        requireBool(operand, '!');
        return { type: 'unary', op: '!', operand, valueType: 'bool' };
      }
      case 'binary': {
        const left = this.check(node.left);
        const right = this.check(node.right);
        switch (node.op) {
          case '+':
          case '-':
          case '*': {
            const l = requireNumeric(left, node.op);
            const r = requireNumeric(right, node.op);
            return { type: 'binary', op: node.op, left, right, valueType: wider(l, r) };
          }
          case '/':
            requireNumeric(left, '/');
            requireNumeric(right, '/');
            return { type: 'binary', op: '/', left, right, valueType: 'rat' };
          case '==':
          case '!=':
          case '<':
          case '<=':
          case '>':
          case '>=':
            this.requireLogic(node.op);
            requireNumeric(left, node.op);
            requireNumeric(right, node.op);
            return { type: 'binary', op: node.op, left, right, valueType: 'bool' };
          case '&&':
          case '||':
            this.requireLogic(node.op);
            requireBool(left, node.op);
            requireBool(right, node.op);
            return { type: 'binary', op: node.op, left, right, valueType: 'bool' };
        }
        break;
      }
      case 'call':
        return this.call(node.fn, node.args);
    }
    // 只有格式不對的 AST 會到這裡（程式錯誤）
    throw new TypeError(`typecheck：不認得的節點 ${JSON.stringify(node)}`);
  }

  private requireLogic(op: string): void {
    if (!this.rule.logic) fail(coreError('expr.type', { reason: 'logic_not_allowed', op, scope: this.scope }));
  }

  private refType(node: RefNode): ValueType {
    const ref = refToString(node);
    if (!this.rule.namespaces.has(node.ns)) fail(coreError('expr.unknown_ref', { ref, reason: 'namespace_not_allowed', scope: this.scope }));
    const d = this.declared;
    switch (node.ns) {
      case 'param': {
        const t = d.params?.get(node.name);
        if (t === undefined) fail(coreError('expr.unknown_ref', { ref, reason: 'not_declared' }));
        return t;
      }
      case 'derived': {
        const t = d.derived?.get(node.name);
        if (t === undefined) fail(coreError('expr.unknown_ref', { ref, reason: 'not_declared' }));
        return t;
      }
      case 'line':
        if (!d.lines?.has(node.name)) fail(coreError('expr.unknown_ref', { ref, reason: 'not_declared' }));
        return 'int';
      case 'input':
        if (!d.inputs?.has(node.name)) fail(coreError('expr.unknown_ref', { ref, reason: 'not_declared' }));
        return 'rat';
      case 'ratio':
        if (!d.ratios?.has(ratioRefOf(node))) fail(coreError('expr.unknown_ref', { ref, reason: 'not_declared' }));
        return 'rat';
    }
  }

  private call(fn: FunctionName, args: readonly (Ast | AccountNode)[]): TypedAst {
    if (!this.rule.functions.has(fn)) fail(coreError('expr.unknown_function', { fn, scope: this.scope }));
    if (fn === 'balance' || fn === 'cost') {
      const arg = args[0];
      if (args.length !== 1 || arg === undefined || arg.type !== 'account') fail(coreError('expr.type', { reason: 'account_expected', fn }));
      if (!this.declared.accounts?.has(arg.id)) fail(coreError('expr.unknown_account', { account: arg.id, fn }));
      return { type: 'call', fn, args: [arg], valueType: 'int' };
    }
    const typedArgs: TypedAst[] = args.map((a) => {
      if (a.type === 'account') fail(coreError('expr.type', { reason: 'value_expected', fn }));
      return this.check(a);
    });
    switch (fn) {
      case 'round': {
        const arg = typedArgs[0];
        if (typedArgs.length !== 1 || arg === undefined) fail(coreError('expr.type', { reason: 'wrong_arity', fn, actual: typedArgs.length }));
        requireNumeric(arg, fn);
        return { type: 'call', fn, args: typedArgs, valueType: 'int' };
      }
      case 'avg': {
        const arg = typedArgs[0];
        if (typedArgs.length !== 1 || arg === undefined) fail(coreError('expr.type', { reason: 'wrong_arity', fn, actual: typedArgs.length }));
        if (arg.type !== 'ref' || arg.ns !== 'line') fail(coreError('expr.type', { reason: 'avg_requires_line_ref', fn }));
        return { type: 'call', fn, args: typedArgs, valueType: 'rat' };
      }
      case 'min':
      case 'max': {
        if (typedArgs.length < 2) fail(coreError('expr.type', { reason: 'wrong_arity', fn, actual: typedArgs.length }));
        let t: NumericType = 'int';
        for (const a of typedArgs) t = wider(t, requireNumeric(a, fn));
        return { type: 'call', fn, args: typedArgs, valueType: t };
      }
    }
  }
}

/** 結果型別的檢查：int 不滿足是 expr.round_required（要加 round），其他不滿足是 expr.type */
function checkExpected(actual: ValueType, expected: ExpectedType, scope: ExprScope): CoreError | undefined {
  if (expected === 'any' || actual === expected) return undefined;
  if (expected === 'rat' && actual === 'int') return undefined;
  if (expected === 'int' && actual === 'rat') return coreError('expr.round_required', { scope, actual });
  return coreError('expr.type', { reason: 'result_type', expected, actual, scope });
}

/** 對已解析的 AST 做型別檢查；expected 是呼叫端的額外要求（money 型 derived 傳 'int'），會與位置本身的要求一起檢查 */
export function typecheckExpr(ast: Ast, scope: ExprScope, declared: DeclaredRefs, expected: ExpectedType = 'any'): Result<TypedAst, CoreError> {
  const rule = SCOPE_RULES.get(scope);
  if (rule === undefined) throw new TypeError(`typecheckExpr：不認得的 scope ${String(scope)}`);
  let typed: TypedAst;
  try {
    typed = new Checker(scope, rule, declared).check(ast);
  } catch (e) {
    if (e instanceof TypeFailure) return err(e.error);
    throw e;
  }
  const scopeError = checkExpected(typed.valueType, rule.result, scope);
  if (scopeError) return err(scopeError);
  const callerError = checkExpected(typed.valueType, expected, scope);
  if (callerError) return err(callerError);
  return ok(typed);
}

/** 建置期的入口：解析加型別檢查，回傳可存進內容快照的 TypedAst */
export function compileExpr(source: string, scope: ExprScope, declared: DeclaredRefs, expected: ExpectedType = 'any'): Result<TypedAst, CoreError> {
  const parsed = parseExpr(source);
  if (!parsed.ok) return parsed;
  return typecheckExpr(parsed.value, scope, declared, expected);
}
