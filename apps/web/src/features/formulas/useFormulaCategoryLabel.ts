// 公式分類的顯示名稱（第二層 catalog）：總覽的分類切換、分組標題與條目頁的類別 Badge 共用
import { useLingui } from '@lingui/react/macro';
import type { FormulaCategory } from './catalogue.ts';

export function useFormulaCategoryLabel(): (c: FormulaCategory | string) => string {
  const { t } = useLingui();
  return (c) => {
    switch (c) {
      case 'statement':
        return t({ id: 'formulas.category.statement', message: '報表關係', comment: '公式分類：會計恆等式、五層利益這類報表之間的計算關係' });
      case 'income_structure':
        return t({ id: 'formulas.category.income_structure', message: '損益結構', comment: '公式分類：毛利率、營業利益率這類損益表的比率' });
      case 'profitability':
        return t({ id: 'formulas.category.profitability', message: '獲利能力', comment: '公式分類（講義的六大類之一）' });
      case 'activity':
        return t({ id: 'formulas.category.activity', message: '經營能力', comment: '公式分類（講義的六大類之一）：週轉率與天數' });
      case 'solvency':
        return t({ id: 'formulas.category.solvency', message: '償債能力', comment: '公式分類（講義的六大類之一）' });
      case 'financial_structure':
        return t({ id: 'formulas.category.financial_structure', message: '資產結構', comment: '公式分類（講義的六大類之一）：負債比率、權益倍數' });
      case 'cash_flow':
        return t({ id: 'formulas.category.cash_flow', message: '現金流量', comment: '公式分類（講義的六大類之一）' });
      case 'leverage':
        return t({ id: 'formulas.category.leverage', message: '槓桿度', comment: '公式分類（講義的六大類之一）' });
      case 'dupont':
        return t({ id: 'formulas.category.dupont', message: '杜邦分析', comment: '公式分類：杜邦方程式' });
      case 'market':
        return t({ id: 'formulas.category.market', message: '市場與股價', comment: '公式分類：本益比、融資維持率' });
      case 'department':
        return t({ id: 'formulas.category.department', message: '部門績效', comment: '公式分類：人均營收、研發、資本支出與行銷的比率' });
      default:
        return t({ id: 'formulas.category.other', message: '其他', comment: '公式分類：其他' });
    }
  };
}
