// 「這個數字從哪裡來」的來源面板（03 第 3.9 節、10 第 11.2 節，D10(c) A）：用共用的 Sheet（原生 dialog，手機底部面板、768 以上置中；
// Esc 關閉、關閉後焦點回到原本的數字）。三區：跨表對應（只有跨表數字才有，「在報表上標出」會關面板並醒目標示兩張表上的格子）、
// 公式樹（TraceTree：第一層預設展開，medium 以上最多原地縮排 3 層，更深或 compact 改成往下鑽，頂端的路徑可以回去）、來源步驟（TraceSources）。
// 指標卡的結果也能追：第一層是這個版本的分子與分母引用的線、輸入值與連鎖的指標，線往下接報表列的公式樹，連鎖的指標往下是那個指標自己的分子與分母。
// 往下鑽或按路徑之後焦點移到新的聚焦那一行（tabindex -1），並播報一句。聚焦的位置綁著目標：換目標時第一次繪製就是新目標的第一層，不等 effect。
// 數字全部來自核心（頁面傳進來的 traceLabLine 與 ratiosAfter），這裡不算任何金額。
// 這個 chunk 不靜態引用 lab-core 與 lab-stages：否則核心會被併進來、階段畫面會回到步驟頁的第一波（V24）。
// 由 lazy-trace.ts 延後載入：第一次點數字才載。
import { useLingui } from '@lingui/react/macro';
import { formatMoney, formatNumber } from '@ledgerland/i18n';
import { Button, CaretRightIcon, Sheet } from '@ledgerland/web-ui';
import { breakpoints } from '@ledgerland/tokens';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import type { LabRun, LabStep, PostedEntry, RatioResult, TraceNode, TraceWindow } from './lab-core.ts';
import type { RatioSpecLike } from './RatioList.tsx';
import { formatRatio, useFormulaText, useLabLabels } from './labels.ts';
import {
  crossLinks,
  focusDeeper,
  focusLine,
  focusRatio,
  focusTrail,
  nodeAtPath,
  ratioParts,
  startFocus,
  statementOf,
  type RatioPart,
  type ShownStatement,
  type TraceFocus,
} from './trace-model.ts';
import type { TraceSourcesProps } from './TraceSources.tsx';
import { TraceTree, useTraceText } from './TraceTree.tsx';

export type TraceTarget =
  | { readonly kind: 'line'; readonly lineId: string; readonly window: TraceWindow }
  | { readonly kind: 'ratio'; readonly ratioRef: string; readonly spec: RatioSpecLike; readonly result: RatioResult };

export interface TracePanelProps {
  open: boolean;
  onClose: () => void;
  /** 開啟面板的那個數字；關閉後焦點回到它 */
  returnFocusTo: RefObject<HTMLElement | null>;
  target: TraceTarget | null;
  run: LabRun;
  step: LabStep;
  /** lab-core 的 traceLabLine 與 entriesOfStep（由頁面傳入） */
  trace: (window: TraceWindow, lineId: string) => TraceNode;
  entriesOf: (stepId: string) => readonly PostedEntry[];
  /** 連鎖指標的規格（ratio-changes 的 ratioSpecOf，由頁面傳入）：名稱、單位、位數與公式都是來源那個版本的 */
  ratioSpec: (ratioRef: string) => RatioSpecLike | null;
  layout: Parameters<typeof useLabLabels>[0];
  stepInfo: TraceSourcesProps['stepInfo'];
  stepHref: TraceSourcesProps['stepHref'];
  /** 「在報表上標出」：要醒目標示的兩列（這一列、另一張表的那一列）、另一張表與播報的一句。畫面上沒有報表（或頁面不支援）時不傳，就沒有這顆按鈕 */
  onHighlight?: (lines: readonly [string, string], statement: ShownStatement, said: string) => void;
  /** 副標前的標記（IFRS 對照時） */
  basisTag?: ReactNode;
}

