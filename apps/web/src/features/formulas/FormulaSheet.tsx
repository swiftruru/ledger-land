// 公式面板（2026-11-08，M4d 收尾）：苦練頁的「相關公式」膠囊按下去開這個面板，不離開作答；內容是條目頁的前五段（FormulaSections），
// 腳部「看完整條目與相關題目」連到條目頁。和名詞卡同一套 Sheet（手機底部面板、768 起置中），只由 formula-sheet-lazy.ts 動態載入。
import { useLingui } from '@lingui/react/macro';
import { localePath } from '@ledgerland/i18n';
import { Badge, Button, RatioIcon, Sheet } from '@ledgerland/web-ui';
import type { RefObject } from 'react';
import type { FormulaSnapshot } from '../../lib/content.ts';
import { useLocale } from '../../lib/useLocale.ts';
import { FormulaSections } from './FormulaSections.tsx';
import { useFormulaCategoryLabel } from './useFormulaCategoryLabel.ts';
import '../../styles/formulas.css';

export interface FormulaSheetProps {
  open: boolean;
  onClose: () => void;
  formula: FormulaSnapshot;
  returnFocusTo?: RefObject<HTMLElement | null>;
}

export function FormulaSheet({ open, onClose, formula, returnFocusTo }: FormulaSheetProps) {
  const { t } = useLingui();
  const locale = useLocale();
  const categoryLabel = useFormulaCategoryLabel();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={formula.label}
      lead={
        <Badge className="ll-termpage__cat">
          <RatioIcon size={16} />
          <span>{categoryLabel(formula.category)}</span>
        </Badge>
      }
      className="ll-sheet--formula"
      bodyClassName="ll-fxsheet"
      footer={
        <Button variant="primary" size="md" icon={<RatioIcon />} href={localePath(locale, `/formulas/${formula.id}/`)} data-testid="formula-sheet-full">
          {t({ id: 'formulas.sheet.full', message: '看完整條目與相關題目', comment: '公式面板腳部的按鈕：到公式條目頁' })}
        </Button>
      }
      {...(returnFocusTo === undefined ? {} : { returnFocusTo })}
      data-testid="formula-sheet"
    >
      <FormulaSections formula={formula} headingLevel={3} />
    </Sheet>
  );
}
