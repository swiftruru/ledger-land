// 交易卡（03 第 3.3 節階段 1）：交易文字（含推導值，佔位符由核心算出的 values 代入）、名詞 chip、標記（依課程情境推算、設計說明）；
// 單獨練習或從中間開始時上方多一行前情摘要（到上一步為止：現金、存貨、未分配盈餘）。
import { Trans, useLingui } from '@lingui/react/macro';
import { formatMoney } from '@ledgerland/i18n';
import { NoteTag, TermChip } from '@ledgerland/web-ui';
import { useRef } from 'react';
import type { StoryStepSnapshot } from '../../lib/content.ts';
import { MarkupParagraphs } from '../quiz/Markup.tsx';
import { useTerms } from '../quiz/terms.tsx';
import type { LabStep, Statements } from './lab-core.ts';
import { joinList, lineAt, useLabLabels } from './labels.ts';

export interface TransactionCardProps {
  spec: StoryStepSnapshot;
  step: LabStep;
  layout: Parameters<typeof useLabLabels>[0];
  /** 前情摘要（單獨練習或從中間開始） */
  recap: boolean;
  /** 從中間「開始」時的一次性提示 */
  suggestEarlier: boolean;
}

function TermChipRow({ ids }: { ids: readonly string[] }) {
  const { labelOf, openTerm } = useTerms();
  const refs = useRef(new Map<string, HTMLButtonElement | null>());
  const known = ids.filter((id) => labelOf(id) !== undefined);
  if (known.length === 0) return null;
  return (
    <ul className="ll-lab-card__terms" data-testid="lab-card-terms">
      {known.map((id) => (
        <li key={id}>
          <TermChip
            ref={(el: HTMLButtonElement | null) => {
              refs.current.set(id, el);
            }}
            label={labelOf(id) ?? id}
            onClick={() => openTerm(id, { current: refs.current.get(id) ?? null })}
          />
        </li>
      ))}
    </ul>
  );
}

export function Recap({ before, layout }: { before: Statements; layout: Parameters<typeof useLabLabels>[0] }) {
  const { t } = useLingui();
  const { locale, lineLabel } = useLabLabels(layout);
  const parts = ['bs_cash', 'bs_inventory', 'bs_retained_earnings'].map((id) => `${lineLabel(id)} ${formatMoney(lineAt(before, id), locale)}`);
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

export function TransactionCard({ spec, step, layout, recap, suggestEarlier }: TransactionCardProps) {
  const { t } = useLingui();
  const notes = [...new Set(spec.events.flatMap((e) => e.pendingRefs ?? []))];
  return (
    <article className="ll-lab-card" data-testid="lab-card">
      {recap && <Recap before={step.before} layout={layout} />}
      {suggestEarlier && (
        <p className="ll-lab-card__suggest" role="note">
          <Trans id="lab.card.suggestEarlier" comment="從中間「開始」時的一次性提示（03 第 3.1 節）">
            建議先走完前面的步驟，也可以直接開始。
          </Trans>
        </p>
      )}
      <div className="ll-lab-card__body">
        <MarkupParagraphs text={spec.narrative} ctx={{ values: step.values }} className="ll-lab-card__narrative" />
      </div>
      <div className="ll-lab-card__tags">
        {spec.verification === 'inferred' && (
          <span className="ll-lab-card__tag" data-testid="lab-inferred">
            {t({ id: 'lab.card.inferred', message: '依課程情境推算', comment: '第 4 到 18 步的小標記（T33）' })}
          </span>
        )}
        {notes.length > 0 && <NoteTag kind="design_note" subject={notes.join(', ')} />}
      </div>
      <TermChipRow ids={spec.termRefs} />
    </article>
  );
}
