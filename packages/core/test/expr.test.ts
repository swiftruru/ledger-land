// 04 第 8 節的單元測試：parser 的白名單、型別推導、各情境的可用參照與函式、求值與執行期錯誤。全部用自編數字。
import { describe, expect, it } from 'vitest';
import {
  type Ast,
  type CoreErrorCode,
  type DeclaredRefs,
  EXPR_LIMITS,
  EXPR_SCOPES,
  type EvalEnv,
  type ExprScope,
  type TypedAst,
  astDepth,
  astNodeCount,
  canonicalJson,
  compileExpr,
  evaluate,
  evaluateBool,
  evaluateMoney,
  evaluateRat,
  parseExpr,
  rat,
  ratFromDecimalString,
  ratFromInt,
  typecheckExpr,
  unwrap,
} from '../src/index.ts';

const declared: DeclaredRefs = {
  params: new Map([
    ['usefulLifeYears', 'int'],
    ['units', 'int'],
    ['rate', 'rat'],
    ['constructor', 'int'],
  ]),
  derived: new Map([
    ['depreciation', 'int'],
    ['ratio', 'rat'],
  ]),
  accounts: new Set(['machinery_equipment', 'cash', 'accounts_receivable']),
  lines: new Set(['is_revenue', 'is_cogs', 'bs_total_assets']),
  inputs: new Set(['sharePrice']),
  ratios: new Set(['ar_turnover@excel', 'net_profit_margin@slides02']),
};

const env: EvalEnv = {
  param: new Map([
    ['usefulLifeYears', ratFromInt(4)],
    ['units', ratFromInt(0)],
    ['rate', ratFromDecimalString('0.2')],
    ['constructor', ratFromInt(11)],
  ]),
  derived: new Map([
    ['depreciation', ratFromInt(90000)],
    ['ratio', rat(1n, 3n)],
  ]),
  line: new Map([
    ['is_revenue', ratFromInt(500000)],
    ['is_cogs', ratFromInt(320000)],
    ['bs_total_assets', ratFromInt(1200000)],
  ]),
  input: new Map([['sharePrice', ratFromDecimalString('12.5')]]),
  ratio: (ref) => (ref === 'ar_turnover@excel' ? rat(73n, 10n) : ref === 'net_profit_margin@slides02' ? rat(1n, 8n) : undefined),
  balance: (id) => (id === 'cash' ? 250000 : id === 'accounts_receivable' ? 80000 : id === 'machinery_equipment' ? 300000 : undefined),
  cost: (id) => (id === 'machinery_equipment' ? 359999 : undefined),
};

function errorCode<T>(r: { ok: true; value: T } | { ok: false; error: { code: CoreErrorCode } }): CoreErrorCode | 'ok' {
  return r.ok ? 'ok' : r.error.code;
}
const compile = (src: string, scope: ExprScope = 'template_derived', expected: 'int' | 'rat' | 'bool' | 'any' = 'any') =>
  compileExpr(src, scope, declared, expected);
const valueOf = (src: string, scope: ExprScope = 'template_derived') => unwrap(evaluate(unwrap(compile(src, scope)), env)).value;

