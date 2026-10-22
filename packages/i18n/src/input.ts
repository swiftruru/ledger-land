// 作答輸入的正規化（05 第 11 節）
export type NumericUnit = 'money' | 'percent' | 'times' | 'plain';

export type NormalizeResult = { ok: true; value: number } | { ok: false; reason: 'empty' | 'parentheses' | 'invalid' };

const UNIT_AFFIX: Partial<Record<NumericUnit, RegExp>> = {
  money: /^(NT\$|\$)|元$/g,
  percent: /[%％]$/g,
  times: /(倍|x|×)$/gi,
};

/** 取出開頭的 - 或 +；+ 視為沒有符號 */
function takeSign(s: string): ['' | '-', string] {
  if (s.startsWith('-')) return ['-', s.slice(1)];
  if (s.startsWith('+')) return ['', s.slice(1)];
  return ['', s];
}

export function normalizeNumericInput(raw: string, unit: NumericUnit): NormalizeResult {
  // 1 到 4：NFKC、數學負號、數字間的句號、逗號與空白
  let s = raw
    .normalize('NFKC')
    .replace(/−/g, '-')
    .replace(/(\d)。(\d)/g, '$1.$2');
  s = s.replace(/[,，\s]/g, '');
  if (s === '') return { ok: false, reason: 'empty' };
  if (/^\(.*\)$/.test(s)) return { ok: false, reason: 'parentheses' };

  // 正負號可能在單位前（-NT$1234）或單位後（NT$-1234），所以單位前後各取一次
  let [sign, rest] = takeSign(s);
  const affix = UNIT_AFFIX[unit];
  if (affix) rest = rest.replace(affix, '');
  if (sign === '') [sign, rest] = takeSign(rest);

  if (!/^\d+(\.\d+)?$/.test(rest)) return { ok: false, reason: 'invalid' };
  const value = Number(sign + rest);
  return { ok: true, value: Object.is(value, -0) ? 0 : value };
}
