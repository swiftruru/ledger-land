// 交易卡（03 第 3.3 節階段 1）：交易文字（含推導值，佔位符由核心算出的 values 代入）、名詞 chip、標記（依課程情境推算、設計說明）；
// 單獨練習或從中間開始時上方多一行前情摘要（到上一步為止：現金、存貨、未分配盈餘）。
// 數字由父層給：核心載好是核心的結果，還沒載好是故事快照裡建置時算好的 firstPaint（V24，LabStep.tsx）。
import { Trans, useLingui } from '@lingui/react/macro';
import { formatMoney } from '@ledgerland/i18n';
import { NoteTag, TermChip } from '@ledgerland/web-ui';
import { useRef } from 'react';
import type { StoryStepSnapshot } from '../../lib/content.ts';
import { MarkupParagraphs } from '../quiz/Markup.tsx';
import { useTerms } from '../quiz/terms.tsx';
import { joinList, useLabLabels } from './labels.ts';

export interface TransactionCardProps {
  spec: StoryStepSnapshot;
  /** 佔位符的值（事件參數與推導值） */
  values: Readonly<Record<string, number>>;
  /** 交易前某一列的金額（前情摘要用） */
  before: (lineId: string) => number;
  layout: Parameters<typeof useLabLabels>[0];
  /** 名詞索引載入前 chip 用的名稱（快照的 firstPaint.terms） */
  termLabels?: Readonly<Record<string, string>>;
  /** 前情摘要（單獨練習或從中間開始） */
  recap: boolean;
  /** 從中間「開始」時的一次性提示 */
  suggestEarlier: boolean;
}

function TermChipRow({ ids, termLabels }: { ids: readonly string[]; termLabels?: Readonly<Record<string, string>> }) {
  const { labelOf, openTerm } = useTerms();
  const refs = useRef(new Map<string, HTMLButtonElement | null>());
  const nameOf = (id: string) => labelOf(id) ?? termLabels?.[id];
  const known = ids.filter((id) => nameOf(id) !== undefined);
  if (known.length === 0) return null;
  return (
    <ul className="ll-lab-card__terms" data-testid="lab-card-terms">
      {known.map((id) => (
        <li key={id}>
          <TermChip
            ref={(el: HTMLButtonElement | null) => {
              refs.current.set(id, el);
            }}
            label={nameOf(id) ?? id}
            onClick={() => openTerm(id, { current: refs.current.get(id) ?? null })}
          />
        </li>
      ))}
    </ul>
  );
}

/** 前情摘要的三列；要和 tools/lib/content-rules.mjs 的 FIRST_PAINT_LINES.recap 一致（核心載入前用快照的數字） */
export const RECAP_LINES = ['bs_cash', 'bs_inventory', 'bs_retained_earnings'] as const;

export function Recap({ before, layout }: { before: (lineId: string) => number; layout: Parameters<typeof useLabLabels>[0] }) {
  const { t } = useLingui();
  const { locale, lineLabel } = useLabLabels(layout);
  const parts = RECAP_LINES.map((id) => `${lineLabel(id)} ${formatMoney(before(id), locale)}`);
  return (
    <p className="ll-lab-recap" data-testid="lab-recap">
      {t({
        id: 'lab.card.recap',
        message: `到上一步為止：${joinList(parts, locale)}`,
        comment: '前情摘要；parts 是「現金 508,000、存貨 120,000」這類字串（分隔符依語系）',
      })}
    </p>
  );
}

export function TransactionCard({ spec, values, before, layout, termLabels, recap, suggestEarlier }: TransactionCardProps) {
  const { t } = useLingui();
  const notes = [...new Set(spec.events.flatMap((e) => e.pendingRefs ?? []))];
  return (
    <article className="ll-lab-card" data-testid="lab-card">
      {recap && <Recap before={before} layout={layout} />}
      {suggestEarlier && (
        <p className="ll-lab-card__suggest" role="note">
          <Trans id="lab.card.suggestEarlier" comment="從中間「開始」時的一次性提示（03 第 3.1 節）">
            建議先走完前面的步驟，也可以直接開始。
          </Trans>
        </p>
      )}
      <div className="ll-lab-card__body">
        <MarkupParagraphs text={spec.narrative} ctx={{ values }} className="ll-lab-card__narrative" />
      </div>
      <div className="ll-lab-card__tags">
        {spec.verification === 'inferred' && (
          <span className="ll-lab-card__tag" data-testid="lab-inferred">
            {t({ id: 'lab.card.inferred', message: '依課程情境推算', comment: '第 4 到 18 步的小標記（T33）' })}
          </span>
        )}
        {notes.length > 0 && <NoteTag kind="design_note" subject={notes.join(', ')} />}
      </div>
      <TermChipRow ids={spec.termRefs} termLabels={termLabels} />
    </article>
  );
}