describe('parseExpr：合法語法', () => {
  it('依 04 第 8.4 節的 JSON 形狀產生 AST（含型別）', () => {
    const typed = unwrap(compile('round(cost(machinery_equipment) / param.usefulLifeYears)'));
    expect(typed).toEqual({
      type: 'call',
      fn: 'round',
      valueType: 'int',
      args: [
        {
          type: 'binary',
          op: '/',
          valueType: 'rat',
          left: { type: 'call', fn: 'cost', valueType: 'int', args: [{ type: 'account', id: 'machinery_equipment' }] },
          right: { type: 'ref', ns: 'param', name: 'usefulLifeYears', valueType: 'int' },
        },
      ],
    });
    expect(JSON.parse(JSON.stringify(typed))).toEqual(typed);
  });
  it('優先順序：乘除先於加減，比較先於 &&，&& 先於 ||，一元只在 primary 前', () => {
    const ast = unwrap(parseExpr('1 + 2 * 3 - 4 / 5'));
    expect(ast).toEqual({
      type: 'binary',
      op: '-',
      left: {
        type: 'binary',
        op: '+',
        left: { type: 'number', value: '1' },
        right: { type: 'binary', op: '*', left: { type: 'number', value: '2' }, right: { type: 'number', value: '3' } },
      },
      right: { type: 'binary', op: '/', left: { type: 'number', value: '4' }, right: { type: 'number', value: '5' } },
    });
    const logic = unwrap(parseExpr('1 < 2 && 3 >= 4 || !(5 == 6)'));
    expect(logic.type === 'binary' && logic.op).toBe('||');
    expect(logic.type === 'binary' && logic.left.type === 'binary' && logic.left.op).toBe('&&');
    expect(logic.type === 'binary' && logic.right.type === 'unary' && logic.right.op).toBe('!');
    expect(unwrap(parseExpr('-2 * 3'))).toEqual({
      type: 'binary',
      op: '*',
      left: { type: 'unary', op: '-', operand: { type: 'number', value: '2' } },
      right: { type: 'number', value: '3' },
    });
    expect(unwrap(parseExpr('-(2 * 3)')).type).toBe('unary');
  });
  it('參照、ratio 三段參照、函式與空白', () => {
    expect(unwrap(parseExpr('  param.x\t+\nderived.y '))).toEqual({
      type: 'binary',
      op: '+',
      left: { type: 'ref', ns: 'param', name: 'x' },
      right: { type: 'ref', ns: 'derived', name: 'y' },
    });
    expect(unwrap(parseExpr('ratio.roa.excel'))).toEqual({ type: 'ref', ns: 'ratio', name: 'roa', version: 'excel' });
    expect(unwrap(parseExpr('min(1, 2, 3)'))).toEqual({
      type: 'call',
      fn: 'min',
      args: [
        { type: 'number', value: '1' },
        { type: 'number', value: '2' },
        { type: 'number', value: '3' },
      ],
    });
    expect(unwrap(parseExpr('avg(line.is_revenue)'))).toEqual({ type: 'call', fn: 'avg', args: [{ type: 'ref', ns: 'line', name: 'is_revenue' }] });
    expect(unwrap(parseExpr('balance(cash_in_bank)'))).toEqual({ type: 'call', fn: 'balance', args: [{ type: 'account', id: 'cash_in_bank' }] });
    expect(unwrap(parseExpr('0.25'))).toEqual({ type: 'number', value: '0.25' });
    expect(unwrap(parseExpr('007'))).toEqual({ type: 'number', value: '007' });
  });
  it('節點數與深度的計算', () => {
    const ast = unwrap(parseExpr('round(cost(machinery_equipment) / param.usefulLifeYears)'));
    expect(astNodeCount(ast)).toBe(5);
    expect(astDepth(ast)).toBe(4);
    expect(astDepth({ type: 'account', id: 'x' })).toBe(1);
    expect(astNodeCount({ type: 'account', id: 'x' })).toBe(1);
  });
});

