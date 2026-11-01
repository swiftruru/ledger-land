// 故事步驟頁 /lab/story/<storyId>/<stepId>/（02 第 1.1 節、03 第 3.3 到 3.6、3.11、3.12 節）：一步 10 個階段，由「下一步」推進；
// 單獨練習（?mode=practice）沿用故事在該步之前的狀態（核心從第一步重播，03 第 3.1 節），不改變故事進度。
// 整頁等故事快照、進度與名詞索引齊了才出現；核心的重播模組與內建資料（約 42 KB gzip）不在第一波（06 第 8.2 節、14 的 V24）：
// 交易卡、恆等式與預測面板先用快照裡建置時由同一份核心算好的數字與列名（firstPaint）畫，核心在畫面掀開之後才載入（afterFirstPaint），
// 載好以後每個數字都來自 lab-core.ts 的結果；階段 3 起要核心，核心還沒到時「下一步」先記著，載好就切過去。每個階段一句 aria-live 摘要；
// 減少動態效果時天平與數字直接是結束狀態（motion.ts）。字串在第三層 catalog（lab.po）。
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { formatMoney, formatNumber, localePath } from '@ledgerland/i18n';
import { Button, Card, CheckCircleIcon, ErrorState, HintBar, Segmented, Toast, ToastRegion, TopBar, XCircleIcon } from '@ledgerland/web-ui';
import { labPrefersReducedMotion } from '../features/lab/motion.ts';
import { BalanceScale } from '../features/lab/BalanceScale.tsx';
import { CheckLights, ProfitLevels } from '../features/lab/CheckLights.tsx';
import { EffectsList } from '../features/lab/EffectsList.tsx';
import type { LabRun, LabStep as LabStepModel } from '../features/lab/lab-core.ts';
import type { LabCore } from '../features/lab/lazy-core.ts';
import { firstPaintLayout, joinList, lineAt, useChangeText, useLabLabels, type LayoutLike } from '../features/lab/labels.ts';
import { PredictPanel } from '../features/lab/PredictPanel.tsx';
import { PredictReveal, type RevealItem } from '../features/lab/PredictReveal.tsx';
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
import { completeStep, moveStoryTo, predictTotals, savePrediction, type StoryProgress } from '../features/lab/progress.ts';
import { RatioList } from '../features/lab/RatioList.tsx';
import { ratioChanges, ratioPoint } from '../features/lab/ratio-changes.ts';
import { PREDICT_STAGE, STAGES, STAGE_COUNT, canGoTo, canSkipToEnd, statementForStage, type StageGate } from '../features/lab/stages.ts';
import { StageBar, useStageNames } from '../features/lab/StageBar.tsx';
import { StatementTable, changeSummary, type StatementView } from '../features/lab/StatementTable.tsx';
import { TransactionCard } from '../features/lab/TransactionCard.tsx';
import { useLabStepLoad } from '../features/lab/useLab.ts';
import { useExpanded } from '../features/me/useExpanded.ts';
import { useWide } from '../features/lab/useWide.ts';
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
/** 固定在上方的恆等式三列；要和 tools/lib/content-rules.mjs 的 FIRST_PAINT_LINES.equation 一致（核心載入前用快照的數字） */
const EQUATION_LINES = ['bs_total_assets', 'bs_total_liabilities', 'bs_total_equity'] as const;

