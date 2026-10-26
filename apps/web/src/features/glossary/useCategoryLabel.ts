// 名詞類別的顯示名稱（站規 7.4 的 terms.category.*）：名詞圖鑑的卡片說明列與名詞頁的類別 Badge 共用
import { useLingui } from '@lingui/react/macro';
import type { TermCategory } from '../../lib/content.ts';

/** 類別的顯示名稱（站規 7.4 的 terms.category.*） */
export function useCategoryLabel(): (c: TermCategory) => string {
  const { t } = useLingui();
  return (c) => {
    switch (c) {
      case 'statement':
        return t({ id: 'terms.category.statement', message: '報表', comment: '名詞類別：財務報表與報表上的項目' });
      case 'account':
        return t({ id: 'terms.category.account', message: '科目', comment: '名詞類別：會計科目' });
      case 'ratio':
        return t({ id: 'terms.category.ratio', message: '指標', comment: '名詞類別：財務比率與指標' });
      case 'concept':
        return t({ id: 'terms.category.concept', message: '觀念', comment: '名詞類別：會計觀念' });
      case 'process':
        return t({ id: 'terms.category.process', message: '流程', comment: '名詞類別：會計流程（例如過帳、結帳）' });
      default:
        return t({ id: 'terms.category.other', message: '其他', comment: '名詞類別：其他' });
    }
  };
}
