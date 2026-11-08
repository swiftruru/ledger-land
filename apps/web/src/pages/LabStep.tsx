// 故事步驟頁 /lab/story/<storyId>/<stepId>/（02 第 1.1 節、03 第 3.1、3.3 到 3.6、3.11、3.12 節）：由「下一步」推進。
// 兩種模式（03 第 3.1 節）：練習（預設，10 個階段含預測與揭曉，第一次練要逐階段看）與示範（?mode=demo，9 個階段沒有預測，隨時可跳階段）；
// 兩種走完都記成走完、故事進度只往前；階段選單可以互換模式（回到交易卡）。
// 整頁等故事快照與進度齊了才出現；核心的重播模組與內建資料（約 42 KB gzip）和名詞索引（約 10 KB）都不在第一波（06 第 8.2 節、14 的 V24）：
// 階段 1 的列名與名詞 chip 用快照裡的名稱（firstPaint.lines、firstPaint.terms，建置時已換成名詞的名稱），名詞索引在掀開之後才讀；
// 交易卡、恆等式與預測面板先用快照裡建置時由同一份核心算好的數字與列名（firstPaint）畫，核心在畫面掀開之後才載入（afterFirstPaint），
// 載好以後每個數字都來自 lab-core.ts 的結果；階段 2 到 10 的畫面元件（stage-views.tsx）也在掀開之後才載，階段 3 起另外要核心，
// 還沒到時「下一步」先記著，載好就切過去。每個階段一句 aria-live 摘要；
// 減少動態效果時天平與數字直接是結束狀態（motion.ts）。字串在第三層 catalog（lab.po）。
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { formatMoney, formatNumber, localePath } from '@ledgerland/i18n';
import { Button, Card, CheckCircleIcon, ErrorState, HintBar, Toast, ToastRegion, TopBar, ValueButton, XCircleIcon } from '@ledgerland/web-ui';
import { labPrefersReducedMotion } from '../features/lab/motion.ts';
import type { LabRun, LabStep as LabStepModel } from '../features/lab/lab-core.ts';
import type { LabCore } from '../features/lab/lazy-core.ts';
import { loadStageViews, stageViewsNow, type StageViews } from '../features/lab/lazy-stages.ts';
import { loadTracePanel, tracePanelNow, type TraceViews } from '../features/lab/lazy-trace.ts';
import type { TraceTarget } from '../features/lab/TracePanel.tsx';
import type { ShownStatement } from '../features/lab/trace-model.ts';
import { firstPaintLayout, joinList, lineAt, useChangeText, useLabLabels, type LayoutLike } from '../features/lab/labels.ts';
import type { RevealItem } from '../features/lab/PredictReveal.tsx';
import {
  answeredTargets,
  isPredictionCorrect,
  lineDirection,
  predictTargetsOf,
  ratioDirection,
  recordOnTargets,
  targetsOnLayout,
  type PredictChoice,
  type PredictScore,
  type PredictTarget,
  type PredictionRecord,
} from '../features/lab/predict.ts';
import { completeStep, predictTotals, savePrediction, type StoryProgress } from '../features/lab/progress.ts';
import { ratioChanges, ratioPoint, ratioSpecOf } from '../features/lab/ratio-changes.ts';
import { canGoTo, canJumpTo, canSkipToEnd, stagesOf, statementForStage, type LabMode, type StageGate } from '../features/lab/stages.ts';
import { StageBar, useStageNames } from '../features/lab/StageBar.tsx';
import type { StatementView } from '../features/lab/StatementTable.tsx';
import { TraceLoadToast } from '../features/lab/TraceLoadToast.tsx';
import { TransactionCard } from '../features/lab/TransactionCard.tsx';
import { BasisBanner, BasisNote } from '../features/lab/BasisBanner.tsx';
import { LabTag } from '../features/lab/LabTag.tsx';
import { IFRS_POLICY, TEACHER_POLICY, type LabPolicyId } from '../features/lab/lab-policy.ts';
import { useLabView, type UseLabView } from '../features/lab/lab-view.ts';
import { useLabStepLoad } from '../features/lab/useLab.ts';
import { useExpanded } from '../features/me/useExpanded.ts';
import { useColumnsFit } from '../features/lab/useColumnsFit.ts';
import { MarkupParagraphs } from '../features/quiz/Markup.tsx';
import { TermsProvider, useTerms } from '../features/quiz/terms.tsx';
import { findLevelOfQuestion, type StorySnapshot, type StoryStepSnapshot } from '../lib/content.ts';
import { afterFirstPaint } from '../lib/idle.ts';
import { usePageReady, useRevealed } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import { NotFound } from './NotFound.tsx';
import { useLabBack } from '../features/lab/useLabBack.ts';
import '../styles/lab.css';

type StatementCode = 'is' | 'cf' | 'bs';
const STATEMENT_KEY = { is: 'income_statement', cf: 'cash_flow_indirect', bs: 'balance_sheet' } as const;
const STATEMENT_CODE: Record<ShownStatement, StatementCode> = { income_statement: 'is', cash_flow_indirect: 'cf', balance_sheet: 'bs' };
/** 固定在上方的恆等式三列；要和 tools/lib/content-rules.mjs 的 FIRST_PAINT_LINES.equation 一致（核心載入前用快照的數字） */
const EQUATION_LINES = ['bs_total_assets', 'bs_total_liabilities', 'bs_total_equity'] as const;

