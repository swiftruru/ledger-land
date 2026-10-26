// 分類題（03 第 2.5 節）各維度的分類格：代號來自核心（content-rules 的 DIMENSION_VALUES），顯示文字是介面字串。
import { useLingui } from '@lingui/react/macro';

export type ClassifyDimension = 'element' | 'current' | 'cf_activity' | 'ratio_category';

export function useCategoryLabels(): (dimension: ClassifyDimension, id: string) => string {
  const { t } = useLingui();
  const labels: Record<string, string> = {
    'element:asset': t({ id: 'classify.element.asset', message: '資產', comment: '分類題的分類格（要素）' }),
    'element:liability': t({ id: 'classify.element.liability', message: '負債', comment: '分類題的分類格（要素）' }),
    'element:equity': t({ id: 'classify.element.equity', message: '股東權益', comment: '分類題的分類格（要素）' }),
    'element:revenue': t({ id: 'classify.element.revenue', message: '收益', comment: '分類題的分類格（要素）' }),
    'element:expense': t({ id: 'classify.element.expense', message: '費損', comment: '分類題的分類格（要素）' }),
    'current:current': t({ id: 'classify.current.current', message: '流動', comment: '分類題的分類格（流動或非流動）' }),
    'current:noncurrent': t({ id: 'classify.current.noncurrent', message: '非流動', comment: '分類題的分類格（流動或非流動）' }),
    'cf_activity:operating': t({ id: 'classify.cf.operating', message: '營業活動', comment: '分類題的分類格（現金流量活動）' }),
    'cf_activity:investing': t({ id: 'classify.cf.investing', message: '投資活動', comment: '分類題的分類格（現金流量活動）' }),
    'cf_activity:financing': t({ id: 'classify.cf.financing', message: '籌資活動', comment: '分類題的分類格（現金流量活動）' }),
    'ratio_category:financial_structure': t({
      id: 'classify.ratio.financialStructure',
      message: '資產結構',
      comment: '分類題的分類格（指標類別，12 第 10.1 節）',
    }),
    'ratio_category:solvency': t({ id: 'classify.ratio.solvency', message: '償債能力', comment: '分類題的分類格（指標類別）' }),
    'ratio_category:activity': t({ id: 'classify.ratio.activity', message: '經營能力', comment: '分類題的分類格（指標類別）' }),
    'ratio_category:profitability': t({ id: 'classify.ratio.profitability', message: '獲利能力', comment: '分類題的分類格（指標類別）' }),
    'ratio_category:cash_flow': t({ id: 'classify.ratio.cashFlow', message: '現金流量', comment: '分類題的分類格（指標類別）' }),
    'ratio_category:leverage': t({ id: 'classify.ratio.leverage', message: '槓桿度', comment: '分類題的分類格（指標類別）' }),
    'ratio_category:dupont': t({ id: 'classify.ratio.dupont', message: '杜邦分析', comment: '分類題的分類格（指標類別）' }),
    'ratio_category:department': t({ id: 'classify.ratio.department', message: '部門指標', comment: '分類題的分類格（指標類別）' }),
    'ratio_category:market': t({ id: 'classify.ratio.market', message: '市場面', comment: '分類題的分類格（指標類別）' }),
    'ratio_category:income_structure': t({ id: 'classify.ratio.incomeStructure', message: '損益結構', comment: '分類題的分類格（指標類別）' }),
  };
  return (dimension, id) => labels[`${dimension}:${id}`] ?? id;
}

export const DIMENSION_CATEGORIES: Record<ClassifyDimension, readonly string[]> = {
  element: ['asset', 'liability', 'equity', 'revenue', 'expense'],
  current: ['current', 'noncurrent'],
  cf_activity: ['operating', 'investing', 'financing'],
  ratio_category: [
    'financial_structure',
    'solvency',
    'activity',
    'profitability',
    'cash_flow',
    'leverage',
    'dupont',
    'department',
    'market',
    'income_structure',
  ],
};

/** 題目出現的分類格：有正解分類的維度值都列出（element 只列題目用到的，避免五格太擠） */
export function categoriesFor(dimension: ClassifyDimension, categories: Readonly<Record<string, string>> | undefined): string[] {
  const all = DIMENSION_CATEGORIES[dimension];
  if (dimension !== 'element' && dimension !== 'ratio_category') return [...all];
  const used = new Set(Object.values(categories ?? {}));
  const listed = all.filter((c) => used.has(c));
  return listed.length >= 2 ? listed : [...all];
}
