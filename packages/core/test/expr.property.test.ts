// oxlint-disable vitest/no-conditional-expect -- 性質測試依 Result 的成功或失敗分支檢查不同的不變式
// 性質測試（fast-check）：隨機合法運算式的 AST 序列化再解析後求值相同、同一輸入兩次 deep equal、型別推導與值一致；
// 隨機字串永遠只得到 Result 不會 throw；有理數與四捨五入的代數性質。
import { describe, expect, it } from 'vitest';
import { fc } from '@fast-check/vitest';
import {
  type AccountNode,
  type Ast,
  type DeclaredRefs,
  type EvalEnv,
  MONEY_MAX,
  MONEY_MIN,
  type Rat,
  addMoney,
  astDepth,
  astNodeCount,
  canonicalJson,
  compileExpr,
  evaluate,
  parseExpr,
  rat,
  ratAdd,
  ratCmp,
  ratDiv,
  ratFromDecimalString,
  ratFromExact,
  ratFromInt,
  ratIsInteger,
  ratMul,
  ratNeg,
  ratRoundHalfAwayFromZero,
  ratSub,
  ratToDisplay,
  ratToExact,
  ratToMoney,
  ratToNumber,
  subMoney,
  typecheckExpr,
  unwrap,
} from '../src/index.ts';

const PARAMS = ['p1', 'p2', 'rate'] as const;
const ACCOUNTS = ['cash', 'ar', 'ppe'] as const;
const declared: DeclaredRefs = {
  params: new Map([
    ['p1', 'int'],
    ['p2', 'int'],
    ['rate', 'rat'],
  ]),
  accounts: new Set(ACCOUNTS),
};
const env: EvalEnv = {
  param: new Map([
    ['p1', ratFromInt(7)],
    ['p2', ratFromInt(-12)],
    ['rate', ratFromDecimalString('0.35')],
  ]),
  balance: (id) => (id === 'cash' ? 250000 : id === 'ar' ? 0 : id === 'ppe' ? 359999 : undefined),
  cost: (id) => (id === 'cash' ? 250000 : id === 'ar' ? 0 : id === 'ppe' ? 400000 : undefined),
};

/** 把 AST 印回原始碼：每個二元與一元都加括號，所以解析回來的結構一定相同 */
function print(node: Ast | AccountNode): string {
  switch (node.type) {
    case 'number':
      return node.value;
    case 'ref':
      return node.version === undefined ? `${node.ns}.${node.name}` : `${node.ns}.${node.name}.${node.version}`;
    case 'account':
      return node.id;
    case 'unary':
      return `(${node.op}${print(node.operand)})`;
    case 'binary':
      return `(${print(node.left)} ${node.op} ${print(node.right)})`;
    case 'call':
      return `${node.fn}(${node.args.map(print).join(', ')})`;
  }
}

const numberLiteral: fc.Arbitrary<Ast> = fc.oneof(
  fc.nat(99999).map((n): Ast => ({ type: 'number', value: String(n) })),
  fc.tuple(fc.nat(999), fc.nat(999)).map(([a, b]): Ast => ({ type: 'number', value: `${a}.${b}` })),
);
const paramRef: fc.Arbitrary<Ast> = fc.constantFrom(...PARAMS).map((name): Ast => ({ type: 'ref', ns: 'param', name }));
const accountCall: fc.Arbitrary<Ast> = fc.tuple(fc.constantFrom('balance', 'cost'), fc.constantFrom(...ACCOUNTS)).map(([fn, id]): Ast => ({
  type: 'call',
  fn,
  args: [{ type: 'account', id }],
}));

