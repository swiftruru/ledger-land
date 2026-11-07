// 「這個數字從哪裡來」的來源面板（03 第 3.9 節、10 第 11.2 節，D10(c) A）：用共用的 Sheet（原生 dialog，手機底部面板、768 以上置中；
// Esc 關閉、關閉後焦點回到原本的數字）。三區：跨表對應（只有跨表數字才有，「在報表上標出」會關面板並醒目標示兩張表上的格子）、
// 公式樹（TraceTree：第一層預設展開，medium 以上最多原地縮排 3 層，更深或 compact 改成往下鑽，頂端的路徑可以回去）、來源步驟（TraceSources）。
// 指標卡的結果也能追：第一層是這個版本的分子與分母引用的線，往下接報表列的公式樹。數字全部來自核心（頁面傳進來的 traceLabLine），這裡不算任何金額。
// 這個 chunk 不靜態引用 lab-core 與 lab-stages：否則核心會被併進來、階段畫面會回到步驟頁的第一波（V24）。
// 由 lazy-trace.ts 延後載入：第一次點數字才載。
import { useLingui } from '@lingui/react/macro';
import { formatMoney } from '@ledgerland/i18n';
import { Button, CaretRightIcon, Sheet } from '@ledgerland/web-ui';
import { breakpoints } from '@ledgerland/tokens';
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import type { LabRun, LabStep, PostedEntry, RatioResult, TraceNode, TraceWindow } from './lab-core.ts';
import type { RatioSpecLike } from './RatioList.tsx';
import { formatRatio, useFormulaText, useLabLabels } from './labels.ts';
import { crossLinks, nodeAtPath, ratioParts, statementOf, type RatioPart, type ShownStatement } from './trace-model.ts';
import type { TraceSourcesProps } from './TraceSources.tsx';
import { TraceTree, useFormulaSentence } from './TraceTree.tsx';

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
  layout: Parameters<typeof useLabLabels>[0];
  stepInfo: TraceSourcesProps['stepInfo'];
  stepHref: TraceSourcesProps['stepHref'];
  /** 「在報表上標出」：兩張表上要醒目標示的列與另一張表 */
  onHighlight?: (lines: readonly string[], statement: ShownStatement) => void;
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

