// 金額與有理數（04 第 3 節）。Money 是安全整數的 number；中間值用 bigint 有理數 Rat，永遠是最簡分數且分母為正。
// 四捨五入只有一種：到整數、.5 遠離 0（與 Excel ROUND 相同）。
import { type CoreError, type Result, coreError, err, ok } from './result.ts';

/** 金額：JavaScript number，但每次運算後都檢查 Number.isSafeInteger */
export type Money = number;

export const MONEY_MAX: Money = Number.MAX_SAFE_INTEGER;
export const MONEY_MIN: Money = Number.MIN_SAFE_INTEGER;
const MONEY_MAX_BIG = BigInt(Number.MAX_SAFE_INTEGER);
const MONEY_MIN_BIG = BigInt(Number.MIN_SAFE_INTEGER);

export const isMoney = (v: unknown): v is Money => typeof v === 'number' && Number.isSafeInteger(v);

function assertMoney(v: number, what: string): void {
  if (!isMoney(v)) throw new TypeError(`${what} 必須是安全整數，收到 ${String(v)}`);
}

/** 兩個安全整數相加；真正的和超過安全範圍時，浮點結果也一定落在安全範圍外，所以檢查結果就夠 */
export function addMoney(a: Money, b: Money): Result<Money, CoreError> {
  assertMoney(a, 'addMoney 的 a');
  assertMoney(b, 'addMoney 的 b');
  const sum = a + b;
  return isMoney(sum) ? ok(sum) : err(coreError('money.overflow', { op: '+', a, b }));
}

export function subMoney(a: Money, b: Money): Result<Money, CoreError> {
  assertMoney(a, 'subMoney 的 a');
  assertMoney(b, 'subMoney 的 b');
  const diff = a - b;
  return isMoney(diff) ? ok(diff) : err(coreError('money.overflow', { op: '-', a, b }));
}