describe('parseExpr：白名單以外一律拒絕', () => {
  const rejected: string[] = [
    '',
    '   ',
    '"abc"',
    "'abc'",
    '`abc`',
    '__proto__',
    'constructor',
    'param.__proto__',
    'param.Constructor',
    'param._x',
    'param.x.y',
    'line.x.y',
    'ratio.roa',
    'ratio.roa.excel.extra',
    'param',
    'param.',
    'param..x',
    'foo',
    'true',
    'null',
    'this',
    'window.x',
    '1e5',
    '1E5',
    '0x1F',
    '0b101',
    '1.',
    '.5',
    '1.2.3',
    '1_000',
    '1,000',
    'a[0]',
    '[1]',
    '{}',
    'round',
    'round 1',
    'round()',
    'round(1, 2)',
    'avg()',
    'avg(1, 2)',
    'min(1)',
    'max()',
    'balance()',
    'balance(1)',
    'balance(Cash)',
    'balance(cash, cash)',
    'balance(param.x)',
    'balance(cash',
    'cost(cash))',
    '1 < 2 < 3',
    '1 == 2 == 3',
    '--1',
    '-!1',
    '!-1',
    '1 +',
    '+ 1',
    '* 1',
    '1 = 2',
    '1 & 2',
    '1 | 2',
    '1 === 2',
    '1 => 2',
    '1 ? 2 : 3',
    '1; 2',
    'param.x = 1',
    '(1',
    '1)',
    '()',
    'round(1)(2)',
    'param.x()',
    '１',
    '一',
    '1 + 2 // 3',
    'param.x\u0000',
    'eval(1)',
    'Function(1)',
    'param.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  ];
  it.each(rejected)('拒絕 %j', (src) => {
    const r = parseExpr(src);
    expect(r).toMatchObject({ ok: false, error: { code: 'expr.parse', message: { key: 'core.error.expr.parse' } } });
    expect(typeof (r.ok ? undefined : r.error.message.params?.at)).toBe('number');
  });
  it('錯誤附位置與原因', () => {
    expect(parseExpr('1 + "x"')).toMatchObject({ ok: false, error: { message: { params: { at: 4, reason: 'unexpected_character', found: '"' } } } });
    const r2 = parseExpr('1 < 2 < 3');
    expect(!r2.ok && r2.error.message.params).toMatchObject({ at: 6, reason: 'unexpected_token', found: '<' });
  });
  it('64 字元的 ident 可以，65 不行', () => {
    const id64 = 'a'.repeat(64);
    expect(parseExpr(`param.${id64}`).ok).toBe(true);
    expect(errorCode(parseExpr(`param.${id64}a`))).toBe('expr.parse');
  });
  it('非字串輸入是程式錯誤', () => {
    expect(() => parseExpr(123 as unknown as string)).toThrow(TypeError);
  });
});

describe('parseExpr：上限（expr.limit）', () => {
  it('長度 300 可以，301 不行', () => {
    const ok300 = '1'.repeat(300);
    expect(ok300.length).toBe(EXPR_LIMITS.maxLength);
    expect(parseExpr(ok300).ok).toBe(true);
    const r = parseExpr(`${ok300}1`);
    expect(errorCode(r)).toBe('expr.limit');
    expect(!r.ok && r.error.message.params).toMatchObject({ limit: 'length', max: 300, actual: 301 });
  });
  it('節點 256 可以，257 不行', () => {
    // 300 字元內塞到 257 個節點又不超過 32 層：14 組各 9 個 1 相加再串起來，節點數是奇數，所以用 min(1,1,1) 補成 256
    const ones = (n: number) => Array.from({ length: n }, () => '1').join('+');
    const group = `(${ones(9)})`;
    const base = Array.from({ length: 14 }, () => group).join('+');
    expect(astNodeCount(unwrap(parseExpr(base)))).toBe(251);
    const exactly256 = `(min(1,1,1)+${ones(8)})+${Array.from({ length: 13 }, () => group).join('+')}+1`;
    expect(exactly256.length).toBeLessThanOrEqual(300);
    expect(astNodeCount(unwrap(parseExpr(exactly256)))).toBe(256);
    const exactly257 = `${base}+1+1+1`;
    expect(exactly257.length).toBeLessThanOrEqual(300);
    const r = parseExpr(exactly257);
    expect(errorCode(r)).toBe('expr.limit');
    expect(!r.ok && r.error.message.params).toMatchObject({ limit: 'nodes', max: 256, actual: 257 });
  });
  it('深度 32 可以，33 不行', () => {
    const nested = (n: number) => `${'1+('.repeat(n)}1${')'.repeat(n)}`;
    expect(astDepth(unwrap(parseExpr(nested(31))))).toBe(32);
    const r = parseExpr(nested(32));
    expect(errorCode(r)).toBe('expr.limit');
    expect(!r.ok && r.error.message.params).toMatchObject({ limit: 'depth', max: 32, actual: 33 });
    // 一元運算子串接也算深度
    const deepUnary = `${'-('.repeat(40)}1${')'.repeat(40)}`;
    expect(errorCode(parseExpr(deepUnary))).toBe('expr.limit');
  });
});

describe('型別推導（04 第 8.3 節）', () => {
  const typeOf = (src: string, scope: ExprScope = 'template_derived') => {
    const r = compile(src, scope, 'any');
    return r.ok ? r.value.valueType : r.error.code;
  };
  it('整數字面值是 int，帶小數的是 rat', () => {
    expect(typeOf('12')).toBe('int');
    expect(typeOf('12.0')).toBe('rat');
    expect(typeOf('0.2')).toBe('rat');
  });
  it('int 加減乘 int 得 int；除法得 rat；rat 參與得 rat', () => {
    expect(typeOf('param.units + 3 * param.usefulLifeYears - 1')).toBe('int');
    expect(typeOf('param.units / 1')).toBe('rat');
    expect(typeOf('param.units * param.rate')).toBe('rat');
    expect(typeOf('param.units + derived.ratio')).toBe('rat');
    expect(typeOf('-param.units')).toBe('int');
    expect(typeOf('-derived.ratio')).toBe('rat');
  });
  it('round 得 int；min 與 max 取較寬的型別；balance 與 cost 得 int', () => {
    expect(typeOf('round(param.units / 3)')).toBe('int');
    expect(typeOf('round(param.units)')).toBe('int');
    expect(typeOf('min(param.units, 3)')).toBe('int');
    expect(typeOf('max(param.units, 3, 0.5)')).toBe('rat');
    expect(typeOf('min(balance(cash), cost(machinery_equipment))')).toBe('int');
  });
  it('比較與邏輯得 bool', () => {
    expect(typeOf('param.units > 0', 'precondition')).toBe('bool');
    expect(typeOf('param.rate == 0.2 && !(param.units != 0) || balance(cash) >= 1', 'precondition')).toBe('bool');
  });
  it('line 是 int，input 與 ratio 是 rat，avg 是 rat', () => {
    expect(typeOf('line.is_revenue - line.is_cogs', 'ratio_formula')).toBe('int');
    expect(typeOf('input.sharePrice', 'ratio_formula')).toBe('rat');
    expect(typeOf('365 / ratio.ar_turnover.excel', 'ratio_formula')).toBe('rat');
    expect(typeOf('avg(line.bs_total_assets)', 'ratio_formula')).toBe('rat');
    expect(typeOf('line.is_revenue - line.is_cogs', 'layout_formula')).toBe('int');
  });
  it('型別不合是 expr.type', () => {
    expect(typeOf('1 + (1 < 2)', 'precondition')).toBe('expr.type');
    expect(typeOf('-(1 < 2)', 'precondition')).toBe('expr.type');
    expect(typeOf('!1', 'precondition')).toBe('expr.type');
    expect(typeOf('1 && 2', 'precondition')).toBe('expr.type');
    expect(typeOf('(1 < 2) || 3', 'precondition')).toBe('expr.type');
    expect(typeOf('(1 < 2) == (2 < 3)', 'precondition')).toBe('expr.type');
    expect(typeOf('round(1 < 2)', 'precondition')).toBe('expr.type');
    expect(typeOf('min(1, 1 < 2)', 'precondition')).toBe('expr.type');
    expect(typeOf('avg(1)', 'ratio_formula')).toBe('expr.type');
    expect(typeOf('avg(input.sharePrice)', 'ratio_formula')).toBe('expr.type');
  });
});

describe('各情境可用的參照與函式（04 第 8.2 節）', () => {
  it('範本 derived：param、derived、balance、cost、round、min、max；不可比較與邏輯', () => {
    expect(errorCode(compile('round(cost(machinery_equipment) * param.rate) + derived.depreciation'))).toBe('ok');
    expect(errorCode(compile('line.is_revenue'))).toBe('expr.unknown_ref');
    expect(errorCode(compile('input.sharePrice'))).toBe('expr.unknown_ref');
    expect(errorCode(compile('ratio.ar_turnover.excel'))).toBe('expr.unknown_ref');
    expect(errorCode(compile('avg(line.is_revenue)'))).toBe('expr.unknown_function');
    expect(errorCode(compile('param.units > 1'))).toBe('expr.type');
    expect(errorCode(compile('!param.units'))).toBe('expr.type');
    const r = compile('line.is_revenue');
    expect(!r.ok && r.error.message.params).toMatchObject({ ref: 'line.is_revenue', reason: 'namespace_not_allowed', scope: 'template_derived' });
  });
  it('money 型 derived 要求 int，否則 expr.round_required', () => {
    expect(errorCode(compile('cost(machinery_equipment) / param.usefulLifeYears', 'template_derived', 'int'))).toBe('expr.round_required');
    expect(errorCode(compile('round(cost(machinery_equipment) / param.usefulLifeYears)', 'template_derived', 'int'))).toBe('ok');
    expect(errorCode(compile('param.units * param.rate', 'template_derived', 'int'))).toBe('expr.round_required');
    expect(errorCode(compile('param.units * param.rate', 'template_derived', 'rat'))).toBe('ok');
    expect(errorCode(compile('param.units', 'template_derived', 'rat'))).toBe('ok');
    expect(errorCode(compile('param.units', 'template_derived', 'bool'))).toBe('expr.type');
  });
  it('分錄行金額：不可用 round，結果必須是 int', () => {
    expect(errorCode(compile('derived.depreciation', 'template_line_amount'))).toBe('ok');
    expect(errorCode(compile('min(balance(cash), param.units)', 'template_line_amount'))).toBe('ok');
    expect(errorCode(compile('round(param.units / 2)', 'template_line_amount'))).toBe('expr.unknown_function');
    expect(errorCode(compile('param.units / 2', 'template_line_amount'))).toBe('expr.round_required');
    expect(errorCode(compile('derived.ratio', 'template_line_amount'))).toBe('expr.round_required');
    expect(errorCode(compile('param.units', 'template_line_amount', 'rat'))).toBe('ok');
  });
  it('前置條件必須是 bool', () => {
    expect(errorCode(compile('balance(cash) >= param.units', 'precondition'))).toBe('ok');
    expect(errorCode(compile('balance(cash)', 'precondition'))).toBe('expr.type');
    expect(errorCode(compile('round(derived.ratio) > 0 && param.units == 0', 'precondition'))).toBe('ok');
    expect(errorCode(compile('line.is_revenue > 0', 'precondition'))).toBe('expr.unknown_ref');
  });
  it('指標公式：line、input、ratio、avg、min、max；不可 balance、cost、round、param', () => {
    expect(errorCode(compile('(line.is_revenue - line.is_cogs) / avg(line.bs_total_assets)', 'ratio_formula'))).toBe('ok');
    expect(errorCode(compile('ratio.net_profit_margin.slides02 * input.sharePrice', 'ratio_formula'))).toBe('ok');
    expect(errorCode(compile('max(line.is_revenue, 1)', 'ratio_formula'))).toBe('ok');
    expect(errorCode(compile('balance(cash)', 'ratio_formula'))).toBe('expr.unknown_function');
    expect(errorCode(compile('round(line.is_revenue / 3)', 'ratio_formula'))).toBe('expr.unknown_function');
    expect(errorCode(compile('param.units', 'ratio_formula'))).toBe('expr.unknown_ref');
    expect(errorCode(compile('line.is_revenue > 0', 'ratio_formula'))).toBe('expr.type');
  });
  it('版面公式列：只有 line，沒有函式，結果是整數', () => {
    expect(errorCode(compile('line.is_revenue - line.is_cogs', 'layout_formula'))).toBe('ok');
    expect(errorCode(compile('line.is_revenue / 2', 'layout_formula'))).toBe('expr.round_required');
    expect(errorCode(compile('min(line.is_revenue, 0)', 'layout_formula'))).toBe('expr.unknown_function');
    expect(errorCode(compile('input.sharePrice', 'layout_formula'))).toBe('expr.unknown_ref');
  });
  it('查不到的參照、科目與函式', () => {
    expect(errorCode(compile('param.notDeclared'))).toBe('expr.unknown_ref');
    expect(errorCode(compile('derived.notDeclared'))).toBe('expr.unknown_ref');
    expect(errorCode(compile('line.not_a_line', 'ratio_formula'))).toBe('expr.unknown_ref');
    expect(errorCode(compile('input.notDeclared', 'ratio_formula'))).toBe('expr.unknown_ref');
    expect(errorCode(compile('ratio.ar_turnover.slides02', 'ratio_formula'))).toBe('expr.unknown_ref');
    expect(errorCode(compile('balance(not_an_account)'))).toBe('expr.unknown_account');
    expect(errorCode(compile('cost(cash_in_bank)'))).toBe('expr.unknown_account');
    const r = compile('cost(cash_in_bank)');
    expect(!r.ok && r.error.message.params).toMatchObject({ account: 'cash_in_bank', fn: 'cost' });
    // 宣告表是空的時候，每種命名空間都查不到
    expect(errorCode(compileExpr('param.x', 'template_derived', {}))).toBe('expr.unknown_ref');
    expect(errorCode(compileExpr('balance(cash)', 'template_derived', {}))).toBe('expr.unknown_account');
    expect(errorCode(compileExpr('line.x', 'layout_formula', {}))).toBe('expr.unknown_ref');
    expect(errorCode(compileExpr('input.x', 'ratio_formula', {}))).toBe('expr.unknown_ref');
    expect(errorCode(compileExpr('ratio.x.y', 'ratio_formula', {}))).toBe('expr.unknown_ref');
  });
  it('名稱像原型屬性也只走 Map 查詢：沒宣告就查不到，宣告了就正常', () => {
    expect(errorCode(compileExpr('param.constructor', 'template_derived', { params: new Map() }))).toBe('expr.unknown_ref');
    expect(errorCode(compileExpr('param.toString', 'template_derived', { params: new Map([['units', 'int']]) }))).toBe('expr.unknown_ref');
    expect(errorCode(compileExpr('param.hasOwnProperty', 'template_derived', declared))).toBe('expr.unknown_ref');
    expect(valueOf('param.constructor + 1')).toEqual(ratFromInt(12));
  });
  it('不認得的 scope 是程式錯誤；五個 scope 都登錄', () => {
    expect(EXPR_SCOPES).toHaveLength(5);
    expect(() => compileExpr('1', 'nope' as ExprScope, declared)).toThrow(TypeError);
  });
  it('typecheckExpr 可以直接對 AST 用；parse 失敗由 compileExpr 原樣回傳', () => {
    const ast: Ast = { type: 'number', value: '5' };
    expect(unwrap(typecheckExpr(ast, 'layout_formula', {}))).toEqual({ type: 'number', value: '5', valueType: 'int' });
    expect(errorCode(compile('1 +'))).toBe('expr.parse');
    expect(() => typecheckExpr({ type: 'nope' } as unknown as Ast, 'layout_formula', {})).toThrow(TypeError);
    expect(() => typecheckExpr({ type: 'call', fn: 'round', args: [{ type: 'account', id: 'cash' }] }, 'template_derived', declared)).not.toThrow();
    expect(errorCode(typecheckExpr({ type: 'call', fn: 'round', args: [{ type: 'account', id: 'cash' }] }, 'template_derived', declared))).toBe('expr.type');
    expect(errorCode(typecheckExpr({ type: 'call', fn: 'balance', args: [{ type: 'number', value: '1' }] }, 'template_derived', declared))).toBe('expr.type');
    expect(errorCode(typecheckExpr({ type: 'call', fn: 'round', args: [] }, 'template_derived', declared))).toBe('expr.type');
    expect(errorCode(typecheckExpr({ type: 'call', fn: 'avg', args: [] }, 'ratio_formula', declared))).toBe('expr.type');
    expect(errorCode(typecheckExpr({ type: 'call', fn: 'min', args: [{ type: 'number', value: '1' }] }, 'template_derived', declared))).toBe('expr.type');
  });
});

describe('evaluate（04 第 8.4 節）', () => {
  it('設備成本 359999、4 年：精確值 89999.75 四捨五入為 90000', () => {
    const typed = unwrap(compile('round(cost(machinery_equipment) / param.usefulLifeYears)', 'template_derived', 'int'));
    expect(evaluateMoney(typed, env)).toEqual({ ok: true, value: { value: 90000, flags: new Set() } });
    expect(valueOf('cost(machinery_equipment) / param.usefulLifeYears')).toEqual(ratFromDecimalString('89999.75'));
  });
  it('四則、一元、min、max、balance 與字面值', () => {
    expect(valueOf('1 + 2 * 3 - 4 / 5')).toEqual(rat(31n, 5n));
    expect(valueOf('-(param.usefulLifeYears) * 2.5')).toEqual(ratFromInt(-10));
    expect(valueOf('min(balance(cash), balance(accounts_receivable), 100000)')).toEqual(ratFromInt(80000));
    expect(valueOf('max(balance(cash), balance(accounts_receivable))')).toEqual(ratFromInt(250000));
    expect(valueOf('0.1 + 0.2')).toEqual(ratFromDecimalString('0.3'));
    expect(valueOf('derived.depreciation * param.rate')).toEqual(ratFromInt(18000));
    expect(valueOf('round(derived.ratio * 100)')).toEqual(ratFromInt(33));
    expect(valueOf('round(-2.5)')).toEqual(ratFromInt(-3));
  });
  it('比較與邏輯；&& 與 || 短路', () => {
    const pre = (src: string) => unwrap(evaluateBool(unwrap(compile(src, 'precondition')), env));
    expect(pre('balance(cash) >= 250000')).toBe(true);
    expect(pre('balance(cash) > 250000')).toBe(false);
    expect(pre('balance(cash) <= 250000 && balance(cash) < 250001')).toBe(true);
    expect(pre('param.units == 0 || 1 / param.units == 1')).toBe(true);
    expect(pre('param.units != 0 && 1 / param.units == 1')).toBe(false);
    expect(pre('!(param.rate == 0.2)')).toBe(false);
    expect(pre('param.rate == 0.2')).toBe(true);
    expect(pre('param.rate != 0.2')).toBe(false);
    const r = evaluateBool(unwrap(compile('1 / param.units == 1 || param.units == 0', 'precondition')), env);
    expect(errorCode(r)).toBe('expr.division_by_zero');
  });
  it('除以 0 回傳 expr.division_by_zero', () => {
    const r = evaluate(unwrap(compile('derived.depreciation / param.units')), env);
    expect(errorCode(r)).toBe('expr.division_by_zero');
    expect(errorCode(evaluate(unwrap(compile('1 / (0.5 - 0.5)')), env))).toBe('expr.division_by_zero');
  });
  it('round 的結果超出安全範圍回傳 money.overflow', () => {
    const r = evaluate(unwrap(compile('round(9007199254740991 + 0.5)')), env);
    expect(errorCode(r)).toBe('money.overflow');
    expect(errorCode(evaluate(unwrap(compile('round(-9007199254740991 - 0.5)')), env))).toBe('money.overflow');
    expect(unwrap(evaluate(unwrap(compile('round(9007199254740990 + 0.5)')), env)).value).toEqual(ratFromInt(9007199254740991));
  });
  it('evaluateMoney：非整數是 money.not_integer，超出範圍是 money.overflow', () => {
    expect(errorCode(evaluateMoney(unwrap(compile('param.rate')), env))).toBe('money.not_integer');
    expect(errorCode(evaluateMoney(unwrap(compile('9007199254740991 * 2')), env))).toBe('money.overflow');
    expect(errorCode(evaluateMoney(unwrap(compile('1 / param.units')), env))).toBe('expr.division_by_zero');
    expect(unwrap(evaluateMoney(unwrap(compile('derived.depreciation')), env)).value).toBe(90000);
  });
  it('evaluateRat 與 evaluateBool 對錯誤型別的結果是程式錯誤', () => {
    expect(() => evaluateRat(unwrap(compile('1 < 2', 'precondition')), env)).toThrow(TypeError);
    expect(() => evaluateBool(unwrap(compile('1 + 2')), env)).toThrow(TypeError);
    expect(errorCode(evaluateRat(unwrap(compile('1 / param.units')), env))).toBe('expr.division_by_zero');
    expect(errorCode(evaluateBool(unwrap(compile('1 / param.units == 1', 'precondition')), env))).toBe('expr.division_by_zero');
  });
  it('指標公式：line、input、ratio 連鎖', () => {
    const v = (src: string) => unwrap(evaluate(unwrap(compile(src, 'ratio_formula')), env));
    expect(v('(line.is_revenue - line.is_cogs) / line.is_revenue').value).toEqual(rat(9n, 25n));
    expect(v('365 / ratio.ar_turnover.excel').value).toEqual(rat(3650n, 73n));
    expect(v('ratio.net_profit_margin.slides02 * input.sharePrice').value).toEqual(rat(25n, 16n));
  });
  it('avg：單期回傳期末值並加 single_period_approx；有期初時取平均', () => {
    const typed = unwrap(compile('(line.is_revenue - line.is_cogs) / avg(line.bs_total_assets)', 'ratio_formula'));
    const single = unwrap(evaluate(typed, env));
    expect(single.value).toEqual(rat(180000n, 1200000n));
    expect(single.flags).toEqual(new Set(['single_period_approx']));
    const twoPeriods: EvalEnv = { ...env, lineOpening: new Map([['bs_total_assets', ratFromInt(800000)]]) };
    const both = unwrap(evaluate(typed, twoPeriods));
    expect(both.value).toEqual(rat(180000n, 1000000n));
    expect(both.flags).toEqual(new Set());
    // 期初以函式提供、而且這條線沒有期初時，仍是單期
    const partial: EvalEnv = { ...env, lineOpening: (name) => (name === 'is_revenue' ? ratFromInt(1) : undefined) };
    expect(unwrap(evaluate(typed, partial)).flags).toEqual(new Set(['single_period_approx']));
    expect(unwrap(evaluate(unwrap(compile('avg(line.is_revenue)', 'ratio_formula')), partial)).value).toEqual(rat(500001n, 2n));
    // 沒有用到 avg 就沒有旗標
    expect(unwrap(evaluate(unwrap(compile('line.is_revenue', 'ratio_formula')), env)).flags.size).toBe(0);
  });
  it('未標型別的 AST 也能求值', () => {
    const raw = unwrap(parseExpr('round(cost(machinery_equipment) / param.usefulLifeYears)'));
    expect(unwrap(evaluate(raw, env)).value).toEqual(ratFromInt(90000));
  });
  it('環境缺值或 AST 與型別不合是程式錯誤', () => {
    expect(() => evaluate(unwrap(compile('param.usefulLifeYears')), {})).toThrow(/param/);
    expect(() => evaluate(unwrap(compile('param.usefulLifeYears')), { param: new Map() })).toThrow(/usefulLifeYears/);
    expect(() => evaluate(unwrap(compile('param.usefulLifeYears')), { param: () => undefined })).toThrow(/usefulLifeYears/);
    expect(() => evaluate(unwrap(compile('balance(cash)')), {})).toThrow(/balance/);
    expect(() => evaluate(unwrap(compile('balance(cash)')), { balance: () => undefined })).toThrow(/balance/);
    expect(() => evaluate(unwrap(compile('cost(cash)')), { cost: () => 1.5 })).toThrow(/cost/);
    expect(() => evaluate(unwrap(compile('avg(line.is_revenue)', 'ratio_formula')), {})).toThrow(/line/);
    expect(() => evaluate(unwrap(compile('ratio.ar_turnover.excel', 'ratio_formula')), {})).toThrow(/ratio/);
    expect(() => evaluate(unwrap(compile('input.sharePrice', 'ratio_formula')), {})).toThrow(/input/);
    expect(() => evaluate(unwrap(compile('derived.ratio')), {})).toThrow(/derived/);
    expect(() => evaluate({ type: 'ref', ns: 'param', name: '__proto__' }, env)).toThrow(TypeError);
    expect(() => evaluate({ type: 'ref', ns: 'ratio', name: 'roa' }, env)).toThrow(TypeError);
    expect(() => evaluate({ type: 'ref', ns: 'ratio', name: 'roa', version: 'Bad!' }, env)).toThrow(TypeError);
    expect(() => evaluate({ type: 'ref', ns: 'nope' as 'param', name: 'x' }, env)).toThrow(TypeError);
    expect(() => evaluate({ type: 'nope' } as unknown as Ast, env)).toThrow(TypeError);
    expect(() =>
      evaluate(
        { type: 'unary', op: '-', operand: { type: 'binary', op: '<', left: { type: 'number', value: '1' }, right: { type: 'number', value: '2' } } },
        env,
      ),
    ).toThrow(TypeError);
    expect(() => evaluate({ type: 'unary', op: '!', operand: { type: 'number', value: '1' } }, env)).toThrow(TypeError);
    expect(() => evaluate({ type: 'binary', op: '&&', left: { type: 'number', value: '1' }, right: { type: 'number', value: '1' } }, env)).toThrow(TypeError);
    expect(() => evaluate({ type: 'binary', op: '**' as '*', left: { type: 'number', value: '1' }, right: { type: 'number', value: '1' } }, env)).toThrow(
      TypeError,
    );
    expect(() => evaluate({ type: 'call', fn: 'balance', args: [{ type: 'number', value: '1' }] }, env)).toThrow(TypeError);
    expect(() => evaluate({ type: 'call', fn: 'balance', args: [{ type: 'account', id: 'Cash' }] }, env)).toThrow(TypeError);
    expect(() => evaluate({ type: 'call', fn: 'round', args: [{ type: 'account', id: 'cash' }] }, env)).toThrow(TypeError);
    expect(() => evaluate({ type: 'call', fn: 'round', args: [] }, env)).toThrow(TypeError);
    expect(() => evaluate({ type: 'call', fn: 'min', args: [{ type: 'number', value: '1' }] }, env)).toThrow(TypeError);
    expect(() => evaluate({ type: 'call', fn: 'avg', args: [{ type: 'number', value: '1' }] }, env)).toThrow(TypeError);
    expect(() => evaluate({ type: 'call', fn: 'avg', args: [{ type: 'ref', ns: 'line', name: '__proto__' }] }, env)).toThrow(TypeError);
    expect(() => evaluate({ type: 'call', fn: 'nope' as 'min', args: [] }, env)).toThrow(TypeError);
  });
  it('決定性：同一輸入兩次 deep equal，AST 的 canonical JSON 相同', () => {
    const src = 'round(cost(machinery_equipment) / param.usefulLifeYears) + min(balance(cash), 12345)';
    const a = unwrap(compile(src));
    const b = unwrap(compile(src));
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(evaluate(a, env)).toEqual(evaluate(b, env));
    const viaJson = JSON.parse(canonicalJson(a)) as TypedAst;
    expect(evaluate(viaJson, env)).toEqual(evaluate(a, env));
  });
});