/** 數值運算式（範本 derived 與前置條件都看得到的部分） */
const { numeric } = fc.letrec<{ numeric: Ast }>((tie) => ({
  numeric: fc.oneof(
    { maxDepth: 4, depthIdentifier: 'numeric' },
    numberLiteral,
    paramRef,
    accountCall,
    fc.tuple(fc.constantFrom('+', '-', '*', '/'), tie('numeric'), tie('numeric')).map(([op, left, right]): Ast => ({ type: 'binary', op, left, right })),
    tie('numeric').map((operand): Ast => ({ type: 'unary', op: '-', operand })),
    tie('numeric').map((x): Ast => ({ type: 'call', fn: 'round', args: [x] })),
    fc.tuple(fc.constantFrom('min', 'max'), tie('numeric'), tie('numeric')).map(([fn, a, b]): Ast => ({ type: 'call', fn, args: [a, b] })),
  ),
}));

/** 布林運算式（前置條件） */
const { bool } = fc.letrec<{ bool: Ast }>((tie) => ({
  bool: fc.oneof(
    { maxDepth: 3, depthIdentifier: 'bool' },
    fc.tuple(fc.constantFrom('==', '!=', '<', '<=', '>', '>='), numeric, numeric).map(([op, left, right]): Ast => ({ type: 'binary', op, left, right })),
    fc.tuple(fc.constantFrom('&&', '||'), tie('bool'), tie('bool')).map(([op, left, right]): Ast => ({ type: 'binary', op, left, right })),
    tie('bool').map((operand): Ast => ({ type: 'unary', op: '!', operand })),
  ),
}));

/** 只保留符合 04 第 8.1 節上限的運算式 */
function withinLimits(ast: Ast): boolean {
  return print(ast).length <= 300 && astNodeCount(ast) <= 256 && astDepth(ast) <= 32;
}

const hasDivisionOrRat = (ast: Ast | AccountNode): boolean => {
  switch (ast.type) {
    case 'number':
      return ast.value.includes('.');
    case 'ref':
      return ast.name === 'rate';
    case 'account':
      return false;
    case 'unary':
      return hasDivisionOrRat(ast.operand);
    case 'binary':
      return ast.op === '/' || hasDivisionOrRat(ast.left) || hasDivisionOrRat(ast.right);
    case 'call':
      return ast.fn !== 'round' && ast.args.some(hasDivisionOrRat);
  }
};

describe('性質：parser 與 AST', () => {
  it('印出再解析得到相同的 AST', () => {
    fc.assert(
      fc.property(fc.oneof(numeric, bool), (ast) => {
        fc.pre(withinLimits(ast));
        expect(unwrap(parseExpr(print(ast)))).toEqual(ast);
      }),
      { numRuns: 300 },
    );
  });
  it('任意字串只會得到 Result，不會 throw；解析成功的字串再型別檢查也不會 throw', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.string({ unit: 'binary' }), fc.string({ unit: fc.constantFrom(...'01.()+-*/<>=!&|, parmdivlneoutbcsxg'.split('')) })),
        (s) => {
          const r = parseExpr(s);
          if (r.ok) {
            expect(r.value).toBeDefined();
            const t = typecheckExpr(r.value, 'precondition', declared);
            expect(typeof t.ok).toBe('boolean');
          } else {
            expect(['expr.parse', 'expr.limit']).toContain(r.error.code);
          }
        },
      ),
      { numRuns: 500 },
    );
  });
  it('解析成功的字串一定在上限內', () => {
    fc.assert(
      fc.property(fc.string({ unit: fc.constantFrom(...'1+(-)'.split('')), maxLength: 320 }), (s) => {
        const r = parseExpr(s);
        if (r.ok) {
          expect(s.length).toBeLessThanOrEqual(300);
          expect(astNodeCount(r.value)).toBeLessThanOrEqual(256);
          expect(astDepth(r.value)).toBeLessThanOrEqual(32);
        }
      }),
    );
  });
});