/** 聚焦的位置：lineRoot 是公式樹的根（指標目標一開始是 null，鑽進某條線後才有），path 是根之後每一層的線 ID */
interface Focus {
  readonly lineRoot: string | null;
  readonly path: readonly string[];
}

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
  onHighlight,
  basisTag,
}: TracePanelProps) {
  const { t } = useLingui();
  const { locale, lineLabel, ratioLabel } = useLabLabels(layout);
  const names = useStatementNames();
  const formulaText = useFormulaText(layout);
  const sentence = useFormulaSentence(layout);
  const nested = useMediumUp();
  const [focus, setFocus] = useState<Focus>({ lineRoot: null, path: [] });
  const [live, setLive] = useState('');
  // 換目標就回到第一層
  useEffect(() => {
    setFocus({ lineRoot: target?.kind === 'line' ? target.lineId : null, path: [] });
    setLive('');
  }, [target]);
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
  const subtitle =
    target.kind === 'line'
      ? window === 'cumulative'
        ? t({
            id: 'lab.trace.window.cumulative',
            message: `${statementName(target.lineId)}，累計到第 ${order} 步`,
            comment: '來源面板的副標（累計視窗）；報表名稱與步數已代入',
          })
        : t({
            id: 'lab.trace.window.transaction',
            message: `${statementName(target.lineId)}，第 ${order} 步的本筆變動`,
            comment: '來源面板的副標（本筆變動視窗）；報表名稱與步數已代入',
          })
      : t({ id: 'lab.trace.window.ratio', message: `第 ${order} 步之後`, comment: '來源面板的副標（指標）；步數已代入' });

  // 路徑：目標本身、（指標目標鑽進的線）、往下鑽的每一層
  const crumbs: { key: string; label: string; focus: Focus }[] = [];
  if (target.kind === 'ratio') crumbs.push({ key: 'ratio', label: ratioLabel(target.spec.id, target.spec.termRef), focus: { lineRoot: null, path: [] } });
  if (focus.lineRoot !== null) {
    crumbs.push({ key: `root:${focus.lineRoot}`, label: lineLabel(focus.lineRoot), focus: { lineRoot: focus.lineRoot, path: [] } });
    focus.path.forEach((id, i) =>
      crumbs.push({ key: `p:${i}:${id}`, label: lineLabel(id), focus: { lineRoot: focus.lineRoot, path: focus.path.slice(0, i + 1) } }),
    );
  }
  const drill = (child: TraceNode) => setFocus((f) => ({ lineRoot: f.lineRoot, path: [...f.path, child.line] }));
  const drillLine = (lineId: string) => {
    setFocus({ lineRoot: lineId, path: [] });
    setLive(
      t({
        id: 'lab.trace.live.line',
        message: `${lineLabel(lineId)}：${sentence(trace('cumulative', lineId))}`,
        comment: '從指標鑽進報表列時的播報；名稱與代入數字的公式已代入',
      }),
    );
  };
  const focusLinks = node === null ? [] : (links.get(node.line) ?? []);
  const values = window === 'cumulative' ? step.after : step.change;
  const ratioTarget = target.kind === 'ratio' ? target : null;
  const partRow = (p: RatioPart) => {
    if (ratioTarget === null) return null;
    if (p.kind === 'line')
      return (
        <li key={`line:${p.ref}`} className="ll-lab-trace__item" data-line={p.ref}>
          <div className="ll-lab-trace__row">
            <span className="ll-lab-trace__name">{lineLabel(p.ref)}</span>
            <span className="ll-num ll-lab-trace__value">{formatMoney(values.lines.get(p.ref)?.value ?? 0, locale)}</span>
            <Button
              size="sm"
              variant="quiet"
              className="ll-lab-trace__btn"
              iconEnd={<CaretRightIcon />}
              aria-label={t({
                id: 'lab.trace.node.line',
                message: `${lineLabel(p.ref)} ${formatMoney(values.lines.get(p.ref)?.value ?? 0, locale)}，看這個數字的公式`,
                comment: '指標面板第一層報表列按鈕的可讀名稱；名稱與金額已代入',
              })}
              onClick={() => drillLine(p.ref)}
              data-testid="lab-trace-drill"
            >
              {t({ id: 'lab.trace.drill', message: '往下' })}
            </Button>
          </div>
        </li>
      );
    if (p.kind === 'ratio') {
      const r = step.ratiosAfter.find((x) => x.ratioRef === p.ref);
      const [id] = p.ref.split('@');
      return (
        <li key={`ratio:${p.ref}`} className="ll-lab-trace__item">
          <div className="ll-lab-trace__row">
            <span className="ll-lab-trace__name">{ratioLabel(id ?? p.ref)}</span>
            <span className="ll-num ll-lab-trace__value">{r ? formatRatio(r, ratioTarget.spec.unit, locale, ratioTarget.spec.displayDecimals) : ''}</span>
          </div>
        </li>
      );
    }
    return (
      <li key={`input:${p.ref}`} className="ll-lab-trace__item">
        <div className="ll-lab-trace__row">
          <span className="ll-lab-trace__name">
            {p.ref === 'par_value' ? t({ id: 'lab.trace.input.parValue', message: '每股面額', comment: '指標的輸入值名稱' }) : p.ref}
          </span>
          <span className="ll-num ll-lab-trace__value">{ratioTarget.result.inputs[`input.${p.ref}`] ?? ''}</span>
        </div>
      </li>
    );
  };
  const parts = ratioTarget === null ? null : ratioParts(ratioTarget.spec);
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
                  {c.label}
                </li>
              ) : (
                <li key={c.key}>
                  <Button size="sm" variant="quiet" className="ll-lab-trace__crumb" onClick={() => setFocus(c.focus)}>
                    {c.label}
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
                    ? t({ id: 'lab.trace.link', message: `${names[l.statement]}的${lineLabel(l.line)}`, comment: '跨表對應的一列：另一張表的名稱與列名已代入' })
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
                      onHighlight([node.line, l.line], l.statement);
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
          node={node}
          run={run}
          entriesOf={entriesOf}
          layout={layout}
          nested={nested}
          onDrill={drill}
          onLive={setLive}
          stepInfo={stepInfo}
          stepHref={stepHref}
          onNavigate={onClose}
        />
      ) : parts !== null ? (
        <div className="ll-lab-trace__tree" data-testid="lab-trace-tree">
          <h3 className="ll-lab-trace__section">{t({ id: 'lab.trace.formula', message: '公式' })}</h3>
          <p className="ll-lab-trace__focus">{ratioTarget === null ? '' : formulaText(ratioTarget.spec)}</p>
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
