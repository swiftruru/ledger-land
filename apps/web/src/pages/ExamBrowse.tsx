// 背題瀏覽（M4c 第二批，2026-11-05；02 第 1.1 節）：/exam/browse/，?deck=d1 只看一份講義。期中考照講義原題出，這一頁依講義與段落列出
// 全部收錄的題目、正解與解析（HandoutQuestionReadout），可以列印（exam.css 的 @media print）。答案與解析預設直接顯示，
// 工具列的開關可以整頁遮住（維護者 2026-11-05 的決定；存 localStorage），遮住時每題有「看答案」只掀開那一題。純瀏覽，不寫紀錄。noindex。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatNumber, localePath } from '@ledgerland/i18n';
import { Button, ErrorState, FileIcon, Segmented, Switch, TopBar } from '@ledgerland/web-ui';
import { HandoutQuestionReadout } from '../features/exam/HandoutQuestionReadout.tsx';
import { readExamBrowseHide, writeExamBrowseHide } from '../features/exam/prefs.ts';
import { loadHandoutDeck, loadHandoutIndex, type HandoutManifestEntry, type HandoutQuestionSnapshot } from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/exam.css';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; index: HandoutManifestEntry; questions: ReadonlyMap<string, HandoutQuestionSnapshot> };

export default function ExamBrowse() {
  const { t } = useLingui();
  const locale = useLocale();
  const [search, setSearch] = useSearchParams();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [hide, setHide] = useState(readExamBrowseHide);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let alive = true;
    (async (): Promise<State> => {
      const index = await loadHandoutIndex();
      if (!index) return { kind: 'error' };
      const files = await Promise.all(index.decks.map((d) => loadHandoutDeck(d.id)));
      return { kind: 'ok', index, questions: new Map(files.flatMap((f) => f.questions).map((q) => [q.id, q] as const)) };
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
      title={t({ id: 'exam.browse.title', message: '背題瀏覽', comment: '背題瀏覽頁的標題' })}
      titleId="ll-exam-browse-title"
      backHref={localePath(locale, '/exam/')}
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

  const { index, questions } = state;
  const n = (x: number) => formatNumber(x, locale);
  const decks = [...index.decks].sort((a, b) => a.order - b.order);
  const wanted = search.get('deck');
  const deckId = decks.some((d) => d.id === wanted) ? wanted! : 'all';
  const shown = decks.filter((d) => deckId === 'all' || d.id === deckId);
  const toggle = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <>
      {topBar}
      <p className="ll-exam-intro">
        <Trans id="exam.browse.intro" comment="背題瀏覽頁開頭的說明">
          依講義與段落列出收錄的全部題目，題目、選項、解答與解析都照講義。想自己先想一遍，可以把答案遮起來。
        </Trans>
      </p>
      <p className="ll-exam-print-only">
        <Trans id="exam.licence">題目經陳彥宏老師授權使用。</Trans>
      </p>
      <div className="ll-exam-browse__tools" data-testid="exam-browse-tools">
        <Segmented<string>
          size="sm"
          value={deckId}
          onChange={(v) => setSearch(v === 'all' ? {} : { deck: v }, { replace: true })}
          label={t({ id: 'exam.browse.deck', message: '要看哪一份講義', comment: '背題瀏覽頁工具列：講義篩選的可讀名稱' })}
          options={[
            {
              value: 'all',
              label: t({ id: 'exam.browse.deck.all', message: `全部 ${n(index.questionCount)}`, comment: '背題瀏覽頁的講義篩選：全部；count 已格式化' }),
            },
            ...decks.map((d) => ({
              value: d.id,
              label: <span className="ll-num">{d.code}</span>,
              ariaLabel: t({ id: 'exam.deck.code', message: `講義 ${d.code}` }),
            })),
          ]}
        />
        <Switch
          checked={hide}
          onChange={(on) => {
            setHide(on);
            setRevealed(new Set());
            writeExamBrowseHide(on);
          }}
          label={t({ id: 'exam.browse.hide', message: '遮住答案與解析', comment: '背題瀏覽頁工具列的開關' })}
        />
        <Button size="sm" icon={<FileIcon />} onClick={() => window.print()} data-testid="exam-browse-print">
          {t({ id: 'exam.browse.print', message: '列印', comment: '背題瀏覽頁工具列的按鈕：列印目前顯示的題目' })}
        </Button>
      </div>
      {shown.map((d) => (
        <section key={d.id} aria-labelledby={`ll-exam-browse-${d.id}`} data-testid={`exam-browse-deck-${d.id}`}>
          <h2 id={`ll-exam-browse-${d.id}`} className="ll-exam-browse__deck">
            <span className="ll-num">{t({ id: 'exam.deck.code', message: `講義 ${d.code}` })}</span> <span lang="zh-TW">{d.title}</span>
          </h2>
          {d.sections.map((s) => (
            <div key={s.id}>
              <h3 className="ll-exam-browse__section">
                <span lang="zh-TW">{s.title}</span>
                {'　'}
                <span className="ll-num">{t({ id: 'exam.section.untouched', message: `${n(s.questionIds.length)} 題` })}</span>
              </h3>
              {s.questionIds.map((id) => {
                const q = questions.get(id);
                if (!q) return null;
                const hidden = hide && !revealed.has(id);
                return (
                  <article key={id} className="ll-exam-browse__item" data-testid="exam-browse-item">
                    <HandoutQuestionReadout
                      q={q}
                      heading="h4"
                      hideAnswer={hidden}
                      source={<span className="ll-num">{t({ id: 'exam.q.slide', message: `第 ${n(q.slide)} 頁` })}</span>}
                    >
                      {hide && (
                        <div className="ll-exam-browse__reveal">
                          <Button size="sm" variant="quiet" onClick={() => toggle(id)} aria-expanded={!hidden}>
                            {hidden
                              ? t({ id: 'exam.browse.reveal', message: '看答案', comment: '背題瀏覽頁：答案遮住時，只掀開這一題' })
                              : t({ id: 'exam.browse.cover', message: '遮回去', comment: '背題瀏覽頁：把這一題的答案再遮起來' })}
                          </Button>
                        </div>
                      )}
                    </HandoutQuestionReadout>
                  </article>
                );
              })}
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
