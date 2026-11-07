// 指標實驗室 /lab/ratios/（03 第 3.10 節）：目前帳本（故事走到的那一步，沒走過就是第 18 步）的全部指標，依六大類分組，
// 可以切換版本（只影響顯示，不存設定）；每張卡有公式、代入值、狀態與原因；N/A 的卡提供「想讓它變得可以計算？」的建議（連到自由實驗）。
// 杜邦拆解：ROE ＝ 純益率 × 資產週轉率 × 權益倍數，三個因子即時代入。字串在第三層 catalog。
import { Trans, useLingui } from '@lingui/react/macro';
import { useMemo, useRef, useState } from 'react';
import { localePath } from '@ledgerland/i18n';
import { Button, ErrorState, Segmented, ToastRegion, TopBar } from '@ledgerland/web-ui';
import { formatRatio, useLabLabels } from '../features/lab/labels.ts';
import { loadTracePanel, tracePanelNow, type TraceViews } from '../features/lab/lazy-trace.ts';
import { RatioCard, type RatioChange } from '../features/lab/RatioList.tsx';
import type { TraceTarget } from '../features/lab/TracePanel.tsx';
import { TraceLoadToast } from '../features/lab/TraceLoadToast.tsx';
import { CATEGORY_ORDER, RATIO_VERSIONS, ratioChanges, ratioSpecOf, type RatioVersionId } from '../features/lab/ratio-changes.ts';
import { useLabStory } from '../features/lab/useLab.ts';
import { BasisBanner, BasisNote } from '../features/lab/BasisBanner.tsx';
import { LabTag } from '../features/lab/LabTag.tsx';
import { IFRS_POLICY } from '../features/lab/lab-policy.ts';
import { useLabView } from '../features/lab/lab-view.ts';
import { PolicyToggle } from '../features/lab/PolicyToggle.tsx';
import { TermsProvider, useTerms } from '../features/quiz/terms.tsx';
import { useFirstStoryId } from '../features/lab/useFirstStory.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import { useLabBack } from '../features/lab/useLabBack.ts';
import '../styles/lab.css';

export function useCategoryLabels(): Record<string, string> {
  const { t } = useLingui();
  return {
    financial_structure: t({ id: 'lab.cat.financialStructure', message: '資產結構', comment: '指標類別' }),
    cash_flow: t({ id: 'lab.cat.cashFlow', message: '現金流量', comment: '指標類別' }),
    activity: t({ id: 'lab.cat.activity', message: '經營能力', comment: '指標類別' }),
    leverage: t({ id: 'lab.cat.leverage', message: '槓桿度', comment: '指標類別' }),
    profitability: t({ id: 'lab.cat.profitability', message: '獲利能力', comment: '指標類別' }),
    solvency: t({ id: 'lab.cat.solvency', message: '償債能力', comment: '指標類別' }),
    dupont: t({ id: 'lab.cat.dupont', message: '杜邦拆解', comment: '指標類別' }),
    income_structure: t({ id: 'lab.cat.incomeStructure', message: '損益結構比率', comment: '指標類別' }),
    department: t({ id: 'lab.cat.department', message: '部門指標', comment: '指標類別' }),
    market: t({ id: 'lab.cat.market', message: '市場指標', comment: '指標類別' }),
  };
}

export function useVersionLabels(): Record<RatioVersionId, string> {
  const { t } = useLingui();
  return {
    excel: t({ id: 'lab.version.excel', message: 'Excel 版', comment: '指標版本' }),
    slides03: t({ id: 'lab.version.slides03', message: '0-3 投影片', comment: '指標版本' }),
    slides02: t({ id: 'lab.version.slides02', message: '0-2 投影片', comment: '指標版本' }),
    dupont: t({ id: 'lab.version.dupont', message: '杜邦', comment: '指標版本' }),
    slides01: t({ id: 'lab.version.slides01', message: '0-1 投影片', comment: '指標版本' }),
  };
}

export default function LabRatios() {
  const locale = useLocale();
  const { t } = useLingui();
  const back = useLabBack();
  const storyId = useFirstStoryId();
  const lab = useLabStory(storyId ?? undefined, locale);
  usePageReady(storyId === undefined || lab.kind !== 'loading');
  const href = (p: string) => localePath(locale, p);
  const top = (
    <TopBar
      title={t({ id: 'lab.ratios.title', message: '指標實驗室', comment: '頁面標題' })}
      backHref={href('/lab/')}
      backLabel={back.label}
      backShortLabel={back.short}
    />
  );
  if (storyId === undefined)
    return (
      <>
        {top}
        <ErrorState title={t({ id: 'lab.none.title', message: '目前沒有已發布的故事', comment: '快照裡沒有故事時' })} />
      </>
    );
  if (lab.kind === 'error')
    return (
      <>
        {top}
        <ErrorState title={t({ id: 'lab.error.title', message: '讀不到實驗室的故事', comment: '實驗室離線時的錯誤標題' })} onRetry={lab.retry} />
      </>
    );
  if (lab.kind !== 'ok') return top;
  return (
    <TermsProvider locale={locale}>
      {top}
      <RatiosBody lab={lab} />
    </TermsProvider>
  );
}

