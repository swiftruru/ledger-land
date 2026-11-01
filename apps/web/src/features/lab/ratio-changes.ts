// 指標的前後比較（03 第 3.3 節階段 9、第 3.10 節）：把核心的 RatioResult（全部版本）配上登錄檔的定義，整理成畫面要的清單。純函式。
import type { LabCore } from './lazy-core.ts';
import type { RatioResult } from './lab-core.ts';
import type { RatioChange, RatioSpecLike } from './RatioList.tsx';

export type RatioVersionId = 'excel' | 'slides03' | 'slides02' | 'dupont' | 'slides01';
export const RATIO_VERSIONS: readonly RatioVersionId[] = ['excel', 'slides03', 'slides02', 'dupont', 'slides01'];

/** 六大類的順序（03 第 3.10 節）：投入（資產結構、現金流量）、轉換（經營能力、槓桿度）、產出（獲利能力、償債能力），另有杜邦與損益結構 */
export const CATEGORY_ORDER: readonly string[] = [
  'financial_structure',
  'cash_flow',
  'activity',
  'leverage',
  'profitability',
  'solvency',
  'dupont',
  'income_structure',
  'department',
  'market',
];

export function ratioSpecs(core: LabCore, version: RatioVersionId): RatioSpecLike[] {
  const registry = core.ratioRegistry();
  const out: RatioSpecLike[] = [];
  for (const d of core.ratioDefinitions) {
    const v = d.versions[version];
    if (v === undefined) continue;
    const compiled = registry.versions.get(`${d.id}@${version}`);
    if (compiled === undefined) continue;
    out.push({
      id: d.id,
      termRef: d.termRef,
      category: d.category,
      framework: d.framework,
      unit: v.unit,
      displayDecimals: v.displayDecimals,
      ...(v.numerator === undefined ? {} : { numerator: v.numerator }),
      ...(v.denominator === undefined ? {} : { denominator: v.denominator }),
      ...(v.expr === undefined ? {} : { expr: v.expr }),
      flags: v.flags,
      pendingRefs: d.pendingRefs,
    });
  }
  return out.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
}

function same(a: RatioResult | null, b: RatioResult): boolean {
  if (a === null) return false;
  return a.status === b.status && a.displayValue === b.displayValue;
}

export function ratioChanges(core: LabCore, version: RatioVersionId, before: readonly RatioResult[] | null, after: readonly RatioResult[]): RatioChange[] {
  const byRef = (list: readonly RatioResult[] | null) => new Map((list ?? []).map((r) => [r.ratioRef, r]));
  const b = byRef(before);
  const a = byRef(after);
  return ratioSpecs(core, version).flatMap((spec) => {
    const ref = `${spec.id}@${version}`;
    const r = a.get(ref);
    if (r === undefined) return [];
    const prev = b.get(ref) ?? null;
    return [{ ratioRef: ref, spec, before: before === null ? null : prev, after: r, changed: !same(prev, r) }];
  });
}

/** 預測用的指標點：算得出數字（ok、zero、not_meaningful 帶數字）是 displayValue，N/A 是 null */
export function ratioPoint(r: RatioResult | undefined): { display: number | null } {
  if (r === undefined || r.status === 'na' || r.displayValue === null) return { display: null };
  return { display: r.displayValue };
}