export default function LabStep() {
  const { storyId, stepId } = useParams();
  const [params] = useSearchParams();
  const mode: LabMode = params.get('mode') === 'demo' ? 'demo' : 'practice';
  const locale = useLocale();
  const lab = useLabStepLoad(storyId, locale);
  const { t } = useLingui();
  const back = useLabBack();
  const revealed = useRevealed();
  const href = (p: string) => localePath(locale, p);
  const story = lab.kind === 'ok' ? lab.story : null;
  const spec = story?.steps.find((s) => s.id === stepId);
  // 快照沒有第一次繪製的數字（舊快照）：和其他實驗室頁一樣等核心齊了才出現
  const needCoreFirst = story !== null && spec !== undefined && (story.firstPaint === undefined || spec.firstPaint === undefined);
  const { loadCore } = lab;
  useEffect(() => {
    if (needCoreFirst) loadCore();
  }, [needCoreFirst, loadCore]);
  // 畫面掀開（第一次繪製真的送出）之後才載核心：Lighthouse 把 LCP 之前開始的請求都算進 LCP（06 第 8.2 節）；階段 2 到 10 的畫面元件由 StepSession 同樣在掀開之後載
  useEffect(() => (revealed ? afterFirstPaint(loadCore) : undefined), [revealed, loadCore]);
  usePageReady(lab.kind !== 'loading' && (!needCoreFirst || lab.core !== null || lab.coreError !== undefined));
  const core = lab.core;
  // 報表口徑（03 第 3.13 節）：教材的重播一直都有（計分、預測與對照的基準）；切到 IFRS 對照時另用 ifrs@1 重播一次，兩份都用 useMemo 留著，切回來不重算。
  // 從題目開啟（?from=）一律先用教材
  const labView = useLabView({ fromQuestion: params.get('from') !== null });
  const ifrs = labView.policy === IFRS_POLICY;
  const replay = useMemo(() => (core && story ? core.replayLab(core.asCoreStory(story)) : null), [core, story]);
  const replayIfrs = useMemo(() => (core && story && ifrs ? core.replayLab(core.asCoreStory(story), [], IFRS_POLICY) : null), [core, story, ifrs]);
  if (lab.kind === 'error' && lab.error.kind === 'missing') return <NotFound />;
  if (lab.kind === 'error')
    return (
      <>
        <TopBar title={t({ id: 'lab.story.title', message: '故事' })} backHref={href('/lab/')} backLabel={back.label} backShortLabel={back.short} />
        <ErrorState title={t({ id: 'lab.error.title', message: '讀不到實驗室的故事', comment: '實驗室離線時的錯誤標題' })} onRetry={lab.retry} />
      </>
    );
  if (lab.kind !== 'ok' || story === null)
    return <TopBar title={t({ id: 'lab.story.title', message: '故事' })} backHref={href('/lab/')} backLabel={back.label} backShortLabel={back.short} />;
  if (!spec) return <NotFound />;
  if (replay && !replay.ok) throw new Error(`故事重播失敗：${replay.error.code}`);
  if (replayIfrs && !replayIfrs.ok) throw new Error(`故事以 IFRS 對照重播失敗：${replayIfrs.error.code}`);
  const baseRun = replay ? replay.value : null;
  const run = ifrs ? (replayIfrs ? replayIfrs.value : null) : baseRun;
  const step = run && stepId ? run.stepById(stepId) : undefined;
  const baseStep = baseRun && stepId ? baseRun.stepById(stepId) : undefined;
  if (run && !step) return <NotFound />;
  return (
    <TermsProvider locale={locale} deferIndex={!needCoreFirst}>
      <StepSession
        key={`${story.id}:${stepId}:${mode}`}
        mode={mode}
        core={core}
        coreError={lab.coreError}
        onLoadCore={loadCore}
        story={story}
        spec={spec}
        step={step ?? null}
        baseStep={baseStep ?? null}
        run={run}
        labView={labView}
        progress={lab.progress.progress}
        onProgress={lab.refreshProgress}
      />
    </TermsProvider>
  );
}

interface SessionProps {
  mode: LabMode;
  /** 核心（還沒載好是 null，這時 run 與 step 也是 null） */
  core: LabCore | null;
  coreError: unknown;
  onLoadCore: () => void;
  story: StorySnapshot;
  spec: StoryStepSnapshot;
  /** 顯示中的口徑的這一步（教材或 IFRS 對照） */
  step: LabStepModel | null;
  /** 教材口徑的這一步（IFRS 對照時畫差異標記與「教材口徑：x」；教材時和 step 同一個） */
  baseStep: LabStepModel | null;
  run: LabRun | null;
  labView: UseLabView;
  progress: StoryProgress;
  onProgress: () => void;
}

type Answer = { answer: PredictChoice; nearly: boolean; exact?: 'up' | 'down' | 'unchanged' };

