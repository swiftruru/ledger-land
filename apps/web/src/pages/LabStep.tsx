// 故事步驟頁 /lab/story/<storyId>/<stepId>/（02 第 1.1 節、03 第 3.3 到 3.6、3.11、3.12 節）：一步 10 個階段，由「下一步」推進；
// 單獨練習（?mode=practice）沿用故事在該步之前的狀態（核心從第一步重播，03 第 3.1 節），不改變故事進度。
// 整頁等故事快照、核心、進度與名詞索引齊了才出現；每個數字都來自 lab-core.ts 的結果；每個階段一句 aria-live 摘要；
// 減少動態效果時天平與數字直接是結束狀態（motion.ts）。字串在第三層 catalog（lab.po）。
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { formatMoney, localePath } from '@ledgerland/i18n';
import { Button, Card, ErrorState, HintBar, Segmented, Toast, ToastRegion, TopBar } from '@ledgerland/web-ui';
import { labPrefersReducedMotion } from '../features/lab/motion.ts';
import { BalanceScale } from '../features/lab/BalanceScale.tsx';
import { CheckLights, ProfitLevels } from '../features/lab/CheckLights.tsx';
import { EffectsList } from '../features/lab/EffectsList.tsx';
import type { LabRun, LabStep as LabStepModel } from '../features/lab/lab-core.ts';
import type { LabCore } from '../features/lab/lazy-core.ts';
import { joinList, lineAt, useChangeText, useLabLabels } from '../features/lab/labels.ts';
import { PredictPanel } from '../features/lab/PredictPanel.tsx';
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
import { completeStep, moveStoryTo, savePrediction, type StoryProgress } from '../features/lab/progress.ts';
import { RatioList } from '../features/lab/RatioList.tsx';
import { ratioChanges, ratioPoint } from '../features/lab/ratio-changes.ts';
import { STAGES, STAGE_COUNT, canGoTo, canSkipToEnd, statementForStage, type StageGate } from '../features/lab/stages.ts';
import { StageBar, useStageNames } from '../features/lab/StageBar.tsx';
import { StatementTable, changeSummary, type StatementView } from '../features/lab/StatementTable.tsx';
import { TransactionCard } from '../features/lab/TransactionCard.tsx';
import { useLabStory } from '../features/lab/useLab.ts';
import { useExpanded } from '../features/me/useExpanded.ts';
import { useWide } from '../features/lab/useWide.ts';
import { MarkupParagraphs } from '../features/quiz/Markup.tsx';
import { TermsProvider, useTerms } from '../features/quiz/terms.tsx';
import { findLevelOfQuestion, type StorySnapshot, type StoryStepSnapshot } from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { getProgressStore, nowIso } from '../lib/progress/index.ts';
import { useLocale } from '../lib/useLocale.ts';
import { NotFound } from './NotFound.tsx';
import { useLabBack } from '../features/lab/useLabBack.ts';
import '../styles/lab.css';

type StatementCode = 'is' | 'cf' | 'bs';
const STATEMENT_KEY = { is: 'income_statement', cf: 'cash_flow_indirect', bs: 'balance_sheet' } as const;

