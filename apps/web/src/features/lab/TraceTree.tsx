// 來源面板第二區的公式樹（03 第 3.9 節）：以目前聚焦的節點為主角，列出它的公式與每個子節點（運算符號、名稱、金額）。
// 子節點還能再拆時有一顆按鈕：medium 以上最多同時縮排 3 層（展開在原地，aria-expanded），更深或 compact 改成「往下鑽」（面板改以那個節點為主角，
// 頂端的路徑可以回去）。0 元而且沒有任何來源的子節點收在「其他 0 元的項目」，原地展開的層也一樣。
// 同時有子節點與科目層的列（有股利的未分配盈餘）在子節點後面多列科目那一部分，公式才加得起來，來源步驟也列在下面。最底層的科目節點列出來源步驟（TraceSources）。
// 樹是巢狀清單加按鈕，不用 role="tree"（Tab 在按鈕間移動，Enter 或 Space 展開）。按鈕的可讀名稱以畫面上的字開頭（WCAG 2.5.3）。數字全部來自核心的追蹤樹，不自己算。
import { useLingui } from '@lingui/react/macro';
import { formatMoney } from '@ledgerland/i18n';
import { Button, CaretDownIcon, CaretRightIcon, Disclosure } from '@ledgerland/web-ui';
import { useState, type RefObject } from 'react';
import type { LabRun, TraceNode } from './lab-core.ts';
import { useLabLabels } from './labels.ts';
import { childOperators, hasSources, ownParts, splitChildren, type TraceOperator } from './trace-model.ts';
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
  /** 往下鑽：trail 是從聚焦的節點走到那個子節點的完整路徑（原地展開的第 3 層有好幾段） */
  onDrill: (trail: readonly string[]) => void;
  /** 展開或收合時播報的一句 */
  onLive: (text: string) => void;
  /** 聚焦那一行：往下鑽或按路徑之後焦點移到這裡（tabindex -1） */
  focusRef: RefObject<HTMLParagraphElement | null>;
  stepInfo: TraceSourcesProps['stepInfo'];
  stepHref: TraceSourcesProps['stepHref'];
  onNavigate?: () => void;
}

/** 公式樹的文字：一層代入數字的公式（「營業毛利 90,000 － 銷管費用 42,000」，科目層也算一項）與播報的一句 */
export function useTraceText(layout: Parameters<typeof useLabLabels>[0], run: LabRun) {
  const { t } = useLingui();
  const { locale, lineLabel, accountLabel } = useLabLabels(layout);
  const accountPart = (account: string): string => {
    const name = accountLabel(account, run.ctx.chart.byId.get(account)?.labels.teacher);
    return t({ id: 'lab.trace.accountPart', message: `${name}科目`, comment: '公式裡科目本身那一項（例如未分配盈餘裡本期淨利以外的部分）；科目名稱已代入' });
  };
  const sentence = (node: TraceNode): string => {
    const ops = childOperators(node);
    const { shown } = splitChildren(node);
    const lines = shown.map(
      (c, i) => `${i === 0 && ops.get(c.line) === '＋' ? '' : `${ops.get(c.line) ?? '＋'} `}${lineLabel(c.line)} ${formatMoney(c.value, locale)}`,
    );
    const own = ownParts(node).map((p) => `${p.op} ${accountPart(p.account)} ${formatMoney(Math.abs(p.amount), locale)}`);
    return [...lines, ...own].join(' ');
  };
  /** 這個節點成為主角或展開時播報的一句 */
  const announce = (node: TraceNode): string => {
    const label = lineLabel(node.line);
    const amount = formatMoney(node.value, locale);
    if (splitChildren(node).shown.length > 0) {
      const formula = sentence(node);
      return t({ id: 'lab.trace.live.formula', message: `${label}：${formula}`, comment: '展開公式樹節點或往下鑽時的播報；名稱與代入數字的公式已代入' });
    }
    return hasSources(node)
      ? t({ id: 'lab.trace.live.leaf', message: `${label} ${amount}，列出來源步驟。`, comment: '往下鑽到最底層時的播報；名稱與金額已代入' })
      : t({ id: 'lab.trace.live.plain', message: `${label} ${amount}。`, comment: '往下鑽到沒有來源的列時的播報；名稱與金額已代入' });
  };
  return { sentence, announce, accountPart };
}