export default function LabStep() {
  const { storyId, stepId } = useParams();
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
  // 畫面掀開（第一次繪製真的送出）之後才載核心：Lighthouse 把 LCP 之前開始的請求都算進 LCP（06 第 8.2 節）
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
    <TermsProvider locale={locale}>
      <StepSession
        key={`${story.id}:${stepId}`}
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

function StepSession({ core, coreError, onLoadCore, story, spec, step, run, progress, onProgress }: SessionProps) {
  const { t } = useLingui();
  const locale = useLocale();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const practice = params.get('mode') === 'practice';
  const from = params.get('from');
  const { ready: termsReady } = useTerms();
  // 版面：核心的版面，或核心載入前由快照的 firstPaint.lines 做成（只有恆等式、前情摘要與預測目標的列）
  const layout: LayoutLike = useMemo(() => run?.ctx.layout ?? firstPaintLayout(story.firstPaint?.lines ?? {}), [run, story]);
  const { lineLabel, accountLabel, ratioLabel } = useLabLabels(layout);
  const change = useChangeText();
  const names = useStageNames();
  const roles = useRoleLabels();
  const expanded = useExpanded();
  const wide = useWide();
  const reduced = labPrefersReducedMotion();
  const href = (p: string) => localePath(locale, p);
  const storyHref = href(`/lab/story/${story.id}/`);
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

  // 進度：故事模式第一次走這一步、或單獨練習，預測要先完成（03 第 3.3 節）
  const alreadyDone = progress.done.includes(spec.id);
  const predictRequired = practice || !alreadyDone;
  const savedPrediction = progress.predictions[spec.id];
  const [record, setRecord] = useState<PredictionRecord>(() => savedPrediction ?? {});
  const [submitted, setSubmitted] = useState(() => savedPrediction !== undefined && !practice && alreadyDone);
  const targets = useMemo(() => predictTargetsOf(spec.predictTargets), [spec.predictTargets]);
  const predictDone = submitted && isPredictionComplete(targets, record);
  const gate: StageGate = useMemo(() => ({ predictRequired, predictDone }), [predictRequired, predictDone]);

  const [stage, setStage] = useState(0);
  // 階段 3 起要核心：核心還沒到時先記著要去的階段，載好就切過去（go）
  const [pendingStage, setPendingStage] = useState<number | null>(null);
  const [manualTab, setManualTab] = useState(false);
  const [tab, setTab] = useState<StatementCode>('is');
  const [view, setView] = useState<StatementView>('cumulative');
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [highlight, setHighlight] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedLight, setSelectedLight] = useState<2 | 3 | 4 | 5 | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
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
    const auto = statementForStage(stage);
    if (auto !== null && !manualTab) setTab(auto);
  }, [stage, manualTab]);

  const enter = useCallback((to: number) => {
    setPendingStage(null);
    setStage(to);
    setSelectedLight(null);
    setHighlight(new Set());
  }, []);
  const go = useCallback(
    (to: number) => {
      if (!canGoTo(stage, to, gate)) return;
      if (to > PREDICT_STAGE && !hasCore) {
        setPendingStage(to);
        onLoadCore();
        return;
      }
      enter(to);
    },
    [stage, gate, hasCore, onLoadCore, enter],
  );
  useEffect(() => {
    if (pendingStage !== null && hasCore) enter(pendingStage);
  }, [pendingStage, hasCore, enter]);
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

  const summary = step ? changeSummary(step.before, step.after, lineLabel, locale) : null;
  const ratios = useMemo(() => (core && step ? ratioChanges(core, 'excel', step.ratiosBefore, step.ratiosAfter) : []), [core, step]);
  const ratioVerdicts = Object.fromEntries(
    targets
      .filter((tg): tg is PredictTarget & { kind: 'ratio' } => tg.kind === 'ratio')
      .map((tg) => [tg.ratioRef, verdictOf(tg) ?? { correct: false, nearly: false }]),
  );
  const cashTarget = targets.find((tg) => tg.kind === 'line' && tg.line === 'bs_cash');
  const cashVerdict = cashTarget && submitted ? { chosen: record[cashTarget.id] ?? '', correct: verdictOf(cashTarget)?.correct ?? false } : null;

  // 每個階段一句播報（03 第 3.11 節）；階段 1 與 2 不用核心，其他階段沒有核心就不會進得去
  const liveText = (() => {
    const id = STAGES[stage]!;
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
    const res = await completeStep({ storyId: story.id, stepId: spec.id, termRefs: spec.termRefs, mode: practice ? 'practice' : 'story' });
    setFinished(res);
    onProgress();
    if (res.unlockedTerms.length > 0)
      setToast(t({ id: 'lab.toast.terms', message: `收進名詞圖鑑：${res.unlockedTerms.length} 個名詞`, comment: '走完一步時解鎖名詞的提示；數字已代入' }));
  };
  const isLast = stage === STAGE_COUNT - 1;
  const onNext = () => {
    if (isLast) void finish();
    else go(stage + 1);
  };

  const tabs: { value: StatementCode; label: string }[] = [
    { value: 'is', label: names.income },
    { value: 'cf', label: names.cashflow },
    { value: 'bs', label: names.balance },
  ];
  const table = (s: LabStepModel, code: StatementCode, v: StatementView) => (
    <StatementTable
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
      id={`ll-lab-table-${code}`}
    />
  );
  const stageId = STAGES[stage]!;
  const designNotes = [...new Set(spec.events.flatMap((e) => e.pendingRefs ?? []))];
  const title = t({ id: 'lab.step.title', message: `第 ${spec.order} 步：${spec.title}`, comment: '步驟頁的標題；數字與標題已代入' });
  const prevDone = prevStepId === undefined || progress.done.includes(prevStepId);
  usePageReady(termsReady);

  return (
    <div
      className="ll-lab-session"
      data-testid="lab-session"
      data-stage={stageId}
      data-mode={practice ? 'practice' : 'story'}
      data-core={hasCore ? 'ready' : 'pending'}
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
      {practice && (
        <p className="ll-lab-session__mode" data-testid="lab-practice-flag">
          <Trans id="lab.step.practiceMode" comment="單獨練習的標示">
            單獨練習：不改變故事進度
          </Trans>
        </p>
      )}
      <div className="ll-lab-session__sticky">
        <p className="ll-lab-session__equation" data-testid="lab-equation">
          {lineLabel(EQUATION_LINES[0])} {formatMoney(after(EQUATION_LINES[0]), locale)} ＝ {lineLabel(EQUATION_LINES[1])}{' '}
          {formatMoney(after(EQUATION_LINES[1]), locale)} ＋ {lineLabel(EQUATION_LINES[2])} {formatMoney(after(EQUATION_LINES[2]), locale)}
        </p>
      </div>
      <h2 id="ll-lab-stage-heading" className="ll-lab-session__stage" data-testid="lab-stage-title">
        {t({ id: 'lab.stage.progress', message: `階段 ${stage + 1}／${STAGE_COUNT}：${names[stageId]}` })}
      </h2>
      <p ref={liveRef} className="ll-sr-only" aria-live="polite" data-testid="lab-live">
        {liveText}
      </p>
      <section className={`ll-lab-session__content${reduced ? '' : ' ll-lab-animate'}`} aria-labelledby="ll-lab-stage-heading">
        {pendingStage !== null && coreError !== undefined && (
          <ErrorState
            title={t({ id: 'lab.step.coreError', message: '讀不到報表的計算模組', comment: '核心模組載入失敗（離線）時的錯誤標題；重試會再載一次' })}
            onRetry={onLoadCore}
          />
        )}
        {stageId === 'card' && (
          <TransactionCard
            spec={spec}
            values={values}
            before={before}
            layout={layout}
            recap={practice || (!alreadyDone && index > 0 && !prevDone)}
            suggestEarlier={!practice && !from && index > 0 && !prevDone}
          />
        )}
        {stageId === 'predict' && (
          <PredictPanel
            targets={targets}
            labelOf={labelOfTarget}
            record={record}
            onChange={setRecord}
            onSubmit={submitPrediction}
            submitted={submitted}
            submittedNote={t({ id: 'lab.live.predicted', message: '已記下你的預測。' })}
          />
        )}
        {step && chart && stageId === 'effects' && revealScore && (
          <PredictReveal items={revealItems} right={revealScore.right} total={revealScore.total} locale={locale} note={revealNote} />
        )}
        {step && chart && stageId === 'effects' && (
          <EffectsList
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
        {step && stageId === 'equation' && <BalanceScale before={step.before} after={step.after} layout={layout} animate={!reduced} />}
        {step && summary && (stageId === 'income' || stageId === 'cashflow' || stageId === 'balance') && (
          <div className="ll-lab-tables" data-expanded={expanded ? 'true' : 'false'}>
            <div className="ll-lab-tables__controls">
              {!expanded && (
                <Segmented
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
                <Segmented
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
              <label className="ll-lab-tables__only">
                <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} />{' '}
                {t({ id: 'lab.tables.onlyChanged', message: '只看有變動的列', comment: '表格的篩選' })}
              </label>
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
            <div className="ll-lab-tables__grid">
              {expanded ? (['is', 'cf', 'bs'] as const).map((c) => table(step, c, wide ? 'columns' : view)) : table(step, tab, view)}
            </div>
          </div>
        )}
        {step && stageId === 'checks' && (
          <div className="ll-lab-checks">
            <ProfitLevels before={step.before} after={step.after} layout={layout} />
            <CheckLights
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
        {step && stageId === 'ratios' && <RatioList items={ratios} layout={layout} splitUnchanged verdicts={ratioVerdicts} />}
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
                  {practice
                    ? t({ id: 'lab.finish.practice', message: '練習完成', comment: '完成卡標題' })
                    : t({ id: 'lab.finish.story', message: '這一步走完了', comment: '完成卡標題' })}
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
                  {practice ? (
                    <>
                      <Button
                        size="md"
                        onClick={() => {
                          setFinished(null);
                          setStage(0);
                          setSubmitted(false);
                          setRecord({});
                        }}
                      >
                        {t({ id: 'lab.finish.again', message: '再練一次', comment: '完成卡按鈕' })}
                      </Button>
                      <Button size="md" href={storyHref}>
                        {t({ id: 'lab.finish.map', message: '回到故事地圖', comment: '完成卡按鈕' })}
                      </Button>
                      <Button
                        size="md"
                        variant="primary"
                        onClick={() =>
                          void moveStoryTo(story.id, spec.id).then(() => navigate(nextStepId ? href(`/lab/story/${story.id}/${nextStepId}/`) : storyHref))
                        }
                      >
                        {t({ id: 'lab.finish.continueFromHere', message: '從這一步接著走故事', comment: '完成卡按鈕' })}
                      </Button>
                    </>
                  ) : (
                    <>
                      {nextStepId && (
                        <Button size="md" variant="primary" href={href(`/lab/story/${story.id}/${nextStepId}/`)} data-testid="lab-next-step">
                          {t({ id: 'lab.finish.next', message: '下一步', comment: '完成卡按鈕' })}
                        </Button>
                      )}
                      <Button size="md" href={storyHref}>
                        {t({ id: 'lab.finish.map', message: '回到故事地圖' })}
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            )}
          </div>
        )}
      </section>
      <StageBar
        stage={stage}
        canPrev={stage > 0}
        canNext={isLast ? !finished : canGoTo(stage, stage + 1, gate)}
        canSkip={canSkipToEnd(stage, gate)}
        isLast={isLast}
        canJumpTo={(s) => canGoTo(stage, s, gate)}
        onPrev={() => go(stage - 1)}
        onNext={onNext}
        onSkip={() => go(STAGE_COUNT - 1)}
        onJump={go}
      />
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