export default function LabStep() {
  const { storyId, stepId } = useParams();
  const locale = useLocale();
  const lab = useLabStory(storyId, locale);
  const { t } = useLingui();
  const back = useLabBack();
  const href = (p: string) => localePath(locale, p);
  usePageReady(lab.kind !== 'loading');
  if (lab.kind === 'error' && lab.error.kind === 'missing') return <NotFound />;
  if (lab.kind === 'error')
    return (
      <>
        <TopBar title={t({ id: 'lab.story.title', message: '故事' })} backHref={href('/lab/')} backLabel={back.label} backShortLabel={back.short} />
        <ErrorState title={t({ id: 'lab.error.title', message: '讀不到實驗室的故事', comment: '實驗室離線時的錯誤標題' })} onRetry={lab.retry} />
      </>
    );
  if (lab.kind !== 'ok')
    return <TopBar title={t({ id: 'lab.story.title', message: '故事' })} backHref={href('/lab/')} backLabel={back.label} backShortLabel={back.short} />;
  const replay = lab.core.replayLab(lab.core.asCoreStory(lab.story));
  if (!replay.ok) throw new Error(`故事重播失敗：${replay.error.code}`);
  const step = stepId ? replay.value.stepById(stepId) : undefined;
  const spec = lab.story.steps.find((s) => s.id === stepId);
  if (!step || !spec) return <NotFound />;
  return (
    <TermsProvider locale={locale}>
      <StepSession
        key={`${lab.story.id}:${stepId}`}
        core={lab.core}
        story={lab.story}
        spec={spec}
        step={step}
        run={replay.value}
        progress={lab.progress.progress}
        onProgress={lab.refreshProgress}
      />
    </TermsProvider>
  );
}

interface SessionProps {
  core: LabCore;
  story: StorySnapshot;
  spec: StoryStepSnapshot;
  step: LabStepModel;
  run: LabRun;
  progress: StoryProgress;
  onProgress: () => void;
}