/** 精確有理數：分子分母都是 bigint，建構時一律化為最簡分數、分母恆正。只用 ratXxx 函式建立，不要直接寫物件 */
export interface Rat {
  readonly num: bigint;
  readonly den: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

/** 化簡；分母為 0 是程式錯誤（預期內的除以 0 由 ratDiv 以 Result 回報） */
export function rat(num: bigint, den: bigint = 1n): Rat {
  if (den === 0n) throw new RangeError('rat：分母不得為 0');
  if (num === 0n) return { num: 0n, den: 1n };
  const sign = den < 0n ? -1n : 1n;
  const g = gcd(num, den);
  return { num: (num * sign) / g, den: (den * sign) / g };
}

export const RAT_ZERO: Rat = { num: 0n, den: 1n };
export const RAT_ONE: Rat = { num: 1n, den: 1n };

/** 整數轉有理數；number 必須是安全整數（否則是程式錯誤） */
export function ratFromInt(n: Money | bigint): Rat {
  if (typeof n === 'bigint') return { num: n, den: 1n };
  assertMoney(n, 'ratFromInt 的參數');
  return { num: BigInt(n), den: 1n };
}

const DECIMAL_RE = /^(-?)(\d+)(?:\.(\d+))?$/;

/** 十進位字面值（例如 '0.2'、'-12.50'）轉精確有理數；格式不合是程式錯誤，parser 已先驗證過字面值 */
export function ratFromDecimalString(s: string): Rat {
  const m = DECIMAL_RE.exec(s);
  if (!m) throw new TypeError(`ratFromDecimalString：不是十進位字面值 ${JSON.stringify(s)}`);
  const sign = m[1] === '-' ? -1n : 1n;
  const intPart = m[2] ?? '0';
  const fracPart = m[3] ?? '';
  const num = BigInt(intPart + fracPart) * sign;
  const den = 10n ** BigInt(fracPart.length);
  return rat(num, den);
}

export const ratAdd = (a: Rat, b: Rat): Rat => rat(a.num * b.den + b.num * a.den, a.den * b.den);
export const ratSub = (a: Rat, b: Rat): Rat => rat(a.num * b.den - b.num * a.den, a.den * b.den);
export const ratMul = (a: Rat, b: Rat): Rat => rat(a.num * b.num, a.den * b.den);
export const ratNeg = (a: Rat): Rat => ({ num: -a.num, den: a.den });

/** 除法；除數為 0 回傳 expr.division_by_zero（執行期唯二的預期錯誤之一） */
export function ratDiv(a: Rat, b: Rat): Result<Rat, CoreError> {
  if (b.num === 0n) return err(coreError('expr.division_by_zero', { dividend: ratToDecimalLike(a) }));
  return ok(rat(a.num * b.den, a.den * b.num));
}

export function ratCmp(a: Rat, b: Rat): -1 | 0 | 1 {
  const l = a.num * b.den;
  const r = b.num * a.den;
  return l < r ? -1 : l > r ? 1 : 0;
}

export const ratEq = (a: Rat, b: Rat): boolean => ratCmp(a, b) === 0;
export const ratIsZero = (a: Rat): boolean => a.num === 0n;
export const ratIsNegative = (a: Rat): boolean => a.num < 0n;
export const ratIsInteger = (a: Rat): boolean => a.den === 1n;
export const ratMin = (a: Rat, b: Rat): Rat => (ratCmp(a, b) <= 0 ? a : b);
export const ratMax = (a: Rat, b: Rat): Rat => (ratCmp(a, b) >= 0 ? a : b);

/** 有理數轉金額：必須是整數（money.not_integer）且在安全範圍內（money.overflow） */
export function ratToMoney(a: Rat): Result<Money, CoreError> {
  if (a.den !== 1n) return err(coreError('money.not_integer', { value: ratToDecimalLike(a) }));
  if (a.num > MONEY_MAX_BIG || a.num < MONEY_MIN_BIG) return err(coreError('money.overflow', { value: a.num.toString() }));
  return ok(Number(a.num));
}

/** 四捨五入到整數，.5 遠離 0（Excel ROUND）：89999.75 到 90000、-2.5 到 -3、2.5 到 3 */
export function ratRoundHalfAwayFromZero(a: Rat): Rat {
  if (a.den === 1n) return a;
  const abs = a.num < 0n ? -a.num : a.num;
  let q = abs / a.den;
  const r = abs % a.den;
  if (r * 2n >= a.den) q += 1n;
  return { num: a.num < 0n ? -q : q, den: 1n };
}

/** 浮點近似值；分子分母都在安全範圍內時直接相除，否則先放大成整數再縮回 */
export function ratToNumber(a: Rat): number {
  if (a.num <= MONEY_MAX_BIG && a.num >= MONEY_MIN_BIG && a.den <= MONEY_MAX_BIG) return Number(a.num) / Number(a.den);
  const SCALE = 10n ** 20n;
  return Number((a.num * SCALE) / a.den) / 1e20;
}

/** 顯示用：先在精確值上四捨五入到 decimals 位（同樣 .5 遠離 0），再轉成 number 交給 UI 以固定小數位數格式化 */
export function ratToDisplay(a: Rat, decimals: number): number {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 20)
    throw new RangeError(`ratToDisplay：decimals 必須是 0 到 20 的整數，收到 ${String(decimals)}`);
  const scale = 10n ** BigInt(decimals);
  const scaled = ratRoundHalfAwayFromZero(rat(a.num * scale, a.den));
  return Number(scaled.num) / Number(scale);
}

/** 精確值的可序列化形狀（04 第 12.1 節 RatioResult.exact） */
export function ratToExact(a: Rat): { num: string; den: string } {
  return { num: a.num.toString(), den: a.den.toString() };
}

/** 從 ratToExact 的形狀還原；格式不合是程式錯誤 */
export function ratFromExact(e: { readonly num: string; readonly den: string }): Rat {
  if (!/^-?\d+$/.test(e.num) || !/^\d+$/.test(e.den)) throw new TypeError(`ratFromExact：不是整數字串 ${JSON.stringify(e)}`);
  return rat(BigInt(e.num), BigInt(e.den));
}

/** 錯誤參數用的文字：整數直接給，非整數給 num/den */
function ratToDecimalLike(a: Rat): string {
  return a.den === 1n ? a.num.toString() : `${a.num.toString()}/${a.den.toString()}`;
}