function RatiosBody({ lab }: { lab: Extract<ReturnType<typeof useLabStory>, { kind: 'ok' }> }) {
  const { t } = useLingui();
  const locale = useLocale();
  const [version, setVersion] = useState<RatioVersionId>('excel');
  const { ready } = useTerms();
  const categories = useCategoryLabels();
  const versions = useVersionLabels();
  // 報表口徑（03 第 3.13 節）：教材的重播一直都有（對照的基準）；切到 IFRS 對照時另以 ifrs@1 重播，指標用它的三表重算，結果不同的卡另列教材口徑
  const labView = useLabView();
  const ifrs = labView.policy === IFRS_POLICY;
  const baseRun = useMemo(() => lab.core.replayLab(lab.core.asCoreStory(lab.story)), [lab]);
  const ifrsRun = useMemo(() => (ifrs ? lab.core.replayLab(lab.core.asCoreStory(lab.story), [], IFRS_POLICY) : null), [lab, ifrs]);
  if (!baseRun.ok) throw new Error(`故事重播失敗：${baseRun.error.code}`);
  if (ifrsRun && !ifrsRun.ok) throw new Error(`故事以 IFRS 對照重播失敗：${ifrsRun.error.code}`);
  const run = ifrsRun ?? baseRun;
  const current = lab.progress.state?.stepId;
  const index = current ? run.value.stepIds.indexOf(current) : -1;
  const stepIndex = index >= 0 ? index : run.value.stepIds.length - 1;
  const step = run.value.step(stepIndex);
  const baseStep = baseRun.value.step(stepIndex);
  const spec = lab.story.steps.find((s) => s.id === step.id)!;
  // 一個版本約 23 到 43 張卡的對應，每次重繪算一次就好（ratiosAfter 本身已由核心快取）
  const items = ratioChanges(lab.core, version, null, step.ratiosAfter);
  const layout = run.value.ctx.layout;
  const { ratioLabel } = useLabLabels(layout);
  usePageReady(ready);
  // 來源面板（M4b）：點指標卡的結果，第一層是分子與分母，再往下接報表列的公式樹
  const [trace, setTrace] = useState<TraceTarget | null>(null);
  const [traceViews, setTraceViews] = useState<TraceViews | null>(() => tracePanelNow());
  const traceReturn = useRef<HTMLElement | null>(null);
  // 面板的模組載入失敗：記著剛才要開的卡，提示裡的「再試一次」帶著它重開
  const [traceFailed, setTraceFailed] = useState<{ item: RatioChange; el: HTMLElement; retried: boolean } | null>(null);
  const openTrace = (item: RatioChange, el: HTMLElement, retried = false) => {
    traceReturn.current = el;
    setTraceFailed(null);
    setTrace({ kind: 'ratio', ratioRef: item.ratioRef, spec: item.spec, result: item.after });
    if (traceViews === null)
      loadTracePanel().then(setTraceViews, () => {
        setTrace(null);
        setTraceFailed({ item, el, retried });
      });
  };
  const groups = CATEGORY_ORDER.map((c) => ({ category: c, items: items.filter((i) => i.spec.category === c) })).filter((g) => g.items.length > 0);
  const suggestionFor = (item: RatioChange) => {
    if (item.after.status !== 'na') return undefined;
    const key = item.after.reason?.key;
    const needsLiabilities = key === 'ratio.reason.denominator_zero' && (item.spec.denominator ?? '').includes('liabilities');
    return (
      <p className="ll-lab-ratio__suggest">
        <Trans id="lab.ratio.suggest" comment="N/A 的指標卡的建議">
          想讓它變得可以計算？到自由實驗試試看。
        </Trans>{' '}
        <Button size="sm" variant="quiet" href={localePath(locale, needsLiabilities ? '/lab/sandbox/?insert=tpl.borrow_short_term' : '/lab/sandbox/')}>
          {needsLiabilities
            ? t({ id: 'lab.ratio.suggest.borrow', message: '向銀行短期借款', comment: '建議插入的範本' })
            : t({ id: 'lab.ratio.suggest.open', message: '開啟自由實驗', comment: '建議的按鈕' })}
        </Button>
      </p>
    );
  };
  // 杜邦樹（03 第 3.10 節）：ROE ＝ 純益率 × 資產週轉率 × 權益倍數，因子各自取登錄檔裡有定義的版本（三個因子沒有 dupont 版），和版本切換無關
  const dupontRefs = ['roe@dupont', 'net_profit_margin@excel', 'total_asset_turnover@excel', 'equity_multiplier@slides02'];
  const dupont = dupontRefs.map((ref) => {
    const r = step.ratiosAfter.find((x) => x.ratioRef === ref);
    const v = lab.core.ratioRegistry().versions.get(ref);
    const def = lab.core.ratioDefinitions.find((d) => d.id === ref.split('@')[0]);
    return r && v && def ? { ref, label: ratioLabel(def.id, def.termRef), value: formatRatio(r, v.spec.unit, locale, v.spec.displayDecimals) } : null;
  });
  return (
    <>
      <p className="ll-lab-ratios__context" data-testid="lab-ratios-context">
        {t({
          id: 'lab.ratios.context',
          message: `目前帳本：${lab.story.company.name}，第 ${spec.order} 步之後`,
          comment: '指標實驗室的帳本說明；公司與數字已代入',
        })}
      </p>
      <div className="ll-lab-ratios__controls" data-policy={run.value.policyId}>
        <Segmented
          value={version}
          options={RATIO_VERSIONS.map((v) => ({ value: v, label: versions[v] }))}
          onChange={setVersion}
          label={t({ id: 'lab.ratios.version', message: '指標版本', comment: '版本切換的名稱' })}
          size="sm"
        />
        <PolicyToggle value={labView.policy} onChange={labView.setPolicy} />
      </div>
      {/* 卡片數十張：橫幅固定在頁面上方，捲到哪張卡都看得到（03 第 3.10 節的卡片標示由這條固定橫幅滿足） */}
      {ifrs && <BasisBanner className="ll-lab-basis--sticky" />}
      {ifrs && <BasisNote />}
      {dupont.every((d) => d !== null) && (
        <p className="ll-lab-dupont" data-testid="lab-dupont">
          <span className="ll-lab-dupont__title">
            {t({ id: 'lab.ratios.dupont', message: '杜邦拆解', comment: '杜邦樹的標題' })}
            {locale === 'en' ? ': ' : '：'}
          </span>
          {dupont.map((d, i) => (
            <span key={d!.ref} className="ll-lab-dupont__factor">
              {i === 1 ? ' ＝ ' : i > 1 ? ' × ' : ''}
              {d!.label} {d!.value}
            </span>
          ))}
        </p>
      )}
      {groups.map((g) => (
        <section key={g.category} className="ll-lab-ratio-group" aria-labelledby={`ll-lab-cat-${g.category}`}>
          <h2 id={`ll-lab-cat-${g.category}`} className="ll-lab-ratio-group__title">
            {categories[g.category] ?? g.category}
          </h2>
          <ul className="ll-lab-ratios__list">
            {g.items.map((item) => (
              <RatioCard
                key={item.ratioRef}
                item={item}
                layout={layout}
                suggestion={suggestionFor(item)}
                onTrace={openTrace}
                compare={ifrs ? baseStep.ratiosAfter.find((r) => r.ratioRef === item.ratioRef) : undefined}
              />
            ))}
          </ul>
        </section>
      ))}
      {traceViews && (
        <traceViews.TracePanel
          open={trace !== null}
          onClose={() => setTrace(null)}
          returnFocusTo={traceReturn}
          target={trace}
          run={run.value}
          step={step}
          trace={(window, lineId) => lab.core.traceLabLine(run.value, step, window, lineId)}
          entriesOf={(id) => lab.core.entriesOfStep(run.value, id)}
          ratioSpec={(ref) => ratioSpecOf(lab.core, ref)}
          layout={layout}
          basisTag={ifrs ? <LabTag kind="ifrs" testId="lab-trace-basis" /> : undefined}
          stepInfo={(id) => {
            const s = lab.story.steps.find((x) => x.id === id);
            return s === undefined ? undefined : { order: s.order, title: s.title };
          }}
          stepHref={(id) => (lab.story.steps.some((x) => x.id === id) ? localePath(locale, `/lab/story/${lab.story.id}/${id}/`) : null)}
        />
      )}
      <ToastRegion className="ll-float-toasts" data-testid="lab-ratios-toasts">
        {traceFailed && (
          <TraceLoadToast
            retried={traceFailed.retried}
            onRetry={() => {
              // 提示裡的按鈕馬上要卸載：焦點先回到那個數字
              traceFailed.el.focus();
              openTrace(traceFailed.item, traceFailed.el, true);
            }}
            onDismiss={() => setTraceFailed(null)}
          />
        )}
      </ToastRegion>
    </>
  );
}
