// 錯題複習的清單（2026-11-13 改寫；之前是「錯過與還不熟的題」，M4c 第二批；02 第 1.1 節）：/exam/list/，?tab=review 或 mastered 換分頁。
// 答錯過的題分三個階段（features/exam/stats.ts）：待訂正、複習中、已熟練。頁面由上到下：進度（已熟練／答錯過的題）與「練今天的錯題」、
// 最需要加強的地方（還沒熟練的錯題最多的段與公式，features/exam/notebook.ts）、三個分頁的題目清單（依講義分組，每題一個展開列，
// 標題下面一行寫離熟練還差什麼，展開是唯讀的題目並標出最近一次選的選項）。只載有錯題的講義檔；純瀏覽，不寫紀錄。noindex。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatNumber, localePath } from '@ledgerland/i18n';
import { Badge, Button, Card, Disclosure, EmptyState, ErrorState, PlayIcon, ProgressBar, Segmented, TextLink, TopBar } from '@ledgerland/web-ui';
import { deviceClock } from '../features/exam/day.ts';
import { getExamDb, type QuestionState } from '../features/exam/db.ts';
import { HandoutQuestionReadout } from '../features/exam/HandoutQuestionReadout.tsx';
import { stageGroups, weakFormulas, weakSections, WRONG_STAGES } from '../features/exam/notebook.ts';
import { allQuestionIds } from '../features/exam/sets.ts';
import { isRepeatWrong, needOf, nextStepOf, stageOf, wrongStatsOf, type WrongStage } from '../features/exam/stats.ts';
import { FormulaPills, useFormulasOfQuestions } from '../features/formulas/FormulaPills.tsx';
import {
  loadFormulaIndex,
  loadHandoutDeck,
  loadHandoutIndex,
  type FormulaIndexEntry,
  type HandoutManifestEntry,
  type HandoutQuestionSnapshot,
} from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/exam.css';

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | {
      kind: 'ok';
      index: HandoutManifestEntry;
      states: ReadonlyMap<string, QuestionState>;
      questions: ReadonlyMap<string, HandoutQuestionSnapshot>;
      formulas: readonly FormulaIndexEntry[];
    };

const isStage = (x: string | null): x is WrongStage => x !== null && (WRONG_STAGES as readonly string[]).includes(x);