const MEDIUM_QUERY = `(min-width: ${breakpoints.medium}px)`;
function subscribeMedium(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia(MEDIUM_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
const mediumNow = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(MEDIUM_QUERY).matches;
/** medium（600px）以上：公式樹在原地縮排；以下一律往下鑽（03 第 3.9 節） */
export function useMediumUp(): boolean {
  return useSyncExternalStore(subscribeMedium, mediumNow, () => false);
}

export function useStatementNames(): Record<ShownStatement, string> {
  const { t } = useLingui();
  return {
    income_statement: t({ id: 'lab.trace.statement.is', message: '損益表', comment: '來源面板裡報表的名稱' }),
    cash_flow_indirect: t({ id: 'lab.trace.statement.cf', message: '現金流量表', comment: '來源面板裡報表的名稱' }),
    balance_sheet: t({ id: 'lab.trace.statement.bs', message: '資產負債表', comment: '來源面板裡報表的名稱' }),
  };
}

const CIRCLED: Record<2 | 3 | 4, string> = { 2: '②', 3: '③', 4: '④' };

/** 面板目前的畫面：屬於哪個目標、聚焦的位置、播報的一句。target 不是目前的目標時整份作廢（開面板、換目標的第一次繪製就是第一層） */
interface PanelView {
  readonly target: TraceTarget | null;
  readonly focus: TraceFocus;
  readonly live: string;
}

const firstView = (target: TraceTarget | null): PanelView => ({ target, focus: startFocus(target), live: '' });

export function TracePanel({
  open,
  onClose,
  returnFocusTo,
  target,
  run,
  step,
  trace,
  entriesOf,
  layout,
  stepInfo,
  stepHref,
  ratioSpec,
  onHighlight,
  basisTag,
}: TracePanelProps) {
  const { t } = useLingui();
  const { locale, lineLabel, ratioLabel } = useLabLabels(layout);
  const names = useStatementNames();
  const formulaText = useFormulaText(layout);
  const text = useTraceText(layout, run);
  const nested = useMediumUp();
  const [stored, setView] = useState<PanelView>(() => firstView(target));
  const view = stored.target === target ? stored : firstView(target);
  const { focus, live } = view;
  // 往下鑽或按路徑之後，原本的按鈕已經卸載：畫面換好再把焦點移到新的聚焦那一行，不讓它掉到 body
  const focusEl = useRef<HTMLParagraphElement>(null);
  const moveFocus = useRef(false);
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    focusEl.current?.focus();
  });
  const window: TraceWindow = target?.kind === 'line' ? target.window : 'cumulative';
  const root: TraceNode | null = useMemo(
    () => (target === null || focus.lineRoot === null ? null : trace(window, focus.lineRoot)),
    [target, focus.lineRoot, trace, window],
  );
  const node = root === null ? null : nodeAtPath(root, focus.path);
  const links = useMemo(() => crossLinks(run.ctx.layout), [run.ctx.layout]);
  if (target === null) return null;

  const order = run.story.steps.find((s) => s.id === step.id)?.order ?? step.order;
  const title =
    target.kind === 'line'
      ? `${lineLabel(target.lineId)} ${formatMoney((window === 'cumulative' ? step.after : step.change).lines.get(target.lineId)?.value ?? 0, locale)}`
      : `${ratioLabel(target.spec.id, target.spec.termRef)} ${formatRatio(target.result, target.spec.unit, locale, target.spec.displayDecimals)}`;
  const statementName = (lineId: string): string => {
    const s = statementOf(run.ctx.layout, lineId);
    return s !== null && s in names ? names[s as ShownStatement] : '';
  };
  // 英文的報表名稱是句中用的小寫（「the income statement」），放在副標開頭要大寫；中文沒有影響
  const atSentenceStart = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1);
  const subtitle =
    target.kind === 'line'
      ? window === 'cumulative'
        ? t({
            id: 'lab.trace.window.cumulative',
            message: `${atSentenceStart(statementName(target.lineId))}，累計到第 ${order} 步`,
            comment: '來源面板的副標（累計視窗）；報表名稱與步數已代入',
          })
        : t({
            id: 'lab.trace.window.transaction',
            message: `${atSentenceStart(statementName(target.lineId))}，第 ${order} 步的本筆變動`,
            comment: '來源面板的副標（本筆變動視窗）；報表名稱與步數已代入',
          })
      : t({ id: 'lab.trace.window.ratio', message: `第 ${order} 步之後`, comment: '來源面板的副標（指標）；步數已代入' });

  const values = window === 'cumulative' ? step.after : step.change;
  const resultOf = (ref: string): RatioResult | undefined =>
    target.kind === 'ratio' && ref === target.ratioRef ? target.result : step.ratiosAfter.find((r) => r.ratioRef === ref);
  const specOf = (ref: string): RatioSpecLike | null => (target.kind === 'ratio' && ref === target.ratioRef ? target.spec : ratioSpec(ref));
  const ratioName = (ref: string): string => {
    const spec = specOf(ref);
    return spec === null ? ref : ratioLabel(spec.id, spec.termRef);
  };
  const ratioValue = (ref: string): string => {
    const spec = specOf(ref);
    const r = resultOf(ref);
    return spec === null || r === undefined ? '' : formatRatio(r, spec.unit, locale, spec.displayDecimals);
  };
  // 目前看的指標：連鎖往下進過的最後一個，沒有就是目標本身
  const ratioAt = (f: TraceFocus): string | null => (target.kind !== 'ratio' ? null : (f.ratios.at(-1) ?? target.ratioRef));
  const say = (f: TraceFocus): string => {
    if (f.lineRoot !== null) {
      const n = nodeAtPath(trace(window, f.lineRoot), f.path);
      return n === null ? '' : text.announce(n);
    }
    const ref = ratioAt(f);
    const spec = ref === null ? null : specOf(ref);
    if (ref === null || spec === null) return '';
    const name = ratioName(ref);
    const shown = ratioValue(ref);
    const formula = formulaText(spec);
    return t({ id: 'lab.trace.live.ratio', message: `${name} ${shown}：${formula}`, comment: '回到或進到指標時的播報；名稱、數值與公式已代入' });
  };
  const go = (next: TraceFocus) => {
    moveFocus.current = true;
    setView({ target, focus: next, live: say(next) });
  };
  const setLive = (next: string) => setView({ target, focus, live: next });
  const lineName = (statement: ShownStatement, lineId: string): string =>
    t({ id: 'lab.trace.link', message: `${names[statement]}的${lineLabel(lineId)}`, comment: '跨表對應的一列：另一張表的名稱與列名已代入' });
  const crumbs = focusTrail(target, focus);
  const crumbLabel = (c: (typeof crumbs)[number]): string => (c.kind === 'ratio' ? ratioName(c.ref) : lineLabel(c.ref));
  const focusLinks = node === null ? [] : (links.get(node.line) ?? []);
  const ratioRef = focus.lineRoot === null ? ratioAt(focus) : null;
  const ratioShown = ratioRef === null ? null : specOf(ratioRef);
  const partRow = (p: RatioPart) => {
    if (ratioRef === null) return null;
    const drillLabel = t({ id: 'lab.trace.drill', message: '往下' });
    if (p.kind === 'line') {
      const label = lineLabel(p.ref);
      const amount = formatMoney(values.lines.get(p.ref)?.value ?? 0, locale);
      return (
        <li key={`line:${p.ref}`} className="ll-lab-trace__item" data-line={p.ref}>
          <div className="ll-lab-trace__row">
            <span className="ll-lab-trace__name">{label}</span>
            <span className="ll-num ll-lab-trace__value">{amount}</span>
            <Button
              size="sm"
              variant="quiet"
              className="ll-lab-trace__btn"
              iconEnd={<CaretRightIcon />}
              aria-label={t({
                id: 'lab.trace.node.line',
                message: `${drillLabel}：${label} ${amount}，看這個數字的公式`,
                comment: '指標面板第一層報表列按鈕的可讀名稱；按鈕上的字、名稱與金額已代入',
              })}
              onClick={() => go(focusLine(focus, p.ref))}
              data-testid="lab-trace-drill"
            >
              {drillLabel}
            </Button>
          </div>
        </li>
      );
    }
    if (p.kind === 'ratio') {
      const label = ratioName(p.ref);
      const shown = ratioValue(p.ref);
      return (
        <li key={`ratio:${p.ref}`} className="ll-lab-trace__item" data-ratio={p.ref}>
          <div className="ll-lab-trace__row">
            <span className="ll-lab-trace__name">{label}</span>
            <span className="ll-num ll-lab-trace__value">{shown}</span>
            {specOf(p.ref) !== null && (
              <Button
                size="sm"
                variant="quiet"
                className="ll-lab-trace__btn"
                iconEnd={<CaretRightIcon />}
                aria-label={t({
                  id: 'lab.trace.node.ratio',
                  message: `${drillLabel}：${label} ${shown}，看這個指標怎麼算`,
                  comment: '指標面板裡連鎖指標按鈕的可讀名稱；按鈕上的字、名稱與數值已代入',
                })}
                onClick={() => go(focusRatio(focus, p.ref))}
                data-testid="lab-trace-drill"
              >
                {drillLabel}
              </Button>
            )}
          </div>
        </li>
      );
    }
    const input = resultOf(ratioRef)?.inputs[`input.${p.ref}`];
    return (
      <li key={`input:${p.ref}`} className="ll-lab-trace__item" data-input={p.ref}>
        <div className="ll-lab-trace__row">
          <span className="ll-lab-trace__name">{ratioShown?.inputs?.[p.ref]?.label[locale] ?? p.ref}</span>
          <span className="ll-num ll-lab-trace__value">{input === undefined || input === null ? '' : formatNumber(input, locale)}</span>
        </div>
      </li>
    );
  };
  const parts = ratioShown === null ? null : ratioParts(ratioShown, run.ctx.layout);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={
        basisTag ? (
          <>
            {basisTag} {subtitle}
          </>
        ) : (
          subtitle
        )
      }
      returnFocusTo={returnFocusTo}
      className="ll-sheet--trace"
      closeLabel={t({ id: 'lab.trace.close', message: '關閉來源面板', comment: '來源面板右上關閉鈕的可讀名稱' })}
      data-testid="lab-trace"
    >
      <p className="ll-sr-only" aria-live="polite" data-testid="lab-trace-live">
        {live}
      </p>
      {crumbs.length > 1 && (
        <nav
          className="ll-lab-trace__path"
          aria-label={t({ id: 'lab.trace.path', message: '來源路徑', comment: '往下鑽之後頂端路徑的可讀名稱' })}
          data-testid="lab-trace-path"
        >
          <ol>
            {crumbs.map((c, i) =>
              i === crumbs.length - 1 ? (
                <li key={c.key} aria-current="location">
                  {crumbLabel(c)}
                </li>
              ) : (
                <li key={c.key}>
                  <Button size="sm" variant="quiet" className="ll-lab-trace__crumb" onClick={() => go(c.focus)}>
                    {crumbLabel(c)}
                  </Button>
                  <span className="ll-lab-trace__sep" aria-hidden="true">
                    ›
                  </span>
                </li>
              ),
            )}
          </ol>
        </nav>
      )}
      {focusLinks.length > 0 && node !== null && (
        <section
          className="ll-lab-trace__links"
          aria-label={t({ id: 'lab.trace.links', message: '跨表對應', comment: '來源面板第一區的名稱' })}
          data-testid="lab-trace-links"
        >
          <h3 className="ll-lab-trace__section">{t({ id: 'lab.trace.links', message: '跨表對應' })}</h3>
          <ul className="ll-lab-trace__linklist">
            {focusLinks.map((l) => (
              <li key={l.line} className="ll-lab-trace__row">
                <span className="ll-lab-trace__name">
                  {l.check === null
                    ? lineName(l.statement, l.line)
                    : t({
                        id: 'lab.trace.linkCheck',
                        message: `${names[l.statement]}的${lineLabel(l.line)}（勾稽點${CIRCLED[l.check]}）`,
                        comment: '跨表對應的一列，附五步驟的勾稽點編號：報表名稱、列名與編號已代入',
                      })}
                </span>
                <span className="ll-num ll-lab-trace__value">{formatMoney(values.lines.get(l.line)?.value ?? 0, locale)}</span>
                {onHighlight && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="ll-lab-trace__btn"
                    onClick={() => {
                      const here = statementOf(run.ctx.layout, node.line) as ShownStatement;
                      const first = lineName(here, node.line);
                      const second = lineName(l.statement, l.line);
                      onHighlight(
                        [node.line, l.line],
                        l.statement,
                        t({
                          id: 'lab.trace.marked',
                          message: `已在報表上標出${first}和${second}。`,
                          comment: '「在報表上標出」之後的播報；兩邊的報表與列名已代入',
                        }),
                      );
                      onClose();
                    }}
                    data-testid="lab-trace-highlight"
                  >
                    {t({ id: 'lab.trace.highlight', message: '在報表上標出', comment: '跨表對應的按鈕：關面板、醒目標示兩張表上的格子' })}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {node !== null ? (
        <TraceTree
          // 換節點就是新的一棵樹：原地展開的狀態不帶過去
          key={[focus.lineRoot, ...focus.path].join('/')}
          node={node}
          run={run}
          entriesOf={entriesOf}
          layout={layout}
          nested={nested}
          onDrill={(trail) => go(focusDeeper(focus, trail))}
          onLive={setLive}
          focusRef={focusEl}
          stepInfo={stepInfo}
          stepHref={stepHref}
          onNavigate={onClose}
        />
      ) : parts !== null && ratioRef !== null && ratioShown !== null ? (
        <div className="ll-lab-trace__tree" data-testid="lab-trace-tree">
          <h3 className="ll-lab-trace__section">{t({ id: 'lab.trace.formula', message: '公式' })}</h3>
          <p ref={focusEl} className="ll-lab-trace__focus" tabIndex={-1} data-testid="lab-trace-focus">
            <span className="ll-lab-trace__name">{ratioName(ratioRef)}</span> <span className="ll-num ll-lab-trace__value">{ratioValue(ratioRef)}</span>
          </p>
          <p className="ll-lab-trace__formula">{formulaText(ratioShown)}</p>
          {parts.expr.length > 0 ? (
            <ul className="ll-lab-trace__list ll-lab-trace__list--1">{parts.expr.map(partRow)}</ul>
          ) : (
            <>
              <p className="ll-lab-trace__part">{t({ id: 'lab.trace.numerator', message: '分子', comment: '指標公式的分子' })}</p>
              <ul className="ll-lab-trace__list ll-lab-trace__list--1">{parts.numerator.map(partRow)}</ul>
              <p className="ll-lab-trace__part">{t({ id: 'lab.trace.denominator', message: '分母', comment: '指標公式的分母' })}</p>
              <ul className="ll-lab-trace__list ll-lab-trace__list--1">{parts.denominator.map(partRow)}</ul>
            </>
          )}
        </div>
      ) : null}
    </Sheet>
  );
}