describe('性質：型別檢查與求值', () => {
  it('數值運算式：型別檢查通過；序列化再解析後求值相同；兩次求值 deep equal；int 型別的值是整數', () => {
    fc.assert(
      fc.property(numeric, (ast) => {
        fc.pre(withinLimits(ast));
        const typed = unwrap(compileExpr(print(ast), 'template_derived', declared));
        expect(['int', 'rat']).toContain(typed.valueType);
        if (!hasDivisionOrRat(ast)) expect(typed.valueType).toBe('int');
        const first = evaluate(typed, env);
        const second = evaluate(typed, env);
        expect(second).toEqual(first);
        const roundTrip = JSON.parse(canonicalJson(typed)) as typeof typed;
        expect(canonicalJson(roundTrip)).toBe(canonicalJson(typed));
        expect(evaluate(roundTrip, env)).toEqual(first);
        expect(evaluate(ast, env)).toEqual(first);
        if (first.ok) {
          expect(typeof first.value.value).not.toBe('boolean');
          const v = first.value.value as Rat;
          expect(v.den > 0n).toBe(true);
          if (typed.valueType === 'int') expect(ratIsInteger(v)).toBe(true);
          expect(first.value.flags.size).toBe(0);
        } else {
          expect(['expr.division_by_zero', 'money.overflow']).toContain(first.error.code);
        }
      }),
      { numRuns: 400 },
    );
  });
  it('布林運算式：前置條件型別檢查通過且結果是布林；在 derived 裡被拒絕', () => {
    fc.assert(
      fc.property(bool, (ast) => {
        fc.pre(withinLimits(ast));
        const src = print(ast);
        const typed = unwrap(compileExpr(src, 'precondition', declared));
        expect(typed.valueType).toBe('bool');
        const r = evaluate(typed, env);
        if (r.ok) expect(typeof r.value.value).toBe('boolean');
        else expect(['expr.division_by_zero', 'money.overflow']).toContain(r.error.code);
        expect(evaluate(typed, env)).toEqual(r);
        const rejected = compileExpr(src, 'template_derived', declared);
        expect(rejected.ok).toBe(false);
        if (!rejected.ok) expect(rejected.error.code).toBe('expr.type');
      }),
      { numRuns: 200 },
    );
  });
  it('分錄行金額：有除法或有理數字面值的運算式要不是 round_required 就是 round 被拒', () => {
    fc.assert(
      fc.property(numeric, (ast) => {
        fc.pre(withinLimits(ast));
        const r = compileExpr(print(ast), 'template_line_amount', declared);
        if (r.ok) {
          expect(r.value.valueType).toBe('int');
          expect(print(ast)).not.toContain('round(');
        } else {
          expect(['expr.round_required', 'expr.unknown_function']).toContain(r.error.code);
        }
      }),
      { numRuns: 200 },
    );
  });
});

const ratArb: fc.Arbitrary<Rat> = fc
  .tuple(fc.bigInt({ min: -(10n ** 24n), max: 10n ** 24n }), fc.bigInt({ min: 1n, max: 10n ** 12n }))
  .map(([n, d]) => rat(n, d));
const intArb = fc.bigInt({ min: -(10n ** 18n), max: 10n ** 18n });