type TraceText = ReturnType<typeof useTraceText>;

export function TraceTree({ node, run, entriesOf, layout, nested, onDrill, onLive, focusRef, stepInfo, stepHref, onNavigate }: TraceTreeProps) {
  const { t } = useLingui();
  const { locale, lineLabel } = useLabLabels(layout);
  const text = useTraceText(layout, run);
  const { shown, zeros } = splitChildren(node);
  return (
    <div className="ll-lab-trace__tree" data-testid="lab-trace-tree">
      <h3 className="ll-lab-trace__section">{t({ id: 'lab.trace.formula', message: '公式', comment: '來源面板第二區的標題' })}</h3>
      <p ref={focusRef} className="ll-lab-trace__focus" tabIndex={-1} data-testid="lab-trace-focus">
        <span className="ll-lab-trace__name">{lineLabel(node.line)}</span> <span className="ll-num ll-lab-trace__value">{formatMoney(node.value, locale)}</span>
      </p>
      {shown.length > 0 && (
        <TraceChildren
          parent={node}
          items={shown}
          trail={[]}
          depth={1}
          run={run}
          entriesOf={entriesOf}
          layout={layout}
          nested={nested}
          onDrill={onDrill}
          onLive={onLive}
          text={text}
          stepInfo={stepInfo}
          stepHref={stepHref}
          onNavigate={onNavigate}
        />
      )}
      {zeros.length > 0 && <ZeroItems zeros={zeros} layout={layout} />}
      {hasSources(node) && (
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

/** 金額是 0 而且沒有來源的子節點：收成一個可以展開的清單，聚焦的層與原地展開的層同一個樣子 */
function ZeroItems({ zeros, layout }: { zeros: readonly TraceNode[]; layout: TraceTreeProps['layout'] }) {
  const { t } = useLingui();
  const { lineLabel } = useLabLabels(layout);
  return (
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
  );
}

/** 一列公式前面的運算符號：第一項的加號畫成等號；螢幕閱讀器讀字 */
function RowOperator({ first, op }: { first: boolean; op: TraceOperator }) {
  const { t } = useLingui();
  return (
    <>
      <span className="ll-lab-trace__op" aria-hidden="true">
        {first && op === '＋' ? '＝' : op}
      </span>
      <span className="ll-sr-only">
        {first
          ? op === '＋'
            ? t({ id: 'lab.trace.op.equals', message: '等於', comment: '公式第一項前面的符號（螢幕閱讀器）' })
            : t({ id: 'lab.trace.op.minus', message: '減', comment: '公式裡的減號（螢幕閱讀器）' })
          : op === '＋'
            ? t({ id: 'lab.trace.op.plus', message: '加', comment: '公式裡的加號（螢幕閱讀器）' })
            : t({ id: 'lab.trace.op.minus', message: '減' })}{' '}
      </span>
    </>
  );
}

interface ChildrenProps {
  parent: TraceNode;
  items: readonly TraceNode[];
  /** 從聚焦的節點走到 parent 的路徑（聚焦那一層是空的） */
  trail: readonly string[];
  depth: number;
  run: LabRun;
  entriesOf: TraceSourcesProps['entriesOf'];
  layout: Parameters<typeof useLabLabels>[0];
  nested: boolean;
  onDrill: (trail: readonly string[]) => void;
  onLive: (text: string) => void;
  text: TraceText;
  stepInfo: TraceSourcesProps['stepInfo'];
  stepHref: TraceSourcesProps['stepHref'];
  onNavigate?: () => void;
}

function TraceChildren({ parent, items, trail, depth, run, entriesOf, layout, nested, onDrill, onLive, text, stepInfo, stepHref, onNavigate }: ChildrenProps) {
  const { t } = useLingui();
  const { locale, lineLabel } = useLabLabels(layout);
  const ops = childOperators(parent);
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const canNest = nested && depth < NEST_LIMIT;
  const own = ownParts(parent);
  return (
    <ul className={`ll-lab-trace__list ll-lab-trace__list--${depth}`}>
      {items.map((child, i) => {
        const op: TraceOperator = ops.get(child.line) ?? '＋';
        const { shown, zeros } = splitChildren(child);
        const expandable = shown.length > 0 || hasSources(child);
        const open = opened.has(child.line);
        const label = lineLabel(child.line);
        const amount = formatMoney(child.value, locale);
        const formula = shown.length > 0 ? text.sentence(child) : '';
        // 畫面上的字放在可讀名稱的開頭（WCAG 2.5.3）
        const action = !canNest
          ? t({ id: 'lab.trace.drill', message: '往下', comment: '公式樹節點的按鈕：面板改以這個節點為主角（小螢幕或更深的層）' })
          : open
            ? t({ id: 'lab.trace.collapse', message: '收合', comment: '公式樹節點的按鈕' })
            : t({ id: 'lab.trace.expand', message: '展開', comment: '公式樹節點的按鈕' });
        const name =
          shown.length > 0
            ? t({
                id: 'lab.trace.node.formula',
                message: `${action}：${label} ${amount}，等於 ${formula}`,
                comment: '公式樹節點按鈕的可讀名稱（有公式的節點）；按鈕上的字、名稱、金額與代入數字的公式已代入',
              })
            : t({
                id: 'lab.trace.node.leaf',
                message: `${action}：${label} ${amount}，看來源步驟`,
                comment: '公式樹節點按鈕的可讀名稱（最底層的科目節點）；按鈕上的字、名稱與金額已代入',
              });
        const toggle = () => {
          setOpened((s) => {
            const next = new Set(s);
            if (open) next.delete(child.line);
            else next.add(child.line);
            return next;
          });
          onLive(
            open ? t({ id: 'lab.trace.live.collapsed', message: `已收合${label}。`, comment: '收合公式樹節點時的播報；名稱已代入' }) : text.announce(child),
          );
        };
        return (
          <li key={child.line} className={`ll-lab-trace__item${open ? ' is-open' : ''}`} data-line={child.line}>
            <div className="ll-lab-trace__row">
              <RowOperator first={i === 0} op={op} />
              <span className="ll-lab-trace__name">{label}</span>
              <span className="ll-num ll-lab-trace__value">{amount}</span>
              {expandable && (
                <Button
                  size="sm"
                  variant="quiet"
                  className="ll-lab-trace__btn"
                  aria-expanded={canNest ? open : undefined}
                  aria-label={name}
                  iconEnd={canNest && open ? <CaretDownIcon /> : <CaretRightIcon />}
                  onClick={canNest ? toggle : () => onDrill([...trail, child.line])}
                  data-testid={canNest ? 'lab-trace-expand' : 'lab-trace-drill'}
                >
                  {action}
                </Button>
              )}
            </div>
            {open && canNest && (
              <div className="ll-lab-trace__nested">
                {shown.length > 0 && (
                  <TraceChildren
                    parent={child}
                    items={shown}
                    trail={[...trail, child.line]}
                    depth={depth + 1}
                    run={run}
                    entriesOf={entriesOf}
                    layout={layout}
                    nested={nested}
                    onDrill={onDrill}
                    onLive={onLive}
                    text={text}
                    stepInfo={stepInfo}
                    stepHref={stepHref}
                    onNavigate={onNavigate}
                  />
                )}
                {zeros.length > 0 && <ZeroItems zeros={zeros} layout={layout} />}
                {hasSources(child) && (
                  <TraceSources node={child} run={run} entriesOf={entriesOf} layout={layout} stepInfo={stepInfo} stepHref={stepHref} onNavigate={onNavigate} />
                )}
              </div>
            )}
          </li>
        );
      })}
      {own.map((p) => (
        <li key={`account:${p.account}`} className="ll-lab-trace__item" data-account={p.account}>
          <div className="ll-lab-trace__row">
            <RowOperator first={false} op={p.op} />
            <span className="ll-lab-trace__name">{text.accountPart(p.account)}</span>
            <span className="ll-num ll-lab-trace__value">{formatMoney(Math.abs(p.amount), locale)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
