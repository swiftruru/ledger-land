// 共用名詞卡（03 第 4.3 節、05 第 13.1 節、站規 1.10、1.20、2.4.3）：面板用共用的 Sheet（原生 dialog 的 showModal 提供焦點鎖定與 Esc；
// 開啟時初始焦點在標題；Esc、右上 X、點遮罩都會關閉；關閉或父層直接卸載時焦點回到開啟它的 chip，07 第 8.1 節）。
// 頭：類別 Badge（帶類別圖示）、名稱、另一種語言的名稱；腳部不再放「關閉」（和右上 X 重複）。fullHref 有值時腳部放
// secondary「在圖鑑看完整說明」；作答中（關卡、錯題複習）不傳，避免作答途中離開（站規 2.4.3）。
// 名稱表：教材用語與現行用語相同時合併成一列。相關名詞的 chip 排成一列（gap 8），NoteTag 另起一列放在「用語說明」下方。
// 內容由父層依介面語言從名詞資料取好後傳入；元件不自己寫術語（類別名稱也由父層格式化後傳入）。
import { Trans, useLingui } from '@lingui/react/macro';
import { useId, type ReactNode, type RefObject } from 'react';
import { Badge } from './Badge.tsx';
import { Button } from './Button.tsx';
import { TermCategoryIcon, type TermCategory } from './GlossaryItem.tsx';
import { CardsIcon } from './icons.tsx';
import { NoteTag, type NoteTagKind } from './NoteTag.tsx';
import { Sheet } from './Sheet.tsx';

export interface TermSheetData {
  /** 主標（中文介面是教材用語，英文介面是 IFRS 英文） */
  label: string;
  /** 副標（另一種語言的名稱）與它的 lang */
  secondaryLabel?: string;
  secondaryLang?: string;
  /** 名詞類別與它的顯示名稱（父層格式化）：有值時頭部放類別 Badge */
  category?: TermCategory;
  categoryLabel?: string;
  teacherLabel: string;
  currentTwLabel: string | null;
  ifrsEnglish: string | null;
  definition: ReactNode;
  /** 用語本身的說明（教材異寫、舊稱或日式用語的原因；04 第 16.3 節、08 第 3.7 節）：畫在名稱之後，因為它說明的是上面那幾個名稱 */
  note?: ReactNode;
  example?: ReactNode;
  misconception?: ReactNode;
  formula?: ReactNode;
  /** 「IFRS 怎麼處理」段落 */
  ifrsNote?: ReactNode;
  /** 顯示成 NoteTag 的旗標 */
  flags?: readonly NoteTagKind[];
  /** 英文譯名本身還不確定時顯示「譯名尚待確認」 */
  translationPending?: boolean;
  /** 相關名詞 chip（TermChip）等額外內容 */
  related?: ReactNode;
  footer?: ReactNode;
}

export interface TermSheetProps {
  open: boolean;
  onClose: () => void;
  term: TermSheetData;
  /** 旗標被點時（例如開到 IFRS 段落） */
  onFlagClick?: (kind: NoteTagKind) => void;
  /** 關閉後要把焦點還給的元素（開啟它的 chip）；Safari 點選按鈕不會給焦點，所以不能只靠 document.activeElement */
  returnFocusTo?: RefObject<HTMLElement | null>;
  /** 名詞頁的網址：有值時腳部放「在圖鑑看完整說明」。作答中不傳 */
  fullHref?: string;
}

