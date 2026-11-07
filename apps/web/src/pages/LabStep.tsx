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
  isPredictionComplete,
  isPredictionCorrect,
  lineDirection,
  predictTargetsOf,
  ratioDirection,
  type PredictChoice,
  type PredictTarget,
  type PredictionRecord,
} from '../features/lab/predict.ts';
import { completeStep, predictTotals, savePrediction, type StoryProgress } from '../features/lab/progress.ts';
import { ratioChanges, ratioPoint } from '../features/lab/ratio-changes.ts';
import { canGoTo, canJumpTo, canSkipToEnd, stagesOf, statementForStage, type LabMode, type StageGate } from '../features/lab/stages.ts';
import { StageBar, useStageNames } from '../features/lab/StageBar.tsx';
import type { StatementView } from '../features/lab/StatementTable.tsx';
import { TransactionCard } from '../features/lab/TransactionCard.tsx';
import { useLabStepLoad } from '../features/lab/useLab.ts';
import { useExpanded } from '../features/me/useExpanded.ts';
import { useColumnsFit } from '../features/lab/useColumnsFit.ts';
import { MarkupParagraphs } from '../features/quiz/Markup.tsx';
import { TermsProvider, useTerms } from '../features/quiz/terms.tsx';
import { findLevelOfQuestion, type StorySnapshot, type StoryStepSnapshot } from '../lib/content.ts';
import { afterFirstPaint } from '../lib/idle.ts';
import { usePageReady, useRevealed } from '../lib/page-ready.tsx';
import { getProgressStore, nowIso } from '../lib/progress/index.ts';
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
  const replay = useMemo(() => (core && story ? core.replayLab(core.asCoreStory(story)) : null), [core, story]);
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
  const run = replay ? replay.value : null;
  const step = run && stepId ? run.stepById(stepId) : undefined;
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
        run={run}
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
  step: LabStepModel | null;
  run: LabRun | null;
  progress: StoryProgress;
  onProgress: () => void;
}

type Answer = { answer: PredictChoice; nearly: boolean; exact?: 'up' | 'down' | 'unchanged' };

