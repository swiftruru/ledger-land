// 指標登錄檔的顯示資料（04 第 12 節）：只延後載入核心的指標登錄檔（lazy-data.ts，不帶判分與 zod），
// 給「看公式」與指標小表格用：公式文字（線的名稱以版面 label 顯示）、版本名稱、單位。數值不在這裡算，一律來自快照的 compiled。
// ratioInfoIn(core, …) 是同步版（題目元件已經拿到核心資料時第一次渲染就有公式），ratioInfoOf 等 loadCoreData。
import type { Locale } from '@ledgerland/i18n';
import { layoutOf, lineLabelIn, type TeacherLayout } from './layout-lazy.ts';
import { loadCoreData, type CoreData } from './lazy-data.ts';
import type { RatioUnit } from './ratio-units.ts';

interface RatioVersionData {
  readonly numerator?: string;
  readonly denominator?: string;
  readonly expr?: string;
  readonly unit: RatioUnit;
  readonly displayDecimals: number;
  readonly flags: readonly string[];
}

interface RatioDefinitionData {
  readonly id: string;
  readonly termRef: string;
  readonly category: string;
  readonly versions: Readonly<Partial<Record<string, RatioVersionData>>>;
}

function ratiosOf(core: CoreData): readonly RatioDefinitionData[] {
  return core.defaultRatios as unknown as readonly RatioDefinitionData[];
}

/** 指標登錄檔（模組 Promise 已經在 loadCoreData 快取，這裡不再多快取一層，否則失敗會被永久留住） */
export function loadRatios(): Promise<readonly RatioDefinitionData[]> {
  return loadCoreData().then(ratiosOf);
}

export interface RatioInfo {
  id: string;
  version: string;
  termRef: string;
  unit: RatioUnit;
  displayDecimals: number;
  flags: readonly string[];
  /** 公式文字：分數型是「分子 ÷ 分母」，運算式型是把 line.x 換成名稱後的運算式 */
  formula: string;
}

const REF_RE = /\b(line|input|ratio)\.([a-z][a-z0-9_]*)(?:\.([a-z][a-z0-9_]*))?/g;

function humanise(layout: TeacherLayout, source: string, locale: Locale, labelOf: (termId: string) => string | undefined): string {
  const parts: string[] = [];
  let last = 0;
  for (const m of source.matchAll(REF_RE)) {
    const index = m.index ?? 0;
    parts.push(source.slice(last, index));
    const ns = m[1]!;
    const name = m[2]!;
    if (ns === 'line') parts.push(lineLabelIn(layout, name, locale, labelOf));
    else parts.push(name.replace(/_/g, ' '));
    last = index + m[0].length;
  }
  parts.push(source.slice(last));
  return parts
    .join('')
    .replace(/\s*\/\s*/g, ' ÷ ')
    .replace(/\s*\*\s*/g, ' × ')
    .replace(/avg\(([^)]*)\)/g, locale === 'en' ? 'average($1)' : '平均（$1）');
}

/** ratioRef（<id>@<version>）的顯示資料（同步，已有核心資料）；登錄檔沒有時回傳 undefined */
export function ratioInfoIn(core: CoreData, ratioRef: string, locale: Locale, labelOf: (termId: string) => string | undefined): RatioInfo | undefined {
  const at = ratioRef.indexOf('@');
  if (at === -1) return undefined;
  const id = ratioRef.slice(0, at);
  const version = ratioRef.slice(at + 1);
  const def = ratiosOf(core).find((r) => r.id === id);
  const spec = def?.versions[version];
  if (def === undefined || spec === undefined) return undefined;
  const layout = layoutOf(core);
  const formula =
    spec.expr !== undefined
      ? humanise(layout, spec.expr, locale, labelOf)
      : `${humanise(layout, spec.numerator ?? '', locale, labelOf)} ÷ ${humanise(layout, spec.denominator ?? '', locale, labelOf)}`;
  return { id, version, termRef: def.termRef, unit: spec.unit, displayDecimals: spec.displayDecimals, flags: spec.flags, formula };
}

/** ratioRef 的顯示資料（等核心資料） */
export async function ratioInfoOf(ratioRef: string, locale: Locale, labelOf: (termId: string) => string | undefined): Promise<RatioInfo | undefined> {
  return ratioInfoIn(await loadCoreData(), ratioRef, locale, labelOf);
}