export function TermSheet({ open, onClose, term, onFlagClick, returnFocusTo, fullHref }: TermSheetProps) {
  const { t } = useLingui();
  const baseId = useId();
  const ifrsId = `${baseId}-ifrs`;
  const sameLabel = term.currentTwLabel !== null && term.currentTwLabel === term.teacherLabel;
  const subtitle =
    term.secondaryLabel || term.translationPending ? (
      <>
        {term.secondaryLabel && <span lang={term.secondaryLang}>{term.secondaryLabel}</span>}
        {term.translationPending && (
          <span className="ll-sheet__pending">
            {' '}
            {t({ id: 'term.translationPending', message: '譯名尚待確認', comment: '名詞卡：英文譯名本身還不確定時的標示' })}
          </span>
        )}
      </>
    ) : undefined;
  const lead =
    term.category !== undefined && term.categoryLabel ? (
      <Badge className="ll-termsheet__cat">
        <TermCategoryIcon category={term.category} size={16} />
        <span>{term.categoryLabel}</span>
      </Badge>
    ) : undefined;
  const footer =
    fullHref !== undefined || term.footer ? (
      <>
        {term.footer}
        {fullHref !== undefined && (
          <Button href={fullHref} block icon={<CardsIcon />}>
            <Trans id="term.fullDetail" comment="名詞卡腳部：前往名詞頁看完整說明（只在名詞圖鑑與名詞頁裡打開時出現，作答中不顯示）">
              在圖鑑看完整說明
            </Trans>
          </Button>
        )}
      </>
    ) : undefined;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={term.label}
      subtitle={subtitle}
      lead={lead}
      footer={footer}
      returnFocusTo={returnFocusTo}
      className="ll-termsheet"
    >
      <div className="ll-sheet__definition">{term.definition}</div>
      <dl className="ll-sheet__names">
        {sameLabel ? (
          <div>
            <dt>
              <Trans id="term.bothLabels" comment="名詞卡：教材用語與現行用語相同時合併成一列的欄位標題">
                教材用語與現行用語
              </Trans>
            </dt>
            <dd lang="zh-TW">{term.teacherLabel}</dd>
          </div>
        ) : (
          <>
            <div>
              <dt>
                <Trans id="term.teacherLabel" comment="名詞卡：教材用語的欄位標題">
                  教材用語
                </Trans>
              </dt>
              <dd lang="zh-TW">{term.teacherLabel}</dd>
            </div>
            {term.currentTwLabel && (
              <div>
                <dt>
                  <Trans id="term.currentTwLabel" comment="名詞卡：現行台灣用語的欄位標題">
                    現行用語
                  </Trans>
                </dt>
                <dd lang="zh-TW">{term.currentTwLabel}</dd>
              </div>
            )}
          </>
        )}
        <div>
          <dt>IFRS</dt>
          <dd lang="en">
            {term.ifrsEnglish ?? (
              <Trans id="term.noIfrs" comment="名詞卡：IFRS 沒有對應名稱時的文字">
                沒有對應的 IFRS 名稱
              </Trans>
            )}
          </dd>
        </div>
      </dl>
      {term.note && (
        <section className="ll-sheet__section">
          <h3>
            <Trans id="term.note" comment="名詞卡：用語本身的說明段落標題（教材異寫、舊稱或日式用語的原因）">
              用語說明
            </Trans>
          </h3>
          {term.note}
        </section>
      )}
      {term.flags && term.flags.length > 0 && (
        <div className="ll-sheet__flags">
          {term.flags.map((f) => (
            <NoteTag key={f} kind={f} subject={term.label} onClick={onFlagClick ? () => onFlagClick(f) : undefined} />
          ))}
        </div>
      )}
      {term.formula && (
        <section className="ll-sheet__section">
          <h3>
            <Trans id="term.formula" comment="名詞卡：公式段落標題">
              公式
            </Trans>
          </h3>
          <div className="ll-num">{term.formula}</div>
        </section>
      )}
      {term.example && (
        <section className="ll-sheet__section">
          <h3>
            <Trans id="term.example" comment="名詞卡：例子段落標題">
              例子
            </Trans>
          </h3>
          {term.example}
        </section>
      )}
      {term.misconception && (
        <section className="ll-sheet__section">
          <h3>
            <Trans id="term.misconception" comment="名詞卡：常見誤解段落標題">
              常見誤解
            </Trans>
          </h3>
          {term.misconception}
        </section>
      )}
      {term.ifrsNote && (
        <section className="ll-sheet__section" id={ifrsId}>
          <h3>
            <Trans id="term.underIfrs" comment="名詞卡：IFRS 怎麼處理的段落標題">
              IFRS 怎麼處理
            </Trans>
          </h3>
          {term.ifrsNote}
        </section>
      )}
      {term.related && (
        <section className="ll-sheet__section">
          <h3>
            <Trans id="term.related" comment="名詞卡：相關名詞段落標題">
              相關名詞
            </Trans>
          </h3>
          <div className="ll-sheet__related">{term.related}</div>
        </section>
      )}
    </Sheet>
  );
}
