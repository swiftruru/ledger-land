// 來源面板第二區的公式樹（03 第 3.9 節）：以目前聚焦的節點為主角，列出它的公式與每個子節點（運算符號、名稱、金額）。
// 子節點還能再拆時有一顆按鈕：medium 以上最多同時縮排 3 層（展開在原地，aria-expanded），更深或 compact 改成「往下鑽」（面板改以那個節點為主角，
// 頂端的路徑可以回去）。0 元而且沒有任何來源的子節點收在「其他 0 元的項目」。最底層的科目節點列出來源步驟（TraceSources）。
// 樹是巢狀清單加按鈕，不用 role="tree"（Tab 在按鈕間移動，Enter 或 Space 展開）。數字全部來自核心的追蹤樹，不自己算。
import { useLingui } from '@lingui/react/macro';
import { formatMoney } from '@ledgerland/i18n';
import { Button, CaretDownIcon, CaretRightIcon, Disclosure } from '@ledgerland/web-ui';
import { useState } from 'react';
import type { LabRun, TraceNode } from './lab-core.ts';
import { useLabLabels } from './labels.ts';
import { childOperators, hasSources, splitChildren, type TraceOperator } from './trace-model.ts';
import { TraceSources, type TraceSourcesProps } from './TraceSources.tsx';

/** medium 以上同時縮排的層數上限；更深改成往下鑽 */
export const NEST_LIMIT = 3;

export interface TraceTreeProps {
  /** 目前聚焦的節點（路徑的終點） */
  node: TraceNode;
  run: LabRun;
  entriesOf: TraceSourcesProps['entriesOf'];
  layout: Parameters<typeof useLabLabels>[0];
  /** medium 以上：子節點可以在原地展開；compact 一律往下鑽 */
  nested: boolean;
  onDrill: (child: TraceNode) => void;
  /** 展開或往下鑽時播報的一句 */
  onLive: (text: string) => void;
  stepInfo: TraceSourcesProps['stepInfo'];
  stepHref: TraceSourcesProps['stepHref'];
  onNavigate?: () => void;
}

/** 「營業毛利 90,000 － 銷管費用 42,000」：公式樹的一層代入數字；給可讀名稱與播報用 */
export function useFormulaSentence(layout: Parameters<typeof useLabLabels>[0]) {
  const { locale, lineLabel } = useLabLabels(layout);
  return (node: TraceNode): string => {
    const ops = childOperators(node);
    const { shown } = splitChildren(node);
    return shown
      .map((c, i) => `${i === 0 && ops.get(c.line) === '＋' ? '' : `${ops.get(c.line) ?? '＋'} `}${lineLabel(c.line)} ${formatMoney(c.value, locale)}`)
      .join(' ');
  };
}

export function TraceTree({ node, run, entriesOf, layout, nested, onDrill, onLive, stepInfo, stepHref, onNavigate }: TraceTreeProps) {
  const { t } = useLingui();
  const { locale, lineLabel } = useLabLabels(layout);
  const sentence = useFormulaSentence(layout);
  const { shown, zeros } = splitChildren(node);
  return (
    <div className="ll-lab-trace__tree" data-testid="lab-trace-tree">
      <h3 className="ll-lab-trace__section">{t({ id: 'lab.trace.formula', message: '公式', comment: '來源面板第二區的標題' })}</h3>
      <p className="ll-lab-trace__focus" data-testid="lab-trace-focus">
        <span className="ll-lab-trace__name">{lineLabel(node.line)}</span> <span className="ll-num ll-lab-trace__value">{formatMoney(node.value, locale)}</span>
      </p>
      {shown.length > 0 && (
        <TraceChildren
          parent={node}
          items={shown}
          depth={1}
          run={run}
          entriesOf={entriesOf}
          layout={layout}
          nested={nested}
          onDrill={onDrill}
          onLive={onLive}
          sentence={sentence}
          stepInfo={stepInfo}
          stepHref={stepHref}
          onNavigate={onNavigate}
        />
      )}
      {zeros.length > 0 && (
        <Disclosure
          variant="plain"
          className="ll-lab-trace__zeros"
          summary={t({
            id: 'lab.trace.zeros',
            message: `其他 0 元的項目（${zeros.length}）`,
            comment: '公式樹裡金額是 0 而且沒有來源的子節點收在這裡；括號裡是數量',
          })}
          data-testid="lab-trace-zeros"
        >
          <ul className="ll-lab-trace__zerolist">
            {zeros.map((z) => (
              <li key={z.line}>{lineLabel(z.line)}</li>
            ))}
          </ul>
        </Disclosure>
      )}
      {shown.length === 0 && hasSources(node) && (
        <TraceSources node={node} run={run} entriesOf={entriesOf} layout={layout} stepInfo={stepInfo} stepHref={stepHref} onNavigate={onNavigate} />
      )}
      {shown.length === 0 && !hasSources(node) && node.value === 0 && (
        <p className="ll-lab-trace__none">
          {t({ id: 'lab.trace.noSources', message: '還沒有任何步驟動過這個數字。', comment: '公式樹最底層：這個科目沒有來源分錄' })}
        </p>
      )}
      {node.note?.key === 'trace.filled_in_other_line' && (
        <p className="ll-lab-trace__none">
          {t({
            id: 'lab.trace.filledInOtherLine',
            message: `這一期的變動填在「${lineLabel(node.note.params['line'] ?? '')}」那一列。`,
            comment: '追蹤樹的註記：增加與減少擇一的列（例如銷貨債權增加與應收帳款減少），變動填在另一列；列名已代入',
          })}
        </p>
      )}
    </div>
  );
}