function StepSession({ mode, core, coreError, onLoadCore, story, spec, step, run, progress, onProgress }: SessionProps) {
  const { t } = useLingui();
  const locale = useLocale();
  const [params, setParams] = useSearchParams();
  const demo = mode === 'demo';
  const stages = stagesOf(mode);
  const from = params.get('from');
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
  const values = step?.values ?? firstPaint?.values ?? {};
  const before = (lineId: string): number => (step ? lineAt(step.before, lineId) : (firstPaint?.before[lineId] ?? 0));
  const after = (lineId: string): number => (step ? lineAt(step.after, lineId) : (firstPaint?.after[lineId] ?? 0));
  const hasCore = step !== null && run !== null;

  // 進度：練習模式第一次練這一步，預測要先完成（03 第 3.3 節）；練過的再回來，預測可略過、有跳到最後的捷徑；示範沒有預測
  const alreadyDone = progress.done.includes(spec.id);
  const practised = progress.practised.includes(spec.id);
  const predictRequired = !demo && !practised;
  const savedPrediction = progress.predictions[spec.id];
  const [record, setRecord] = useState<PredictionRecord>(() => savedPrediction ?? {});
  const [submitted, setSubmitted] = useState(() => !demo && savedPrediction !== undefined && practised);
  const targets = useMemo(() => predictTargetsOf(spec.predictTargets), [spec.predictTargets]);
  const predictDone = submitted && isPredictionComplete(targets, record);
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
  const [view, setView] = useState<StatementView>('cumulative');
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [highlight, setHighlight] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedLight, setSelectedLight] = useState<2 | 3 | 4 | 5 | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  // 來源面板（M4b，03 第 3.9 節）：第一次點可追蹤的數字才載面板的模組；關閉後焦點回到那個數字
  const [trace, setTrace] = useState<TraceTarget | null>(null);
  const [traceViews, setTraceViews] = useState<TraceViews | null>(() => tracePanelNow());
  const traceReturn = useRef<HTMLElement | null>(null);
  const openTrace = (target: TraceTarget, el: HTMLElement) => {
    traceReturn.current = el;
    setTrace(target);
    if (!hasCore) onLoadCore();
    if (traceViews === null) loadTracePanel().then(setTraceViews, () => setTrace(null));
  };
  const [finished, setFinished] = useState<{ unlockedTerms: string[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fromHref, setFromHref] = useState<string | null>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);

  // 分錄層的展開狀態記在 settings 的 labView.journalLayerOpen
  useEffect(() => {
    let alive = true;
    getProgressStore()
      .then((s) => s.getSetting('labView'))
      .then((v) => {
        const open = (v?.value as { journalLayerOpen?: boolean } | undefined)?.journalLayerOpen;
        if (alive && typeof open === 'boolean') setJournalOpen(open);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const toggleJournal = (open: boolean) => {
    setJournalOpen(open);
    void getProgressStore()
      .then(async (s) => {
        const cur = ((await s.getSetting('labView'))?.value as Record<string, unknown> | undefined) ?? {
          policy: 'teacher@1',
          window: 'cumulative',
          statement: 'is',
        };
        await s.setSetting('labView', { ...cur, journalLayerOpen: open }, nowIso());
      })
      .catch(() => {});
  };
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
  }, []);
  const go = useCallback(
    (to: number) => {
      if (!canGoTo(stage, to, gate)) return;
      // 交易卡之後的階段要畫面元件與名詞索引（科目與指標的名稱）、預測之後的階段還要核心
      const id = stages[to]!;
      const needViews = id !== 'card' && (views === null || !termsReady);
      const needCore = id !== 'card' && id !== 'predict' && !hasCore;
      if (needViews || needCore) {
        setPendingStage(to);
        if (views === null) loadViews();
        if (needCore) onLoadCore();
        return;
      }
      enter(to);
    },
    [stage, stages, gate, hasCore, views, termsReady, onLoadCore, loadViews, enter],
  );
  useEffect(() => {
    if (pendingStage === null || views === null || !termsReady) return;
    const id = stages[pendingStage]!;
    if (id === 'card' || id === 'predict' || hasCore) enter(pendingStage);
  }, [pendingStage, stages, views, termsReady, hasCore, enter]);
  // 方向鍵左右切換階段（焦點不在輸入框時，03 第 3.11 節）
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
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
  const scoreOf = (rec: PredictionRecord) =>
    answerOf
      ? {
          right: targets.filter((tg) => {
            const a = answerOf(tg);
            return isPredictionCorrect(rec[tg.id], a.answer, a.nearly, a.exact);
          }).length,
          total: targets.length,
        }
      : null;
  // 記下預測：成績要核心才算得出；核心還沒到時先記著，載好再存（存的是當時的 record）
  const pendingSave = useRef(false);
  const submitPrediction = () => {
    setSubmitted(true);
    const score = scoreOf(record);
    if (score) void savePrediction(story.id, spec.id, record, score);
    else {
      pendingSave.current = true;
      onLoadCore();
    }
  };
  useEffect(() => {
    if (!pendingSave.current || !hasCore) return;
    pendingSave.current = false;
    const score = scoreOf(record);
    if (score) void savePrediction(story.id, spec.id, record, score);
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
      ? targets.map((tg) => {
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
  const levelTargets = targets.filter((tg): tg is PredictTarget & { kind: 'line' } => tg.kind === 'line' && tg.line.startsWith('is_'));
  const revealNote =
    submitted && answerOf && levelTargets.length > 0 && levelTargets.every((tg) => answerOf(tg).answer === 'unchanged')
      ? t({ id: 'lab.reveal.noteLevels', message: '這筆交易不經過損益表，所以五層利益都不變。', comment: '揭曉卡的原因句：收入與費用都沒動' })
      : undefined;
  // 完成卡的預測成績：這一步加整個故事（含這一步，進度快照可能還是舊的）
  const storyTotals = predictTotals({ predictScores: revealScore ? { ...progress.predictScores, [spec.id]: revealScore } : progress.predictScores });

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
          .map((l) => `${lineLabel(l)}由 ${formatMoney(lineAt(step.before, l), locale)} 變為 ${formatMoney(lineAt(step.after, l), locale)}`)
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

  return (
    <div
      className="ll-lab-session"
      data-testid="lab-session"
      data-stage={stageId}
      data-mode={mode}
      data-core={hasCore ? 'ready' : 'pending'}
      data-views={views ? 'ready' : 'pending'}
      data-terms={termsReady ? 'ready' : 'pending'}
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
      <div className="ll-lab-session__sticky">
        <p className="ll-lab-session__equation" data-testid="lab-equation">
          {lineLabel(EQUATION_LINES[0])} {equationValue(EQUATION_LINES[0])} ＝ {lineLabel(EQUATION_LINES[1])} {equationValue(EQUATION_LINES[1])} ＋{' '}
          {lineLabel(EQUATION_LINES[2])} {equationValue(EQUATION_LINES[2])}
        </p>
      </div>
      <h2 id="ll-lab-stage-heading" className="ll-lab-session__stage" data-testid="lab-stage-title">
        {t({ id: 'lab.stage.progress', message: `階段 ${stage + 1}／${stages.length}：${names[stageId]}` })}
      </h2>
      <p ref={liveRef} className="ll-sr-only" aria-live="polite" data-testid="lab-live">
        {liveText}
      </p>
      <section className={`ll-lab-session__content${reduced ? '' : ' ll-lab-animate'}`} aria-labelledby="ll-lab-stage-heading">
        {pendingStage !== null && (coreError !== undefined || viewsError !== undefined) && (
          <ErrorState
            title={t({ id: 'lab.step.coreError', message: '讀不到後面的階段', comment: '核心或階段畫面的模組載入失敗（離線）時的錯誤標題；重試會再載一次' })}
            onRetry={() => {
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
          />
        )}
        {views && stageId === 'predict' && (
          <views.PredictPanel
            targets={targets}
            labelOf={labelOfTarget}
            record={record}
            onChange={setRecord}
            onSubmit={submitPrediction}
            submitted={submitted}
            submittedNote={t({ id: 'lab.live.predicted', message: '已記下你的預測。' })}
          />
        )}
        {views && step && chart && stageId === 'effects' && revealScore && (
          <views.PredictReveal items={revealItems} right={revealScore.right} total={revealScore.total} locale={locale} note={revealNote} />
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
                  value={view === 'columns' ? 'cumulative' : view}
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
                      {lineLabel(tg.line)}：
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
                {revealScore && (
                  <p className="ll-lab-finished__score" data-testid="lab-finish-score">
                    {t({
                      id: 'lab.finish.score',
                      message: `這一步的預測猜對 ${formatNumber(revealScore.right, locale)}／${formatNumber(revealScore.total, locale)}；整個故事到目前 ${formatNumber(storyTotals.right, locale)}／${formatNumber(storyTotals.total, locale)}（${formatNumber(storyTotals.steps, locale)} 步）`,
                      comment: '完成卡的預測成績；數字都已格式化',
                    })}
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
      {traceViews && step && run && (
        <traceViews.TracePanel
          open={trace !== null}
          onClose={() => setTrace(null)}
          returnFocusTo={traceReturn}
          target={trace}
          run={run}
          step={step}
          trace={(window, lineId) => core!.traceLabLine(run, step, window, lineId)}
          entriesOf={(id) => core!.entriesOfStep(run, id)}
          layout={layout}
          stepInfo={(id) => {
            const s = story.steps.find((x) => x.id === id);
            return s === undefined ? undefined : { order: s.order, title: s.title };
          }}
          stepHref={(id) => (id === spec.id || !story.steps.some((x) => x.id === id) ? null : href(`/lab/story/${story.id}/${id}/`))}
          onHighlight={(lines, statement) => {
            setSelectedLight(null);
            setHighlight(new Set(lines));
            setTab(STATEMENT_CODE[statement]);
            setManualTab(true);
          }}
        />
      )}
      <ToastRegion className="ll-float-toasts" data-testid="lab-toasts">
        {toast && (
          <Toast kind="collect" onDismiss={() => setToast(null)}>
            {toast}
          </Toast>
        )}
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