function StepSession({ mode, core, coreError, onLoadCore, story, spec, step, baseStep, run, labView, progress, onProgress }: SessionProps) {
  const { t } = useLingui();
  const locale = useLocale();
  const [params, setParams] = useSearchParams();
  const demo = mode === 'demo';
  const stages = stagesOf(mode);
  const from = params.get('from');
  const ifrs = labView.policy === IFRS_POLICY;
  // IFRS 對照時表格與指標要對照的教材數字；教材口徑不比
  const compare = ifrs && baseStep ? { after: baseStep.after, change: baseStep.change } : undefined;
  const { ready: termsReady } = useTerms();
  const revealed = useRevealed();
  // 版面：核心與名詞索引都到了才用核心的版面；之前由快照的 firstPaint.lines 做成（只有恆等式、前情摘要與預測目標的列，名稱已是名詞的名稱）
  const layout: LayoutLike = useMemo(() => (run && termsReady ? run.ctx.layout : firstPaintLayout(story.firstPaint?.lines ?? {})), [run, termsReady, story]);
  const { lineLabel, accountLabel, ratioLabel } = useLabLabels(layout);
  const change = useChangeText();
  const names = useStageNames();
  const roles = useRoleLabels();
  const expanded = useExpanded();
  // 三表並排而且每張表放得下三欄時才用三欄並列（量表格區的寬度，不看視窗）
  const [tablesRef, wide] = useColumnsFit();
  const reduced = labPrefersReducedMotion();
  const href = (p: string) => localePath(locale, p);
  const storyHref = href(`/lab/story/${story.id}/`);
  // 同一個故事其他步驟的連結帶著目前的模式（示範時老師不用每一步重選）
  const stepHref = (id: string) => href(`/lab/story/${story.id}/${id}/`) + (demo ? '?mode=demo' : '');
  // 換成另一種模式：只改查詢字串，外層的 key 含模式，整段重新開始（回到交易卡）
  const switchMode = () => {
    const next = new URLSearchParams(params);
    if (demo) next.delete('mode');
    else next.set('mode', 'demo');
    setParams(next);
  };
  // 步驟的順序：快照的 steps 依 order（和核心 orderedSteps 一樣），前一步與下一步由此而來，不必等核心
  const ordered = useMemo(() => [...story.steps].sort((a, b) => a.order - b.order), [story]);
  const index = ordered.findIndex((s) => s.id === spec.id);
  const prevStepId = ordered[index - 1]?.id;
  const nextStepId = ordered[index + 1]?.id;
  // 第一次繪製要的數字：核心載好用核心的結果，還沒載好用快照的 firstPaint（建置時同一份核心算的）
  const firstPaint = spec.firstPaint;
  // 交易卡的敘述兩種口徑相同（03 第 3.13 節），金額也固定用教材的：IFRS 對照時第 17 步的設立費攤銷是 0，「今年攤掉 0 元」和敘述矛盾
  const values = baseStep?.values ?? firstPaint?.values ?? {};
  const before = (lineId: string): number => (step ? lineAt(step.before, lineId) : (firstPaint?.before[lineId] ?? 0));
  const after = (lineId: string): number => (step ? lineAt(step.after, lineId) : (firstPaint?.after[lineId] ?? 0));
  const hasCore = step !== null && run !== null;

  // 進度：練習模式第一次練這一步，預測要先完成（03 第 3.3 節）；練過的再回來，預測可略過、有跳到最後的捷徑；示範沒有預測
  const alreadyDone = progress.done.includes(spec.id);
  const practised = progress.practised.includes(spec.id);
  const predictRequired = !demo && !practised;
  const savedPrediction = progress.predictions[spec.id];
  // record 是記下的那一份（揭曉與成績都看它）；draft 是面板上正在選的，按「記下預測」或「更新預測」才變成 record，同一步不會出現兩個成績
  const [record, setRecord] = useState<PredictionRecord>(() => savedPrediction ?? {});
  const [draft, setDraft] = useState<PredictionRecord>(record);
  const [submitted, setSubmitted] = useState(() => !demo && savedPrediction !== undefined && practised);
  // 目標以顯示中的版面為準（03 第 3.13 節）：ifrs@1 沒有經常利益、不顯示遞延的設立費。版面要核心才有，所以 IFRS 對照時預測階段等核心（go）；教材的目標兩邊相同，不必等
  const allTargets = useMemo(() => predictTargetsOf(spec.predictTargets), [spec.predictTargets]);
  const targets = useMemo(() => (run ? targetsOnLayout(allTargets, run.ctx.layout) : allTargets), [allTargets, run]);
  // 這份預測猜過的目標：換口徑之後，揭曉與成績只算兩邊都有的，所以記下之後換口徑不會把人擋在預測關卡
  const asked = answeredTargets(targets, record);
  // 這份預測記下時的口徑與成績（存在進度裡的那一份）：畫面可以換口徑重新揭曉，紀錄不跟著改
  const [recordBasis, setRecordBasis] = useState<LabPolicyId>(() => progress.predictBasis[spec.id] ?? TEACHER_POLICY);
  const [recordScore, setRecordScore] = useState<PredictScore | null>(() => (submitted ? (progress.predictScores[spec.id] ?? null) : null));
  const predictDone = submitted;
  const gate: StageGate = useMemo(() => ({ mode, predictRequired, predictDone, revisit: practised }), [mode, predictRequired, predictDone, practised]);

  const [stage, setStage] = useState(0);
  // 階段 2 起要畫面元件（stage-views.tsx）、階段 3 起還要核心：還沒到時先記著要去的階段，載好就切過去（go）
  const [pendingStage, setPendingStage] = useState<number | null>(null);
  // 這次走到最遠的階段：第一次練時階段選單只能跳回這裡以前（stages.ts 的 canJumpTo）
  const [reached, setReached] = useState(0);
  const [views, setViews] = useState<StageViews | null>(() => stageViewsNow());
  const [viewsError, setViewsError] = useState<unknown>(undefined);
  const loadViews = useCallback(() => {
    const now = stageViewsNow();
    if (now !== null) {
      setViews(now);
      return;
    }
    loadStageViews().then(
      (m) => {
        setViews(m);
        setViewsError(undefined);
      },
      (e: unknown) => setViewsError(e),
    );
  }, []);
  // 畫面掀開之後預載階段 2 到 10 的畫面元件（和核心、名詞索引一樣不排在 LCP 前面）；失敗不顯示，使用者要往階段 2 走時才顯示錯誤與重試
  useEffect(() => (revealed && views === null ? afterFirstPaint(loadViews) : undefined), [revealed, views, loadViews]);
  const [manualTab, setManualTab] = useState(false);
  const [tab, setTab] = useState<StatementCode>('is');
  // 累計或本筆變動記在 settings 的 labView.window（lab-view.ts）：跨步驟與重新載入都沿用
  const view: StatementView = labView.window;
  const setView = labView.setWindow;
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [highlight, setHighlight] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedLight, setSelectedLight] = useState<2 | 3 | 4 | 5 | null>(null);
  // 分錄層的展開狀態記在 settings 的 labView.journalLayerOpen（lab-view.ts）
  const journalOpen = labView.journalLayerOpen;
  const toggleJournal = labView.setJournalLayerOpen;
  // 來源面板（M4b，03 第 3.9 節）：第一次點可追蹤的數字才載面板的模組；關閉後焦點回到那個數字
  const [trace, setTrace] = useState<TraceTarget | null>(null);
  const [traceViews, setTraceViews] = useState<TraceViews | null>(() => tracePanelNow());
  const traceReturn = useRef<HTMLElement | null>(null);
  // 面板的模組或核心載入失敗：記著剛才要開的數字，提示裡的「再試一次」帶著它重開
  const [traceFailed, setTraceFailed] = useState<{ target: TraceTarget; el: HTMLElement | null; retried: boolean } | null>(null);
  const traceRetried = useRef(false);
  const stagesRetried = useRef(false);
  // 「在報表上標出」：播報的一句（面板關掉之後由步驟頁的 live region 說）與關面板後焦點要去的格子（compact 換表時原本的數字已卸載）
  const [marked, setMarked] = useState('');
  const markReturn = useRef<{ code: StatementCode; line: string } | null>(null);
  useEffect(() => {
    const m = markReturn.current;
    if (m === null || trace !== null) return;
    markReturn.current = null;
    if (traceReturn.current?.isConnected) return;
    const cell = document.querySelector<HTMLElement>(`#ll-lab-table-${m.code} [data-line="${m.line}"] [data-testid="lab-trace-value"]`);
    (cell ?? document.getElementById('ll-lab-stage-heading'))?.focus();
  });
  const openTrace = (target: TraceTarget, el: HTMLElement | null, retried = false) => {
    traceReturn.current = el;
    traceRetried.current = retried;
    setTraceFailed(null);
    setTrace(target);
    if (!hasCore) onLoadCore();
    if (traceViews === null)
      loadTracePanel().then(setTraceViews, () => {
        setTrace(null);
        setTraceFailed({ target, el, retried });
      });
  };
  const retryTrace = () => {
    if (traceFailed === null) return;
    // 提示裡的按鈕馬上要卸載：焦點先回到那個數字
    traceFailed.el?.focus();
    openTrace(traceFailed.target, traceFailed.el, true);
  };
  // 恆等式的數字在核心載好之前就能按：核心載入失敗時收起這次的開啟，不留到之後核心載好才自己彈出來
  useEffect(() => {
    if (trace === null || hasCore || coreError === undefined) return;
    setTraceFailed({ target: trace, el: traceReturn.current, retried: traceRetried.current });
    setTrace(null);
  }, [trace, hasCore, coreError]);
  const [finished, setFinished] = useState<{ unlockedTerms: string[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fromHref, setFromHref] = useState<string | null>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);

  // 從題目開啟（?from=題目 ID）：返回膠囊回到那一關（03 第 4.6 節）
  useEffect(() => {
    if (!from) return;
    let alive = true;
    findLevelOfQuestion(from).then(
      (entry) => alive && entry && setFromHref(localePath(locale, `/level/${entry.id}/`)),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [from, locale]);

  // 階段 5 到 7 進入時自動切表（手動切過就不再自動）
  useEffect(() => {
    const auto = statementForStage(stage, mode);
    if (auto !== null && !manualTab) setTab(auto);
  }, [stage, mode, manualTab]);

  const enter = useCallback((to: number) => {
    setPendingStage(null);
    setStage(to);
    setReached((r) => Math.max(r, to));
    setSelectedLight(null);
    setHighlight(new Set());
    setMarked('');
    setTraceFailed(null);
  }, []);
  const go = useCallback(
    (to: number) => {
      if (!canGoTo(stage, to, gate)) return;
      // 交易卡之後的階段要畫面元件與名詞索引（科目與指標的名稱）、預測之後的階段還要核心
      const id = stages[to]!;
      const needViews = id !== 'card' && (views === null || !termsReady);
      const needCore = id !== 'card' && (id !== 'predict' || ifrs) && !hasCore;
      if (needViews || needCore) {
        setPendingStage(to);
        if (views === null) loadViews();
        if (needCore) onLoadCore();
        return;
      }
      enter(to);
    },
    [stage, stages, gate, hasCore, ifrs, views, termsReady, onLoadCore, loadViews, enter],
  );
  useEffect(() => {
    if (pendingStage === null || views === null || !termsReady) return;
    const id = stages[pendingStage]!;
    if (id === 'card' || (id === 'predict' && !ifrs) || hasCore) enter(pendingStage);
  }, [pendingStage, stages, views, termsReady, hasCore, ifrs, enter]);
  // 方向鍵左右切換階段（焦點不在輸入框時，03 第 3.11 節）。元件自己用掉的方向鍵（分段控制、選單）不算，開著面板時背後的階段也不動
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented || document.querySelector('dialog[open]') !== null) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') go(stage + 1);
      else if (e.key === 'ArrowLeft') go(stage - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, stage]);

  // 預測的答案（由核心的前後數字算；核心還沒載好時是 null，揭曉與成績都等核心）
  const chart = run?.ctx.chart;
  const answerOf =
    step && chart
      ? (tg: PredictTarget): Answer => {
          if (tg.kind === 'line') return { answer: lineDirection(lineAt(step.before, tg.line), lineAt(step.after, tg.line)), nearly: false };
          if (tg.kind === 'account') {
            const sign = chart.byId.get(tg.account)?.normalSide === 'credit' ? -1 : 1;
            return {
              answer: lineDirection(sign * (step.posted.balancesBefore[tg.account] ?? 0), sign * (step.posted.balancesAfter[tg.account] ?? 0)),
              nearly: false,
            };
          }
          const b = step.ratiosBefore.find((r) => r.ratioRef === tg.ratioRef);
          const a = step.ratiosAfter.find((r) => r.ratioRef === tg.ratioRef);
          const d = ratioDirection(ratioPoint(b), ratioPoint(a));
          const exactB = b?.value ?? null;
          const exactA = a?.value ?? null;
          const nearly = d.answer === 'unchanged' && exactA !== null && exactB !== null && exactA !== exactB;
          return { answer: d.answer, nearly, ...(nearly ? { exact: lineDirection(exactB, exactA) } : {}) };
        }
      : null;
  const verdictOf = (tg: PredictTarget) => {
    if (!submitted || !answerOf) return null;
    const a = answerOf(tg);
    return { correct: isPredictionCorrect(record[tg.id], a.answer, a.nearly, a.exact), nearly: a.nearly };
  };
  const labelOfTarget = (tg: PredictTarget) =>
    tg.kind === 'line' ? lineLabel(tg.line) : tg.kind === 'account' ? accountLabel(tg.account) : ratioLabel(tg.ratioRef.split('@')[0]!);
  const scoreOf = (rec: PredictionRecord): PredictScore | null => {
    if (!answerOf) return null;
    const counted = answeredTargets(targets, rec);
    return {
      right: counted.filter((tg) => {
        const a = answerOf(tg);
        return isPredictionCorrect(rec[tg.id], a.answer, a.nearly, a.exact);
      }).length,
      total: counted.length,
    };
  };
  // 記下預測：成績要核心才算得出；核心還沒到時先記著，載好再存（存的是當時的 record）。
  // 揭曉以畫面上的數字為準（03 第 3.13 節）：IFRS 對照時成績依 IFRS 數字判定，另記 basis；成績只是本機紀錄，不影響闖關計分
  const pendingSave = useRef(false);
  const saveRecord = (rec: PredictionRecord, score: PredictScore) => {
    const kept = recordOnTargets(targets, rec);
    setRecord(kept);
    setDraft(kept);
    setRecordBasis(labView.policy);
    setRecordScore(score);
    void savePrediction(story.id, spec.id, kept, score, labView.policy);
  };
  const submitPrediction = () => {
    setRecord(draft);
    setSubmitted(true);
    const score = scoreOf(draft);
    if (score) saveRecord(draft, score);
    else {
      pendingSave.current = true;
      onLoadCore();
    }
  };
  useEffect(() => {
    if (!pendingSave.current || !hasCore) return;
    pendingSave.current = false;
    const score = scoreOf(record);
    if (score) saveRecord(record, score);
    // scoreOf 與 record 都是這一次 render 的值；只在核心載好的那一次 render 存一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCore]);
  // 揭曉卡（階段 3 的最上面）：每個目標你猜的、實際的、對錯與前後數字；五層利益都不變時加一句原因
  const moneyRange = (b: number, a: number) => `${formatMoney(b, locale)} → ${formatMoney(a, locale)}`;
  const detailOf = (tg: PredictTarget): string | undefined => {
    if (!step || !chart) return undefined;
    if (tg.kind === 'line') return moneyRange(lineAt(step.before, tg.line), lineAt(step.after, tg.line));
    if (tg.kind === 'account') {
      const sign = chart.byId.get(tg.account)?.normalSide === 'credit' ? -1 : 1;
      return moneyRange(sign * (step.posted.balancesBefore[tg.account] ?? 0), sign * (step.posted.balancesAfter[tg.account] ?? 0));
    }
    return undefined;
  };
  const revealItems: RevealItem[] =
    submitted && answerOf
      ? asked.map((tg) => {
          const a = answerOf(tg);
          const v = verdictOf(tg);
          const item: RevealItem = {
            id: tg.id,
            label: labelOfTarget(tg),
            kind: tg.kind,
            chosen: record[tg.id],
            answer: a.answer,
            correct: v?.correct ?? false,
            nearly: v?.nearly ?? false,
          };
          const detail = detailOf(tg);
          return detail === undefined ? item : { ...item, detail };
        })
      : [];
  const revealScore = submitted ? scoreOf(record) : null;
  const levelTargets = asked.filter((tg): tg is PredictTarget & { kind: 'line' } => tg.kind === 'line' && tg.line.startsWith('is_'));
  const revealNote =
    submitted && answerOf && levelTargets.length > 0 && levelTargets.every((tg) => answerOf(tg).answer === 'unchanged')
      ? ifrs
        ? t({
            id: 'lab.reveal.noteLevelsIfrs',
            message: '這筆交易不經過損益表，所以各層利益都不變。',
            comment: '揭曉卡的原因句：IFRS 對照沒有經常利益，不說五層',
          })
        : t({ id: 'lab.reveal.noteLevels', message: '這筆交易不經過損益表，所以五層利益都不變。', comment: '揭曉卡的原因句：收入與費用都沒動' })
      : undefined;
  // 記下之後又改了選項：面板提示要按「更新預測」
  const draftDirty = submitted && targets.some((tg) => draft[tg.id] !== record[tg.id]);
  // 完成卡的預測成績是存下來的那一份，不是換口徑後重算的：這一步加整個故事（含這一步，進度快照可能還是舊的）；舊資料沒有成績時才用畫面上算的
  const finishScore = recordScore ?? revealScore;
  const storyTotals = predictTotals({ predictScores: finishScore ? { ...progress.predictScores, [spec.id]: finishScore } : progress.predictScores });

  const summary = step && views ? views.changeSummary(step.before, step.after, lineLabel, locale) : null;
  const ratios = useMemo(() => (core && step ? ratioChanges(core, 'excel', step.ratiosBefore, step.ratiosAfter) : []), [core, step]);
  const ratioVerdicts = Object.fromEntries(
    targets
      .filter((tg): tg is PredictTarget & { kind: 'ratio' } => tg.kind === 'ratio')
      .map((tg) => [tg.ratioRef, verdictOf(tg) ?? { correct: false, nearly: false }]),
  );
  const cashTarget = targets.find((tg) => tg.kind === 'line' && tg.line === 'bs_cash');
  const cashVerdict = cashTarget && submitted ? { chosen: record[cashTarget.id] ?? '', correct: verdictOf(cashTarget)?.correct ?? false } : null;

  // 每個階段一句播報（03 第 3.11 節）；交易卡與預測不用核心，其他階段沒有核心就不會進得去
  const liveText = (() => {
    const id = stages[stage]!;
    if (id === 'card') return t({ id: 'lab.live.card', message: `第 ${spec.order} 步，${spec.title}。`, comment: '階段 1 的播報；數字與標題已代入' });
    if (id === 'predict')
      return submitted
        ? t({ id: 'lab.live.predicted', message: '已記下你的預測。', comment: '記下預測後的播報' })
        : t({ id: 'lab.live.predict', message: '替每個目標選一個方向。', comment: '階段 2 的播報' });
    if (!step) return '';
    const cash = lineAt(step.after, 'bs_cash') - lineAt(step.before, 'bs_cash');
    switch (id) {
      case 'effects':
        return [
          ...(revealScore
            ? [
                t({
                  id: 'lab.live.reveal',
                  message: `揭曉：${formatNumber(revealScore.total, locale)} 個猜對 ${formatNumber(revealScore.right, locale)} 個`,
                  comment: '階段 3 播報的開頭；兩個數字已格式化',
                }),
              ]
            : []),
          ...step.posted.effects.filter((e) => e.direction !== 'unchanged').map((e) => `${accountLabel(e.account)}${change(e.delta)}`),
        ].join(locale === 'en' ? '. ' : '。');
      case 'equation':
        return '';
      case 'income':
        return ['is_gross_profit', 'is_net_income']
          .map((l) => {
            const name = lineLabel(l);
            const from = formatMoney(lineAt(step.before, l), locale);
            const to = formatMoney(lineAt(step.after, l), locale);
            return t({ id: 'lab.live.income', message: `${name}由 ${from} 變為 ${to}`, comment: '階段 4 損益表的播報；列名與金額已代入' });
          })
          .join(locale === 'en' ? '. ' : '。');
      case 'cashflow':
        return `${lineLabel('cf_cash_end')}${change(cash)}`;
      case 'balance':
        return `${lineLabel('bs_total_assets')}${change(lineAt(step.after, 'bs_total_assets') - lineAt(step.before, 'bs_total_assets'))}`;
      case 'checks':
        return step.fiveStep.checks.every((c) => c.pass)
          ? t({ id: 'lab.live.checksPass', message: '四個勾稽點都相符。', comment: '階段 8 的播報' })
          : t({ id: 'lab.live.checksFail', message: '有勾稽點不相符。', comment: '階段 8 的播報' });
      case 'ratios':
        return joinList(
          ratios
            .filter((r) => r.changed)
            .slice(0, 3)
            .map((r) => ratioLabel(r.spec.id, r.spec.termRef)),
          locale,
        );
      case 'insight':
        return names.insight;
    }
  })();

  // 階段播報只在換階段、記下預測或核心到了時更新。切換口徑由 PolicyToggle 自己播報一句：這裡清空，不重唸一次整段階段摘要，也不留著上一種口徑的數字
  const liveKey = `${stage}:${submitted}:${hasCore}`;
  const [live, setLive] = useState({ key: liveKey, policy: labView.policy, text: liveText });
  if (live.key !== liveKey) setLive({ key: liveKey, policy: labView.policy, text: liveText });
  else if (live.policy !== labView.policy) setLive({ key: liveKey, policy: labView.policy, text: '' });

  const finish = async () => {
    if (finished) return;
    const res = await completeStep({ storyId: story.id, stepId: spec.id, termRefs: spec.termRefs, mode, order: ordered.map((s) => s.id) });
    setFinished(res);
    onProgress();
    if (res.unlockedTerms.length > 0)
      setToast(t({ id: 'lab.toast.terms', message: `收進名詞圖鑑：${res.unlockedTerms.length} 個名詞`, comment: '走完一步時解鎖名詞的提示；數字已代入' }));
  };
  const isLast = stage === stages.length - 1;
  const onNext = () => {
    if (isLast) void finish();
    else go(stage + 1);
  };

  const tabs: { value: StatementCode; label: string }[] = [
    { value: 'is', label: names.income },
    { value: 'cf', label: names.cashflow },
    { value: 'bs', label: names.balance },
  ];
  const table = (V: StageViews, s: LabStepModel, code: StatementCode, v: StatementView) => (
    <V.StatementTable
      key={code}
      caption={tabs.find((x) => x.value === code)!.label}
      statement={STATEMENT_KEY[code]}
      before={s.before}
      after={s.after}
      view={v}
      onlyChanged={onlyChanged}
      highlight={highlight}
      layout={layout}
      animate={!reduced}
      onTrace={(lineId, window, el) => openTrace({ kind: 'line', lineId, window }, el)}
      compare={compare}
      id={`ll-lab-table-${code}`}
    />
  );
  // 恆等式摘要的三個合計也可以追。核心載好之前也畫成按鈕（按了先載核心、載好就開）：第一次繪製的 DOM 和之後一樣，
  // 核心載好時不換節點，Chrome 才不會把 sticky 列重新登記成 LCP（2026-11-07 量到換節點讓模擬的 LCP 多 1.3 秒）
  const equationValue = (lineId: string) => {
    const text = formatMoney(after(lineId), locale);
    return (
      <ValueButton
        label={t({
          id: 'lab.trace.open',
          // 和 StatementTable 共用這個 ID：兩個參數都寫成呼叫，抽出來的佔位符才一樣是 {0} {1}
          message: `${lineLabel(lineId)} ${formatMoney(after(lineId), locale)}，看這個數字從哪裡來`,
          comment: '可追蹤的數字（按鈕）的可讀名稱；列名與金額已代入',
        })}
        onClick={(e) => openTrace({ kind: 'line', lineId, window: 'cumulative' }, e.currentTarget)}
        data-testid="lab-trace-value"
        data-line={lineId}
      >
        {text}
      </ValueButton>
    );
  };
  const stageId = stages[stage]!;
  const designNotes = [...new Set(spec.events.flatMap((e) => e.pendingRefs ?? []))];
  const title = t({ id: 'lab.step.title', message: `第 ${spec.order} 步：${spec.title}`, comment: '步驟頁的標題；數字與標題已代入' });
  const prevDone = prevStepId === undefined || progress.done.includes(prevStepId);
  // 固定區塊的高度依寬度與有沒有 IFRS 橫幅而變：量好寫給 html 的 scroll-padding-top（lab.css），鍵盤往回走時焦點才不會停在它底下
  const stickyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stickyRef.current;
    if (el === null || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty('--ll-lab-sticky-h', `${Math.ceil(el.getBoundingClientRect().height)}px`));
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--ll-lab-sticky-h');
    };
  }, []);

  return (
    <div
      className="ll-lab-session"
      data-testid="lab-session"
      data-stage={stageId}
      data-mode={mode}
      data-core={hasCore ? 'ready' : 'pending'}
      data-views={views ? 'ready' : 'pending'}
      data-terms={termsReady ? 'ready' : 'pending'}
      data-policy={labView.policy}
    >
      <TopBar
        title={title}
        backHref={storyHref}
        backLabel={t({ id: 'lab.step.back', message: '回到故事步驟', comment: '步驟頁返回鍵的可讀名稱' })}
        backShortLabel={t({ id: 'lab.step.back.short', message: '故事', comment: '步驟頁返回鍵的短字' })}
      />
      {fromHref && (
        <HintBar
          kind="info"
          detailsHref={fromHref}
          detailsLabel={t({ id: 'lab.step.backToQuestion', message: '回到題目', comment: '從題目開啟實驗室時的返回膠囊' })}
        >
          {t({ id: 'lab.step.fromQuestion', message: '你從一道題目來到這一步。', comment: '返回膠囊的說明' })}
        </HintBar>
      )}
      {demo && (
        <p className="ll-lab-session__mode" data-testid="lab-demo-flag">
          <Trans id="lab.step.demoMode" comment="示範模式的標示（練習是預設，不標）">
            示範：沒有預測，可以隨時跳到任何階段
          </Trans>
        </p>
      )}
      <div className="ll-lab-session__sticky" ref={stickyRef}>
        <p className="ll-lab-session__equation" data-testid="lab-equation">
          {lineLabel(EQUATION_LINES[0])} {equationValue(EQUATION_LINES[0])} ＝ {lineLabel(EQUATION_LINES[1])} {equationValue(EQUATION_LINES[1])} ＋{' '}
          {lineLabel(EQUATION_LINES[2])} {equationValue(EQUATION_LINES[2])}
        </p>
        {/* IFRS 對照時每個階段都看得到「IFRS 對照，不計分」（10 第 11.2 節完成標準第 5 條）；教材口徑沒有這一列，第一次繪製的 DOM 不變 */}
        {ifrs && <BasisBanner />}
      </div>
      {ifrs && <BasisNote />}
      <h2 id="ll-lab-stage-heading" className="ll-lab-session__stage" tabIndex={-1} data-testid="lab-stage-title">
        {t({ id: 'lab.stage.progress', message: `階段 ${stage + 1}／${stages.length}：${names[stageId]}` })}
      </h2>
      <p ref={liveRef} className="ll-sr-only" aria-live="polite" data-testid="lab-live">
        {marked || live.text}
      </p>
      <section className={`ll-lab-session__content${reduced ? '' : ' ll-lab-animate'}`} aria-labelledby="ll-lab-stage-heading">
        {pendingStage !== null && (coreError !== undefined || viewsError !== undefined) && (
          <ErrorState
            title={t({ id: 'lab.step.coreError', message: '讀不到後面的階段', comment: '核心或階段畫面的模組載入失敗（離線）時的錯誤標題；重試會再載一次' })}
            onRetry={() => {
              // WebKit 把失敗的動態 import 記在這份文件的模組表裡，再 import 同一個網址不會發請求：重試過一次還是失敗就換一份文件
              if (stagesRetried.current) {
                window.location.reload();
                return;
              }
              stagesRetried.current = true;
              if (viewsError !== undefined) loadViews();
              if (coreError !== undefined) onLoadCore();
            }}
          />
        )}
        {stageId === 'card' && (
          <TransactionCard
            spec={spec}
            values={values}
            before={before}
            layout={layout}
            termLabels={firstPaint?.terms}
            recap={!alreadyDone && index > 0 && !prevDone}
            suggestEarlier={!demo && !from && index > 0 && !prevDone}
            policyDiffers={ifrs && core !== null && core.policyDiffers(spec)}
          />
        )}
        {views && stageId === 'predict' && (
          <views.PredictPanel
            targets={targets}
            labelOf={labelOfTarget}
            record={draft}
            onChange={setDraft}
            onSubmit={submitPrediction}
            submitted={submitted}
            submittedNote={t({ id: 'lab.live.predicted', message: '已記下你的預測。' })}
            dirty={draftDirty}
          />
        )}
        {views && step && chart && stageId === 'effects' && revealScore && (
          <views.PredictReveal
            items={revealItems}
            right={revealScore.right}
            total={revealScore.total}
            locale={locale}
            note={revealNote}
            basis={labView.policy}
            recordedBasis={recordBasis}
          />
        )}
        {views && step && chart && stageId === 'effects' && (
          <views.EffectsList
            step={step}
            chart={chart}
            layout={layout}
            journalOpen={journalOpen}
            onJournalToggle={toggleJournal}
            cashVerdict={cashVerdict}
            designNotes={designNotes}
            animate={!reduced}
          />
        )}
        {views && step && stageId === 'equation' && <views.BalanceScale before={step.before} after={step.after} layout={layout} animate={!reduced} />}
        {views && step && summary && (stageId === 'income' || stageId === 'cashflow' || stageId === 'balance') && (
          <div className="ll-lab-tables" data-expanded={expanded ? 'true' : 'false'}>
            <div className="ll-lab-tables__controls">
              {!expanded && (
                <views.Segmented
                  value={tab}
                  options={tabs}
                  onChange={(v) => {
                    setTab(v);
                    setManualTab(true);
                  }}
                  label={t({ id: 'lab.tables.pick', message: '選擇報表', comment: '小螢幕切換三表的分段控制名稱' })}
                  size="sm"
                />
              )}
              {!wide && (
                <views.Segmented
                  value={view}
                  options={[
                    { value: 'cumulative', label: t({ id: 'lab.tables.cumulative', message: '累計', comment: '檢視切換' }) },
                    { value: 'transaction', label: t({ id: 'lab.tables.transaction', message: '本筆變動', comment: '檢視切換' }) },
                  ]}
                  onChange={(v) => setView(v)}
                  label={t({ id: 'lab.tables.view', message: '檢視', comment: '累計與本筆變動的切換名稱' })}
                  size="sm"
                />
              )}
              {/* 設計系統的開關，不用瀏覽器原生的核選框（2026-11-06） */}
              <views.Switch
                className="ll-lab-tables__only"
                checked={onlyChanged}
                onChange={setOnlyChanged}
                label={t({ id: 'lab.tables.onlyChanged', message: '只看有變動的列', comment: '表格的篩選' })}
              />
              {/* 報表口徑（03 第 3.13 節）：教材／IFRS 對照，和「累計／本筆變動」同一列 */}
              <views.PolicyToggle value={labView.policy} onChange={labView.setPolicy} />
            </div>
            <Button variant="quiet" size="sm" block className="ll-lab-summary" data-testid="lab-summary" onClick={() => !wide && setView('transaction')}>
              <span className="ll-lab-summary__label">{t({ id: 'lab.tables.summary', message: '本筆變動：', comment: '本筆變動摘要列的開頭' })}</span>
              {joinList(summary.items, locale)}
              {summary.more > 0 && (
                <span className="ll-lab-summary__more">
                  {' '}
                  {t({ id: 'lab.tables.more', message: `還有 ${summary.more} 列有變動`, comment: '摘要列放不下時；數字已代入' })}
                </span>
              )}
            </Button>
            {stageId === 'income' && submitted && (
              <ul className="ll-lab-reveal" data-testid="lab-level-verdicts">
                {levelTargets.map((tg) => {
                  const v = verdictOf(tg);
                  return (
                    <li key={tg.id} className={`ll-lab-verdict is-${v?.correct ? 'right' : 'wrong'}`}>
                      <span className="ll-lab-verdict__icon" aria-hidden="true">
                        {v?.correct ? <CheckCircleIcon /> : <XCircleIcon />}
                      </span>
                      {lineLabel(tg.line)}
                      {locale === 'en' ? ': ' : '：'}
                      {v?.correct ? t({ id: 'lab.predict.right', message: '你的預測正確' }) : t({ id: 'lab.predict.wrong', message: '和你的預測不同' })}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="ll-lab-tables__grid" ref={expanded ? tablesRef : undefined}>
              {expanded ? (['is', 'cf', 'bs'] as const).map((c) => table(views, step, c, wide ? 'columns' : view)) : table(views, step, tab, view)}
            </div>
          </div>
        )}
        {views && step && stageId === 'checks' && (
          <div className="ll-lab-checks">
            <views.ProfitLevels before={step.before} after={step.after} layout={layout} />
            <views.CheckLights
              fiveStep={step.fiveStep}
              layout={layout}
              selected={selectedLight}
              onSelect={(s, lines) => {
                setSelectedLight(s);
                setHighlight(new Set(s === null ? [] : lines));
              }}
            />
          </div>
        )}
        {views && step && stageId === 'ratios' && (
          <views.RatioList
            items={ratios}
            layout={layout}
            splitUnchanged
            verdicts={ratioVerdicts}
            onTrace={(item, el) => openTrace({ kind: 'ratio', ratioRef: item.ratioRef, spec: item.spec, result: item.after }, el)}
            compareAfter={ifrs ? baseStep?.ratiosAfter : undefined}
          />
        )}
        {step && stageId === 'insight' && (
          <div className="ll-lab-insight">
            {spec.insight && <MarkupParagraphs text={spec.insight} className="ll-lab-insight__text" />}
            {spec.stakeholders && spec.stakeholders.length > 0 && (
              <ul className="ll-lab-stakeholders" data-testid="lab-stakeholders">
                {spec.stakeholders.map((s) => (
                  <li key={s.role} className="ll-lab-stakeholder">
                    <h3 className="ll-lab-stakeholder__role">{roles[s.role] ?? s.role}</h3>
                    <dl>
                      <dt>{t({ id: 'lab.stakeholder.positive', message: '正面看法', comment: '利害關係人卡的欄位' })}</dt>
                      <dd>{s.positive}</dd>
                      <dt>{t({ id: 'lab.stakeholder.negative', message: '反面看法', comment: '利害關係人卡的欄位' })}</dt>
                      <dd>{s.negative}</dd>
                      <dt>{t({ id: 'lab.stakeholder.advice', message: '建議', comment: '利害關係人卡的欄位' })}</dt>
                      <dd>{s.advice}</dd>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
            {finished && (
              <Card as="section" className="ll-lab-finished" data-testid="lab-finished">
                <h3>
                  {demo
                    ? t({ id: 'lab.finish.demo', message: '這一步看完了', comment: '完成卡標題（示範）' })
                    : t({ id: 'lab.finish.story', message: '這一步走完了', comment: '完成卡標題（練習）' })}
                </h3>
                {finishScore && (
                  <p className="ll-lab-finished__score" data-testid="lab-finish-score">
                    {t({
                      id: 'lab.finish.score',
                      message: `這一步的預測猜對 ${formatNumber(finishScore.right, locale)}／${formatNumber(finishScore.total, locale)}；整個故事到目前 ${formatNumber(storyTotals.right, locale)}／${formatNumber(storyTotals.total, locale)}（${formatNumber(storyTotals.steps, locale)} 步）`,
                      comment: '完成卡的預測成績；數字都已格式化',
                    })}
                    {recordBasis === IFRS_POLICY && (
                      <>
                        {' '}
                        <LabTag kind="ifrs" testId="lab-finish-basis" />
                      </>
                    )}
                  </p>
                )}
                <div className="ll-lab-finished__actions">
                  {nextStepId && (
                    <Button size="md" variant="primary" href={stepHref(nextStepId)} data-testid="lab-next-step">
                      {t({ id: 'lab.finish.next', message: '下一步', comment: '完成卡按鈕' })}
                    </Button>
                  )}
                  <Button size="md" href={storyHref}>
                    {t({ id: 'lab.finish.map', message: '回到故事地圖', comment: '完成卡按鈕' })}
                  </Button>
                  {demo ? (
                    <Button size="md" href={href(`/lab/story/${story.id}/${spec.id}/`)} data-testid="lab-practise-now">
                      {t({ id: 'lab.finish.practiseNow', message: '換成練習再走一次', comment: '示範完成卡的按鈕：同一步改用練習模式' })}
                    </Button>
                  ) : (
                    <Button
                      size="md"
                      onClick={() => {
                        setFinished(null);
                        setStage(0);
                        setReached(0);
                        setSubmitted(false);
                        setRecord({});
                        setDraft({});
                        setRecordScore(null);
                      }}
                    >
                      {t({ id: 'lab.finish.again', message: '再練一次', comment: '完成卡按鈕' })}
                    </Button>
                  )}
                </div>
              </Card>
            )}
          </div>
        )}
      </section>
      <StageBar
        mode={mode}
        stage={stage}
        canPrev={stage > 0}
        canNext={isLast ? !finished : canGoTo(stage, stage + 1, gate)}
        canSkip={canSkipToEnd(stage, gate)}
        isLast={isLast}
        canJumpTo={(s) => canJumpTo(stage, s, gate, reached)}
        onPrev={() => go(stage - 1)}
        onNext={onNext}
        onSkip={() => go(stages.length - 1)}
        onJump={go}
        onSwitchMode={switchMode}
      />
      {/* 等名詞索引：layout 在那之前只有 firstPaint 的幾列，面板會出現原始線 ID（索引讀不到時 termsReady 一樣會變 true，不會卡住） */}
      {traceViews && step && run && termsReady && (
        <traceViews.TracePanel
          open={trace !== null}
          onClose={() => setTrace(null)}
          returnFocusTo={traceReturn}
          target={trace}
          run={run}
          step={step}
          trace={(window, lineId) => core!.traceLabLine(run, step, window, lineId)}
          entriesOf={(id) => core!.entriesOfStep(run, id)}
          ratioSpec={(ref) => ratioSpecOf(core!, ref)}
          layout={layout}
          basisTag={ifrs ? <LabTag kind="ifrs" testId="lab-trace-basis" /> : undefined}
          stepInfo={(id) => {
            const s = story.steps.find((x) => x.id === id);
            return s === undefined ? undefined : { order: s.order, title: s.title };
          }}
          stepHref={(id) => (id === spec.id || !story.steps.some((x) => x.id === id) ? null : href(`/lab/story/${story.id}/${id}/`))}
          // 只有畫面上有報表的階段才標得出來；其他階段（指標、勾稽燈號等）不放這顆按鈕
          onHighlight={
            summary && (stageId === 'income' || stageId === 'cashflow' || stageId === 'balance')
              ? (lines, statement, said) => {
                  const code = STATEMENT_CODE[statement];
                  setSelectedLight(null);
                  setHighlight(new Set(lines));
                  setTab(code);
                  setManualTab(true);
                  // 「只看有變動的列」可能把要標的列濾掉
                  setOnlyChanged(false);
                  setMarked(said);
                  markReturn.current = { code, line: lines[1] };
                }
              : undefined
          }
        />
      )}
      <ToastRegion className="ll-float-toasts" data-testid="lab-toasts">
        {toast && (
          <Toast kind="collect" onDismiss={() => setToast(null)}>
            {toast}
          </Toast>
        )}
        {traceFailed && <TraceLoadToast retried={traceFailed.retried} onRetry={retryTrace} onDismiss={() => setTraceFailed(null)} />}
      </ToastRegion>
    </div>
  );
}

function useRoleLabels(): Record<string, string> {
  const { t } = useLingui();
  return {
    shareholder: t({ id: 'lab.role.shareholder', message: '股東', comment: '利害關係人' }),
    bank: t({ id: 'lab.role.bank', message: '銀行', comment: '利害關係人' }),
    management: t({ id: 'lab.role.management', message: '管理階層', comment: '利害關係人' }),
    finance_lead: t({ id: 'lab.role.financeLead', message: '財務主管', comment: '利害關係人' }),
  };
}