interface ChildrenProps {
  parent: TraceNode;
  items: readonly TraceNode[];
  depth: number;
  run: LabRun;
  entriesOf: TraceSourcesProps['entriesOf'];
  layout: Parameters<typeof useLabLabels>[0];
  nested: boolean;
  onDrill: (child: TraceNode) => void;
  onLive: (text: string) => void;
  sentence: (node: TraceNode) => string;
  stepInfo: TraceSourcesProps['stepInfo'];
  stepHref: TraceSourcesProps['stepHref'];
  onNavigate?: () => void;
}

function TraceChildren({ parent, items, depth, run, entriesOf, layout, nested, onDrill, onLive, sentence, stepInfo, stepHref, onNavigate }: ChildrenProps) {
  const { t } = useLingui();
  const { locale, lineLabel } = useLabLabels(layout);
  const ops = childOperators(parent);
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const canNest = nested && depth < NEST_LIMIT;
  return (
    <ul className={`ll-lab-trace__list ll-lab-trace__list--${depth}`}>
      {items.map((child, i) => {
        const op: TraceOperator = ops.get(child.line) ?? '＋';
        const { shown } = splitChildren(child);
        const expandable = shown.length > 0 || hasSources(child);
        const open = opened.has(child.line);
        const label = lineLabel(child.line);
        const amount = formatMoney(child.value, locale);
        const formula = shown.length > 0 ? sentence(child) : '';
        const name =
          shown.length > 0
            ? t({
                id: 'lab.trace.node.formula',
                message: `${label} ${amount}，等於 ${formula}`,
                comment: '公式樹節點按鈕的可讀名稱（有公式的節點）；名稱、金額與代入數字的公式已代入',
              })
            : t({
                id: 'lab.trace.node.leaf',
                message: `${label} ${amount}，看來源步驟`,
                comment: '公式樹節點按鈕的可讀名稱（最底層的科目節點）；名稱與金額已代入',
              });
        const say = () =>
          onLive(
            shown.length > 0
              ? t({ id: 'lab.trace.live.formula', message: `${label}：${formula}`, comment: '展開公式樹節點時的播報；名稱與代入數字的公式已代入' })
              : t({ id: 'lab.trace.live.leaf', message: `${label} ${amount}，列出來源步驟。`, comment: '往下鑽到最底層時的播報；名稱與金額已代入' }),
          );
        return (
          <li key={child.line} className={`ll-lab-trace__item${open ? ' is-open' : ''}`} data-line={child.line}>
            <div className="ll-lab-trace__row">
              <span className="ll-lab-trace__op" aria-hidden="true">
                {i === 0 && op === '＋' ? '＝' : op}
              </span>
              <span className="ll-sr-only">
                {i === 0
                  ? op === '＋'
                    ? t({ id: 'lab.trace.op.equals', message: '等於', comment: '公式第一項前面的符號（螢幕閱讀器）' })
                    : t({ id: 'lab.trace.op.minus', message: '減', comment: '公式裡的減號（螢幕閱讀器）' })
                  : op === '＋'
                    ? t({ id: 'lab.trace.op.plus', message: '加', comment: '公式裡的加號（螢幕閱讀器）' })
                    : t({ id: 'lab.trace.op.minus', message: '減' })}{' '}
              </span>
              <span className="ll-lab-trace__name">{label}</span>
              <span className="ll-num ll-lab-trace__value">{amount}</span>
              {expandable &&
                (canNest ? (
                  <Button
                    size="sm"
                    variant="quiet"
                    className="ll-lab-trace__btn"
                    aria-expanded={open}
                    aria-label={name}
                    iconEnd={open ? <CaretDownIcon /> : <CaretRightIcon />}
                    onClick={() => {
                      setOpened((s) => {
                        const next = new Set(s);
                        if (open) next.delete(child.line);
                        else next.add(child.line);
                        return next;
                      });
                      if (!open) say();
                    }}
                    data-testid="lab-trace-expand"
                  >
                    {open
                      ? t({ id: 'lab.trace.collapse', message: '收合', comment: '公式樹節點的按鈕' })
                      : t({ id: 'lab.trace.expand', message: '展開', comment: '公式樹節點的按鈕' })}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="quiet"
                    className="ll-lab-trace__btn"
                    aria-label={name}
                    iconEnd={<CaretRightIcon />}
                    onClick={() => {
                      onDrill(child);
                      say();
                    }}
                    data-testid="lab-trace-drill"
                  >
                    {t({ id: 'lab.trace.drill', message: '往下', comment: '公式樹節點的按鈕：面板改以這個節點為主角（小螢幕或更深的層）' })}
                  </Button>
                ))}
            </div>
            {open && canNest && (
              <div className="ll-lab-trace__nested">
                {shown.length > 0 && (
                  <TraceChildren
                    parent={child}
                    items={shown}
                    depth={depth + 1}
                    run={run}
                    entriesOf={entriesOf}
                    layout={layout}
                    nested={nested}
                    onDrill={onDrill}
                    onLive={onLive}
                    sentence={sentence}
                    stepInfo={stepInfo}
                    stepHref={stepHref}
                    onNavigate={onNavigate}
                  />
                )}
                {splitChildren(child).zeros.length > 0 && (
                  <p className="ll-lab-trace__none">
                    {t({
                      id: 'lab.trace.zerosInline',
                      message: `另有 ${splitChildren(child).zeros.length} 個 0 元的項目`,
                      comment: '原地展開的節點底下 0 元項目的數量；數字已代入',
                    })}
                  </p>
                )}
                {shown.length === 0 && hasSources(child) && (
                  <TraceSources node={child} run={run} entriesOf={entriesOf} layout={layout} stepInfo={stepInfo} stepHref={stepHref} onNavigate={onNavigate} />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