function StepSession({ core, story, spec, step, run, progress, onProgress }: SessionProps) {
  const { t } = useLingui();
  const locale = useLocale();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const practice = params.get('mode') === 'practice';
  const from = params.get('from');
  const { ready: termsReady } = useTerms();
  const layout = run.ctx.layout;
  const { lineLabel, accountLabel, ratioLabel } = useLabLabels(layout);
  const change = useChangeText();
  const names = useStageNames();
  const roles = useRoleLabels();
  const expanded = useExpanded();
  const wide = useWide();
  const reduced = labPrefersReducedMotion();
  const href = (p: string) => localePath(locale, p);
  const storyHref = href(`/lab/story/${story.id}/`);

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

  const go = useCallback(
    (to: number) => {
      if (!canGoTo(stage, to, gate)) return;
      setStage(to);
      setSelectedLight(null);
      setHighlight(new Set());
    },
    [stage, gate],
  );
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

  // 預測的答案（由核心的前後數字算）
  const chart = run.ctx.chart;
  const answerOf = (tg: PredictTarget): { answer: PredictChoice; nearly: boolean; exact?: 'up' | 'down' | 'unchanged' } => {
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
  };
  const verdictOf = (tg: PredictTarget) => {
    if (!submitted) return null;
    const a = answerOf(tg);
    return { correct: isPredictionCorrect(record[tg.id], a.answer, a.nearly, a.exact), nearly: a.nearly };
  };
  const labelOfTarget = (tg: PredictTarget) =>
    tg.kind === 'line' ? lineLabel(tg.line) : tg.kind === 'account' ? accountLabel(tg.account) : ratioLabel(tg.ratioRef.split('@')[0]!);
  const submitPrediction = () => {
    setSubmitted(true);
    void savePrediction(story.id, spec.id, record);
  };

  const summary = changeSummary(step.before, step.after, lineLabel, locale);
  const ratios = useMemo(() => ratioChanges(core, 'excel', step.ratiosBefore, step.ratiosAfter), [core, step]);
  const ratioVerdicts = Object.fromEntries(
    targets
      .filter((tg): tg is PredictTarget & { kind: 'ratio' } => tg.kind === 'ratio')
      .map((tg) => [tg.ratioRef, verdictOf(tg) ?? { correct: false, nearly: false }]),
  );
  const cashTarget = targets.find((tg) => tg.kind === 'line' && tg.line === 'bs_cash');
  const cashVerdict = cashTarget && submitted ? { chosen: record[cashTarget.id] ?? '', correct: verdictOf(cashTarget)?.correct ?? false } : null;

  // 每個階段一句播報（03 第 3.11 節）
  const liveText = (() => {
    const id = STAGES[stage]!;
    const cash = lineAt(step.after, 'bs_cash') - lineAt(step.before, 'bs_cash');
    switch (id) {
      case 'card':
        return t({ id: 'lab.live.card', message: `第 ${spec.order} 步，${spec.title}。`, comment: '階段 1 的播報；數字與標題已代入' });
      case 'predict':
        return submitted
          ? t({ id: 'lab.live.predicted', message: '已記下你的預測。', comment: '記下預測後的播報' })
          : t({ id: 'lab.live.predict', message: '替每個目標選一個方向。', comment: '階段 2 的播報' });
      case 'effects':
        return step.posted.effects
          .filter((e) => e.direction !== 'unchanged')
          .map((e) => `${accountLabel(e.account)}${change(e.delta)}`)
          .join(locale === 'en' ? '. ' : '。');
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
  const nextStepId = run.stepIds[step.index + 1];
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
  const table = (code: StatementCode, v: StatementView) => (
    <StatementTable
      key={code}
      caption={tabs.find((x) => x.value === code)!.label}
      statement={STATEMENT_KEY[code]}
      before={step.before}
      after={step.after}
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
  usePageReady(termsReady);

  return (
    <div className="ll-lab-session" data-testid="lab-session" data-stage={stageId} data-mode={practice ? 'practice' : 'story'}>
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
          {lineLabel('bs_total_assets')} {formatMoney(lineAt(step.after, 'bs_total_assets'), locale)} ＝ {lineLabel('bs_total_liabilities')}{' '}
          {formatMoney(lineAt(step.after, 'bs_total_liabilities'), locale)} ＋ {lineLabel('bs_total_equity')}{' '}
          {formatMoney(lineAt(step.after, 'bs_total_equity'), locale)}
        </p>
      </div>
      <h2 id="ll-lab-stage-heading" className="ll-lab-session__stage" data-testid="lab-stage-title">
        {t({ id: 'lab.stage.progress', message: `階段 ${stage + 1}／${STAGE_COUNT}：${names[stageId]}` })}
      </h2>
      <p ref={liveRef} className="ll-sr-only" aria-live="polite" data-testid="lab-live">
        {liveText}
      </p>
      <section className={`ll-lab-session__content${reduced ? '' : ' ll-lab-animate'}`} aria-labelledby="ll-lab-stage-heading">
        {stageId === 'card' && (
          <TransactionCard
            spec={spec}
            step={step}
            layout={layout}
            recap={practice || (!alreadyDone && step.index > 0 && !progress.done.includes(run.stepIds[step.index - 1] ?? ''))}
            suggestEarlier={!practice && !from && step.index > 0 && !progress.done.includes(run.stepIds[step.index - 1] ?? '')}
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
        {stageId === 'effects' && (
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
        {stageId === 'equation' && <BalanceScale before={step.before} after={step.after} layout={layout} animate={!reduced} />}
        {(stageId === 'income' || stageId === 'cashflow' || stageId === 'balance') && (
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
                {targets
                  .filter((tg): tg is PredictTarget & { kind: 'line' } => tg.kind === 'line' && tg.line.startsWith('is_'))
                  .map((tg) => {
                    const v = verdictOf(tg);
                    return (
                      <li key={tg.id} className={`ll-lab-verdict is-${v?.correct ? 'right' : 'wrong'}`}>
                        {lineLabel(tg.line)}：
                        {v?.correct ? t({ id: 'lab.predict.right', message: '你的預測正確' }) : t({ id: 'lab.predict.wrong', message: '和你的預測不同' })}
                      </li>
                    );
                  })}
              </ul>
            )}
            <div className="ll-lab-tables__grid">
              {expanded ? (['is', 'cf', 'bs'] as const).map((c) => table(c, wide ? 'columns' : view)) : table(tab, view)}
            </div>
          </div>
        )}
        {stageId === 'checks' && (
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
        {stageId === 'ratios' && <RatioList items={ratios} layout={layout} splitUnchanged verdicts={ratioVerdicts} />}
        {stageId === 'insight' && (
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
