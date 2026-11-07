// 錯題與不熟的清單（M4c 第二批，2026-11-05；02 第 1.1 節）：/exam/list/，?filter=unsure 看「還不熟的」（預設「答錯的」）。
// 「答錯的」是最近一次答錯的題，「還不熟的」是練過但還沒連續答對兩次的題（features/exam/stats.ts）；依講義分組，每題一個展開列，
// 展開是唯讀的題目（HandoutQuestionReadout）並標出最近一次選的選項。只載清單裡有題的講義檔；純瀏覽，不寫紀錄。noindex。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatNumber, localePath } from '@ledgerland/i18n';
import { Badge, Button, Disclosure, EmptyState, ErrorState, PlayIcon, Segmented, TopBar } from '@ledgerland/web-ui';
import { getExamDb, type QuestionState } from '../features/exam/db.ts';
import { HandoutQuestionReadout } from '../features/exam/HandoutQuestionReadout.tsx';
import { allQuestionIds } from '../features/exam/sets.ts';
import { picksOf } from '../features/exam/stats.ts';
import { FormulaPills, useFormulasOfQuestions } from '../features/formulas/FormulaPills.tsx';
import { loadHandoutDeck, loadHandoutIndex, type HandoutManifestEntry, type HandoutQuestionSnapshot } from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/exam.css';

type Filter = 'wrong' | 'unsure';
type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | {
      kind: 'ok';
      index: HandoutManifestEntry;
      states: ReadonlyMap<string, QuestionState>;
      questions: ReadonlyMap<string, HandoutQuestionSnapshot>;
      wrongIds: ReadonlySet<string>;
      unsureIds: ReadonlySet<string>;
    };

export default function ExamList() {
  const { t } = useLingui();
  const formulasOf = useFormulasOfQuestions();
  const locale = useLocale();
  const href = (p: string) => localePath(locale, p);
  const [search, setSearch] = useSearchParams();
  const filter: Filter = search.get('filter') === 'unsure' ? 'unsure' : 'wrong';
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
      const { wrongIds, unsureIds } = picksOf(states);
      // 答錯的一定也還不熟（答錯時連對歸零），所以只看不熟的那一組要哪幾份講義
      const decks = index.decks.filter((d) => d.sections.some((s) => s.questionIds.some((id) => unsureIds.has(id))));
      const files = await Promise.all(decks.map((d) => loadHandoutDeck(d.id)));
      const questions = new Map(files.flatMap((f) => f.questions).map((q) => [q.id, q] as const));
      return { kind: 'ok', index, states, questions, wrongIds, unsureIds };
    })().then(
      (s) => alive && setState(s),
      () => alive && setState({ kind: 'error' }),
    );
    return () => {
      alive = false;
    };
  }, []);
  usePageReady(state.kind !== 'loading');

  const topBar = (
    <TopBar
      title={t({ id: 'exam.list.title', message: '錯過與還不熟的題', comment: '錯題與不熟的清單頁的標題' })}
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

  const { index, states, questions, wrongIds, unsureIds } = state;
  const n = (x: number) => formatNumber(x, locale);
  const order = allQuestionIds(index);
  const count = { wrong: order.filter((id) => wrongIds.has(id)).length, unsure: order.filter((id) => unsureIds.has(id)).length };
  const picked = filter === 'wrong' ? wrongIds : unsureIds;
  const decks = [...index.decks]
    .sort((a, b) => a.order - b.order)
    .map((d) => ({ deck: d, ids: d.sections.flatMap((s) => s.questionIds).filter((id) => picked.has(id) && questions.has(id)) }))
    .filter((g) => g.ids.length > 0);
  return (
    <>
      {topBar}
      <p className="ll-exam-intro">
        <Trans id="exam.list.intro" comment="錯題與不熟的清單頁開頭的說明">
          「答錯的」是最近一次答錯的題；「還不熟的」是練過但還沒連續答對兩次的題。只看這台裝置的紀錄。
        </Trans>
      </p>
      <div className="ll-exam-list__head">
        <Segmented<Filter>
          value={filter}
          onChange={(v) => setSearch(v === 'wrong' ? {} : { filter: v }, { replace: true })}
          label={t({ id: 'exam.list.filter', message: '要看哪一組', comment: '清單頁篩選列的可讀名稱' })}
          options={[
            {
              value: 'wrong',
              label: t({ id: 'exam.list.filter.wrong', message: `答錯的 ${n(count.wrong)}`, comment: '清單頁篩選：最近答錯的題；count 已格式化' }),
            },
            {
              value: 'unsure',
              label: t({ id: 'exam.list.filter.unsure', message: `還不熟的 ${n(count.unsure)}`, comment: '清單頁篩選：練過但還沒熟練的題；count 已格式化' }),
            },
          ]}
        />
        {count[filter] > 0 && (
          <Button variant="primary" size="md" icon={<PlayIcon />} href={href(`/exam/${filter}/`)} data-testid="exam-list-practise">
            {t({ id: 'exam.list.practise', message: `練這些（${n(count[filter])} 題）`, comment: '清單頁的按鈕：把目前這一組拿去練；count 已格式化' })}
          </Button>
        )}
      </div>
      {decks.length === 0 ? (
        <EmptyState
          title={
            filter === 'wrong' ? t({ id: 'exam.run.emptyWrong', message: '還沒有錯過的題' }) : t({ id: 'exam.run.emptyUnsure', message: '還沒有不熟的題' })
          }
          description={
            filter === 'wrong'
              ? t({ id: 'exam.run.emptyWrong.desc', message: '先練幾題，答錯的題會集中到這裡。' })
              : t({ id: 'exam.run.emptyUnsure.desc', message: '練過的題連續答對兩次就算熟練；還沒熟練的會集中到這裡。' })
          }
          action={
            <Button variant="primary" icon={<PlayIcon />} href={href('/exam/all/')}>
              {t({ id: 'exam.start.order', message: '依講義順序練' })}
            </Button>
          }
        />
      ) : (
        decks.map(({ deck, ids }) => (
          <section key={deck.id} aria-labelledby={`ll-exam-list-${deck.id}`} data-testid={`exam-list-deck-${deck.id}`}>
            <h2 id={`ll-exam-list-${deck.id}`} className="ll-exam-list__deck">
              <span className="ll-num">{t({ id: 'exam.deck.code', message: `講義 ${deck.code}` })}</span> <span lang="zh-TW">{deck.title}</span>
            </h2>
            {ids.map((id) => {
              const q = questions.get(id)!;
              const s = states.get(id);
              return (
                <Disclosure
                  key={id}
                  variant="plain"
                  summary={<span lang="zh-TW">{q.topic}</span>}
                  trailing={
                    s && s.wrong > 0 ? (
                      <Badge kind={s.lastCorrect ? 'neutral' : 'danger'}>
                        {t({ id: 'exam.list.wrongTimes', message: `答錯 ${n(s.wrong)} 次`, comment: '清單頁每題右邊的標籤：累計答錯幾次；count 已格式化' })}
                      </Badge>
                    ) : undefined
                  }
                >
                  <HandoutQuestionReadout
                    q={q}
                    heading={false}
                    chosen={s?.lastChosen ?? null}
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