export default function ExamList() {
  const { t } = useLingui();
  const formulasOf = useFormulasOfQuestions();
  const locale = useLocale();
  const href = (p: string) => localePath(locale, p);
  const [search, setSearch] = useSearchParams();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    (async (): Promise<State> => {
      const index = await loadHandoutIndex();
      if (!index) return { kind: 'error' };
      const list = await getExamDb()
        .allStates()
        .catch(() => [] as QuestionState[]);
      const states = new Map(list.map((s) => [s.questionId, s]));
      // 只載有錯題的講義檔（三個階段的題都要能展開）
      const clock = deviceClock();
      const decks = index.decks.filter((d) => d.sections.some((s) => s.questionIds.some((id) => stageOf(states.get(id), clock) !== null)));
      const [files, formulas] = await Promise.all([Promise.all(decks.map((d) => loadHandoutDeck(d.id))), loadFormulaIndex(locale).catch(() => [])]);
      const questions = new Map(files.flatMap((f) => f.questions).map((q) => [q.id, q] as const));
      return { kind: 'ok', index, states, questions, formulas };
    })().then(
      (s) => alive && setState(s),
      () => alive && setState({ kind: 'error' }),
    );
    return () => {
      alive = false;
    };
  }, [locale]);
  usePageReady(state.kind !== 'loading');

  const topBar = (
    <TopBar
      title={t({ id: 'exam.list.title', message: '錯題複習', comment: '錯題複習清單頁的標題' })}
      titleId="ll-exam-list-title"
      backHref={href('/exam/')}
      backLabel={t({ id: 'exam.run.back', message: '回到期中考苦練' })}
      backShortLabel={t({ id: 'exam.run.back.short', message: '苦練' })}
    />
  );
  if (state.kind === 'loading') return topBar;
  if (state.kind === 'error')
    return (
      <>
        {topBar}
        <ErrorState
          title={t({ id: 'exam.error.title', message: '題庫載入不到' })}
          description={t({ id: 'exam.error.desc', message: '重新整理再試一次；離線時要先在有網路時開過這一頁。' })}
          onRetry={() => window.location.reload()}
        />
      </>
    );

  const { index, states, questions, formulas } = state;
  const n = (x: number) => formatNumber(x, locale);
  const clock = deviceClock();
  const order = allQuestionIds(index).filter((id) => questions.has(id));
  const stats = wrongStatsOf(order, states, clock);
  const groups = stageGroups(order, states, clock);
  const intro = (
    <p className="ll-exam-intro">
      <Trans id="exam.list.intro" comment="錯題複習清單頁開頭的說明：三個階段與熟練的門檻">
        答錯的題會留在這裡：最近一次答錯的是「待訂正」，答對了但還沒熟練的是「複習中」。連續答對兩次算熟練；反覆答錯的題要連對三次，而且最後一次要在隔天。只看這台裝置的紀錄。
      </Trans>
    </p>
  );
  if (stats.everWrong === 0)
    return (
      <>
        {topBar}
        {intro}
        <EmptyState
          title={t({ id: 'exam.list.empty', message: '還沒有錯題', comment: '錯題複習清單頁：這台裝置沒有答錯過的題' })}
          description={t({
            id: 'exam.list.empty.desc',
            message: '先練幾題，答錯的題會集中到這裡，一直安排練習到熟練為止。',
            comment: '錯題複習清單頁空狀態的說明',
          })}
          action={
            <Button variant="primary" icon={<PlayIcon />} href={href('/exam/all/')}>
              {t({ id: 'exam.start.order', message: '依講義順序練' })}
            </Button>
          }
        />
      </>
    );

  // 沒指定分頁：先看還有題的那一個（待訂正、複習中、已熟練）
  const asked = search.get('tab');
  const tab: WrongStage = isStage(asked) ? asked : (WRONG_STAGES.find((s) => groups[s].length > 0) ?? 'fix');
  const picked = new Set(groups[tab]);
  const decks = [...index.decks]
    .sort((a, b) => a.order - b.order)
    .map((d) => ({ deck: d, ids: d.sections.flatMap((s) => s.questionIds).filter((id) => picked.has(id)) }))
    .filter((g) => g.ids.length > 0);
  const sections = weakSections(index, states, clock);
  const weakFormulaList = weakFormulas(formulas, states, clock);
  const openCount = (count: number) =>
    t({ id: 'exam.list.weak.count', message: `還沒熟練 ${n(count)} 題`, comment: '最需要加強的地方：這一段或這條公式還沒熟練的錯題數（已格式化）' });
  const tabLabel = (stage: WrongStage): string => {
    const count = n(groups[stage].length);
    if (stage === 'fix') return t({ id: 'exam.list.tab.fix', message: `待訂正 ${count}`, comment: '錯題複習的分頁：最近一次答錯的題；count 已格式化' });
    if (stage === 'review')
      return t({ id: 'exam.list.tab.review', message: `複習中 ${count}`, comment: '錯題複習的分頁：答對了但還沒熟練的題；count 已格式化' });
    return t({ id: 'exam.list.tab.mastered', message: `已熟練 ${count}`, comment: '錯題複習的分頁：答錯過、已經練到熟練的題；count 已格式化' });
  };
  /** 這一題離熟練還差什麼（標題下面的一行）；已熟練的不寫 */
  const hintOf = (s: QuestionState): string | null => {
    const stage = stageOf(s, clock);
    if (stage === 'fix')
      return isRepeatWrong(s)
        ? t({
            id: 'exam.list.hint.fixRepeat',
            message: `反覆答錯：要連對 ${n(needOf(s))} 次，最後一次在隔天`,
            comment: '清單頁每題標題下的說明：待訂正、反覆答錯的題；need 是要連對幾次（已格式化）',
          })
        : t({
            id: 'exam.list.hint.fix',
            message: `連對 ${n(needOf(s))} 次就熟練`,
            comment: '清單頁每題標題下的說明：待訂正的題；need 是要連對幾次（已格式化）',
          });
    const step = nextStepOf(s, clock);
    if (step === null) return null;
    return step.tomorrow
      ? t({ id: 'exam.list.hint.tomorrow', message: '明天再答對一次就熟練', comment: '清單頁每題標題下的說明：複習中、今天已經升不上去的題' })
      : t({
          id: 'exam.list.hint.more',
          message: `再連對 ${n(step.more)} 次就熟練`,
          comment: '清單頁每題標題下的說明：複習中的題；more 是還要連對幾次（已格式化）',
        });
  };
  return (
    <>
      {topBar}
      {intro}
      <Card as="section" className="ll-exam-hero" aria-labelledby="ll-exam-list-progress-title" data-testid="exam-list-summary">
        <h2 id="ll-exam-list-progress-title" className="ll-exam-wrongbox__title">
          {t({ id: 'exam.list.progress.title', message: '我的進度', comment: '錯題複習清單頁第一張卡的小標' })}
        </h2>
        <div className="ll-exam-hero__progress">
          <ProgressBar size="md" value={stats.mastered} max={stats.everWrong} />
          <span className="ll-exam-hero__count ll-num" data-testid="exam-list-progress">
            {t({
              id: 'exam.list.progress',
              message: `答錯過 ${n(stats.everWrong)} 題，已熟練 ${n(stats.mastered)} 題`,
              comment: '錯題複習清單頁的進度；數字都已格式化',
            })}
          </span>
        </div>
        {stats.due > 0 ? (
          <div className="ll-exam-hero__actions">
            <Button variant="primary" size="md" icon={<PlayIcon />} href={href('/exam/wrong/')} data-testid="exam-list-practise">
              {t({ id: 'exam.start.wrong', message: `練今天的錯題（${n(stats.due)} 題）` })}
            </Button>
          </div>
        ) : (
          <p className="ll-exam-hero__note" data-testid="exam-list-done">
            {stats.waiting > 0
              ? t({
                  id: 'exam.summary.waiting',
                  message: `今天的錯題都練完了，還有 ${n(stats.waiting)} 題明天再練。`,
                })
              : t({ id: 'exam.list.allMastered', message: '答錯過的題都練到熟練了。', comment: '錯題複習清單頁：沒有還沒熟練的錯題' })}
          </p>
        )}
      </Card>
      {sections.length > 0 && (
        <Card as="section" className="ll-exam-hero" aria-labelledby="ll-exam-weak-title" data-testid="exam-weak">
          <h2 id="ll-exam-weak-title" className="ll-exam-wrongbox__title">
            {t({ id: 'exam.list.weak.title', message: '最需要加強的地方', comment: '錯題複習清單頁第二張卡的小標：還沒熟練的錯題最多的段與公式' })}
          </h2>
          <ul className="ll-exam-weak" data-testid="exam-weak-sections">
            {sections.map((a) => (
              <li key={a.id}>
                <TextLink href={href(`/exam/${a.id}/`)}>
                  <span className="ll-num">{t({ id: 'exam.deck.code', message: `講義 ${a.deckCode ?? ''}` })}</span> <span lang="zh-TW">{a.title}</span>
                </TextLink>
                <span className="ll-exam-weak__count ll-num">{openCount(a.open)}</span>
              </li>
            ))}
          </ul>
          {weakFormulaList.length > 0 && (
            <>
              <h3 className="ll-exam-summary__subtitle">
                {t({ id: 'exam.list.weak.formulas', message: '相關公式', comment: '最需要加強的地方：依公式分組的小標' })}
              </h3>
              <ul className="ll-exam-weak" data-testid="exam-weak-formulas">
                {weakFormulaList.map((a) => (
                  <li key={a.id}>
                    <TextLink href={href(`/formulas/${a.id}/`)}>{a.title}</TextLink>
                    <span className="ll-exam-weak__count ll-num">{openCount(a.open)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}
      <div className="ll-exam-list__head">
        <Segmented<WrongStage>
          value={tab}
          onChange={(v) => setSearch({ tab: v }, { replace: true })}
          label={t({ id: 'exam.list.filter', message: '要看哪一組', comment: '清單頁篩選列的可讀名稱' })}
          options={WRONG_STAGES.map((stage) => ({ value: stage, label: tabLabel(stage) }))}
        />
      </div>
      {decks.length === 0 ? (
        <p className="ll-exam-intro" data-testid="exam-list-none">
          {t({ id: 'exam.list.tab.none', message: '這個階段現在沒有題。', comment: '錯題複習清單頁：選的分頁沒有題' })}
        </p>
      ) : (
        decks.map(({ deck, ids }) => (
          <section key={deck.id} aria-labelledby={`ll-exam-list-${deck.id}`} data-testid={`exam-list-deck-${deck.id}`}>
            <h2 id={`ll-exam-list-${deck.id}`} className="ll-exam-list__deck">
              <span className="ll-num">{t({ id: 'exam.deck.code', message: `講義 ${deck.code}` })}</span> <span lang="zh-TW">{deck.title}</span>
            </h2>
            {ids.map((id) => {
              const q = questions.get(id)!;
              const s = states.get(id)!;
              const hint = hintOf(s);
              return (
                <Disclosure
                  key={id}
                  variant="plain"
                  summary={
                    <span className="ll-exam-list__row">
                      <span lang="zh-TW">{q.topic}</span>
                      {hint !== null && <span className="ll-exam-list__hint ll-num">{hint}</span>}
                    </span>
                  }
                  trailing={
                    <Badge kind={s.lastCorrect ? 'neutral' : 'danger'}>
                      {t({ id: 'exam.list.wrongTimes', message: `答錯 ${n(s.wrong)} 次`, comment: '清單頁每題右邊的標籤：累計答錯幾次；count 已格式化' })}
                    </Badge>
                  }
                >
                  <HandoutQuestionReadout
                    q={q}
                    heading={false}
                    chosen={s.lastChosen ?? null}
                    source={
                      <span className="ll-num">
                        {t({ id: 'exam.q.slide', message: `第 ${n(q.slide)} 頁`, comment: '唯讀題目的來源：講義的頁次（已格式化）' })}
                      </span>
                    }
                  >
                    <FormulaPills questionId={q.id} formulas={formulasOf} />
                  </HandoutQuestionReadout>
                </Disclosure>
              );
            })}
          </section>
        ))
      )}
    </>
  );
}