describe('性質：有理數', () => {
  it('永遠是最簡分數且分母為正；toExact 可還原', () => {
    fc.assert(
      fc.property(ratArb, (x) => {
        expect(x.den > 0n).toBe(true);
        const g = gcd(x.num < 0n ? -x.num : x.num, x.den);
        expect(g).toBe(1n);
        expect(ratFromExact(ratToExact(x))).toEqual(x);
      }),
    );
  });
  it('加減互逆、乘除互逆、交換律、比較反對稱', () => {
    fc.assert(
      fc.property(ratArb, ratArb, (a, b) => {
        expect(ratSub(ratAdd(a, b), b)).toEqual(a);
        expect(ratAdd(a, b)).toEqual(ratAdd(b, a));
        expect(ratMul(a, b)).toEqual(ratMul(b, a));
        if (b.num !== 0n) expect(unwrap(ratDiv(ratMul(a, b), b))).toEqual(a);
        else expect(ratDiv(a, b).ok).toBe(false);
        // 反對稱用相加等於 0 來寫：兩邊相等時 -ratCmp(b, a) 是 -0，toBe 用 Object.is 會把 +0 和 -0 當成不同（2026-10-30 main 的 CI 抽到 0/1 與 0/1 才踩到）
        expect(ratCmp(a, b) + ratCmp(b, a)).toBe(0);
        expect(ratCmp(ratNeg(a), ratNeg(b)) + ratCmp(a, b)).toBe(0);
        expect(ratCmp(a, a)).toBe(0);
      }),
    );
  });
  it('四捨五入：結果是整數、與原值相差不超過 1/2、.5 遠離 0、對稱於 0', () => {
    fc.assert(
      fc.property(ratArb, (x) => {
        const r = ratRoundHalfAwayFromZero(x);
        expect(r.den).toBe(1n);
        const diff = ratSub(r, x);
        const absDiff = diff.num < 0n ? ratNeg(diff) : diff;
        expect(ratCmp(absDiff, rat(1n, 2n))).toBeLessThanOrEqual(0);
        if (ratCmp(absDiff, rat(1n, 2n)) === 0) expect(r.num < 0n ? r.num <= x.num / x.den : r.num >= x.num / x.den).toBe(true);
        expect(ratRoundHalfAwayFromZero(ratNeg(x))).toEqual(ratNeg(r));
      }),
    );
  });
  it('整數不受四捨五入影響；ratToDisplay 以 0 位等於四捨五入', () => {
    fc.assert(
      fc.property(intArb, (n) => {
        const x = ratFromInt(n);
        expect(ratRoundHalfAwayFromZero(x)).toEqual(x);
        expect(ratFromDecimalString(n.toString())).toEqual(x);
      }),
    );
    fc.assert(
      fc.property(ratArb, fc.integer({ min: 0, max: 6 }), (x, d) => {
        const shown = ratToDisplay(x, d);
        expect(Number.isFinite(shown)).toBe(true);
        const scale = 10n ** BigInt(d);
        const expected = ratRoundHalfAwayFromZero(ratMul(x, ratFromInt(scale)));
        expect(shown).toBe(Number(expected.num) / Number(scale));
        expect(Math.abs(ratToNumber(x) - shown)).toBeLessThanOrEqual(0.5 / Number(scale) + Math.abs(ratToNumber(x)) * 1e-9);
      }),
    );
  });
  it('ratToMoney 只接受安全範圍內的整數', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -(2n ** 60n), max: 2n ** 60n }), (n) => {
        const r = ratToMoney({ num: n, den: 1n });
        const inRange = n <= BigInt(MONEY_MAX) && n >= BigInt(MONEY_MIN);
        expect(r.ok).toBe(inRange);
        if (r.ok) expect(BigInt(r.value)).toBe(n);
        else expect(r.error.code).toBe('money.overflow');
      }),
    );
  });
});

describe('性質：Money', () => {
  it('addMoney 成功時 subMoney 可還原；超出範圍一定是 money.overflow', () => {
    fc.assert(
      fc.property(fc.maxSafeInteger(), fc.maxSafeInteger(), (a, b) => {
        const sum = addMoney(a, b);
        const exact = BigInt(a) + BigInt(b);
        const inRange = exact <= BigInt(MONEY_MAX) && exact >= BigInt(MONEY_MIN);
        expect(sum.ok).toBe(inRange);
        if (sum.ok) {
          expect(BigInt(sum.value)).toBe(exact);
          expect(subMoney(sum.value, b)).toEqual({ ok: true, value: a });
        } else {
          expect(sum.error.code).toBe('money.overflow');
        }
      }),
    );
  });
});

function gcd(a: bigint, b: bigint): bigint {
  let x = a;
  let y = b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}
