// 背題瀏覽（M4c 第二批，2026-11-05；2026-11-06 改成「清單找題、點進去一題一題讀」；02 第 1.1 節）：/exam/browse/。
// 同一條路由兩個畫面，由網址決定：沒有 q 是清單（features/exam/BrowseList.tsx：依講義與段落收合，只列標題），?q=題目 ID 是閱讀頁
// （BrowseReader.tsx：一次一題）。?deck=d1 是範圍（沒給時用上次的範圍），?show=unread|read 是篩選。
// 已讀只在閱讀頁按「讀完了」才記（read-db.ts，以題目 ID 為鍵，全站一份，所以「全部」與各份講義的數字一致）；
// 清單上面的搜尋框用關鍵字找題（?find=，features/exam/search.ts）。
// 在閱讀頁打開一題就記下位置（prefs.ts 的 ll:exam-browse-pos），下次回來清單最上面的卡片可以接著讀。noindex。
import { useLingui } from '@lingui/react/macro';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { localePath } from '@ledgerland/i18n';
import { ErrorState, TopBar } from '@ledgerland/web-ui';
import { BrowseList } from '../features/exam/BrowseList.tsx';
import { BrowseReader } from '../features/exam/BrowseReader.tsx';
import { readExamBrowseHide, readExamBrowsePos, writeExamBrowseHide, writeExamBrowsePos } from '../features/exam/prefs.ts';
import { getExamReadDb, type ReadMark } from '../features/exam/read-db.ts';
import {
  ALL_SCOPE,
  browseParams,
  neighbours,
  orderOf,
  parseShow,
  readCountOf,
  readSetOf,
  scopeOf,
  withoutPositions,
  withScope,
  withVisited,
  type BrowsePos,
  type ShowFilter,
} from '../features/exam/reading.ts';
import { buildSearchIndex, matchingIds, searchTerms } from '../features/exam/search.ts';
import { loadHandoutDeck, loadHandoutIndex, type HandoutManifestEntry, type HandoutQuestionSnapshot } from '../lib/content.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/exam.css';

type Questions = ReadonlyMap<string, HandoutQuestionSnapshot>;
type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; index: HandoutManifestEntry; questions: Questions };

export default function ExamBrowse() {
  const { t } = useLingui();
  const locale = useLocale();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [marks, setMarks] = useState<readonly ReadMark[] | null>(null);

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
    void getExamReadDb()
      .all()
      .then(
        (list) => alive && setMarks(list),
        () => alive && setMarks([]),
      );
    return () => {
      alive = false;
    };
  }, []);
  const ready = state.kind !== 'loading' && marks !== null;
  usePageReady(ready);

  if (state.kind === 'ok' && marks !== null) return <Browse index={state.index} questions={state.questions} initialMarks={marks} />;
  const topBar = (
    <TopBar
      title={t({ id: 'exam.browse.title', message: '背題瀏覽', comment: '背題瀏覽頁的標題' })}
      titleId="ll-exam-browse-title"
      backHref={localePath(locale, '/exam/')}
      backLabel={t({ id: 'exam.run.back', message: '回到期中考苦練' })}
      backShortLabel={t({ id: 'exam.run.back.short', message: '苦練' })}
    />
  );
  if (!ready) return topBar;
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
}

function Browse({ index, questions, initialMarks }: { index: HandoutManifestEntry; questions: Questions; initialMarks: readonly ReadMark[] }) {
  const { t } = useLingui();
  const locale = useLocale();
  const [search, setSearch] = useSearchParams();
  const [marks, setMarks] = useState(initialMarks);
  const [pos, setPosState] = useState(readExamBrowsePos);
  const posRef = useRef(pos);
  const [hide, setHideState] = useState(readExamBrowseHide);
  /** 剛離開閱讀頁的那一題：回到清單時打開它那一段、捲到它那一列 */
  const [leftQuestion, setLeftQuestion] = useState<string | null>(null);

  const savePos = (next: BrowsePos) => {
    if (next === posRef.current) return;
    posRef.current = next;
    setPosState(next);
    writeExamBrowsePos(next);
  };
  const setHide = (on: boolean) => {
    setHideState(on);
    writeExamBrowseHide(on);
  };

  const read = useMemo(() => readSetOf(marks, (id) => questions.get(id)?.answerRev), [marks, questions]);
  const show = parseShow(search.get('show'));
  // 網址沒給範圍時用上次的範圍
  const listScope = scopeOf(index, search.get('deck') ?? pos.scope);
  const current = questions.get(search.get('q') ?? '');
  // 閱讀頁：題目不在網址的範圍裡（例如貼來的連結）就用全部
  const scope = current && !orderOf(index, listScope).includes(current.id) ? ALL_SCOPE : listScope;
  const order = orderOf(index, scope);

  // 關鍵字搜尋（?find=）：清單只列比中的題，閱讀頁的上一題與下一題也只在結果裡走
  const find = search.get('find') ?? '';
  const terms = searchTerms(find);
  const searchIndex = useMemo(() => buildSearchIndex(questions.values()), [questions]);

  const paramsOf = (s: string, f: ShowFilter, q: string | null, keyword: string = find): Record<string, string> =>
    browseParams({ scope: s, show: f, find: keyword, q });
  const hrefOf = (s: string, f: ShowFilter, q: string | null, keyword: string = find): string => {
    const query = new URLSearchParams(paramsOf(s, f, q, keyword)).toString();
    return localePath(locale, '/exam/browse/') + (query ? `?${query}` : '');
  };

  // 這一頁自己管捲動位置（閱讀頁換題回到頁首、回清單捲到剛才那一題）：關掉瀏覽器按返回時的還原，
  // 不然它會在清單捲好之後又把位置改回離開時的樣子（從開始卡進去的話是頁首）。離開這一頁時還原設定。
  useEffect(() => {
    const before = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = before;
    };
  }, []);

  const currentId = current?.id ?? null;
  const currentDeck = current?.deck ?? null;
  useEffect(() => {
    if (currentId === null || currentDeck === null) return;
    setLeftQuestion(currentId);
    savePos(withVisited(posRef.current, scope, currentDeck, currentId));
    // savePos 只碰 ref 與 setState，不必列進相依
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, currentDeck, scope]);

  const db = getExamReadDb();
  const markRead = (q: HandoutQuestionSnapshot) => {
    const mark: ReadMark = { questionId: q.id, answerRev: q.answerRev, at: new Date().toISOString() };
    setMarks((prev) => [...prev.filter((m) => m.questionId !== q.id), mark]);
    void db.put([mark]);
  };
  const markUnread = (id: string) => {
    setMarks((prev) => prev.filter((m) => m.questionId !== id));
    void db.remove([id]);
  };
  /** 把目前範圍全部改回未讀，位置一起清掉；回傳「復原」 */
  const resetScope = (): (() => void) => {
    const ids = new Set(order);
    const removed = marks.filter((m) => ids.has(m.questionId));
    const before = posRef.current;
    setMarks((prev) => prev.filter((m) => !ids.has(m.questionId)));
    void db.remove(order);
    savePos(
      withoutPositions(
        before,
        index.decks.filter((d) => scope === ALL_SCOPE || d.id === scope).map((d) => d.id),
        ids,
      ),
    );
    return () => {
      setMarks((prev) => [...prev.filter((m) => !ids.has(m.questionId)), ...removed]);
      void db.put(removed);
      savePos(before);
    };
  };

  const decks = [...index.decks].sort((a, b) => a.order - b.order);
  if (current) {
    const deck = decks.find((d) => d.id === current.deck);
    const section = deck?.sections.find((s) => s.id === current.section);
    const scopeDeck = scope === ALL_SCOPE ? null : (decks.find((d) => d.id === scope) ?? null);
    const nextDeck = scopeDeck ? (decks[decks.indexOf(scopeDeck) + 1] ?? null) : null;
    // 搜尋中而且這一題在結果裡：上一題、下一題與「第幾題」都照搜尋結果；不在結果裡（例如貼來的連結）就照整個範圍
    const hits = terms.length > 0 ? matchingIds(order, searchIndex, terms) : order;
    const searching = terms.length > 0 && hits.includes(current.id);
    const sequence = searching ? hits : order;
    const { prev, next } = neighbours(sequence, current.id, read, show);
    return (
      <>
        <TopBar
          title={t({ id: 'exam.browse.title', message: '背題瀏覽', comment: '背題瀏覽頁的標題' })}
          titleId="ll-exam-browse-title"
          backHref={hrefOf(scope, show, null)}
          backLabel={t({ id: 'exam.browse.back', message: '回到題目清單', comment: '背題瀏覽的閱讀頁：返回鈕' })}
          backShortLabel={t({ id: 'exam.browse.back.short', message: '清單', comment: '背題瀏覽的閱讀頁：返回鈕的短版' })}
        />
        <BrowseReader
          key={current.id}
          q={current}
          deckCode={deck?.code ?? ''}
          sectionTitle={section?.title ?? ''}
          position={sequence.indexOf(current.id) + 1}
          positionTotal={sequence.length}
          searching={searching}
          total={order.length}
          readCount={readCountOf(order, read)}
          isRead={read.has(current.id)}
          hide={hide}
          onHide={setHide}
          hasPrev={prev !== null}
          hasNext={next !== null}
          onPrev={() => prev !== null && setSearch(paramsOf(scope, show, prev), { replace: true })}
          onNext={() => next !== null && setSearch(paramsOf(scope, show, next), { replace: true })}
          onRead={() => markRead(current)}
          onUnread={() => markUnread(current.id)}
          listHref={hrefOf(scope, show, null)}
          scopeDeckCode={scopeDeck?.code ?? null}
          nextDeck={nextDeck ? { code: nextDeck.code, href: hrefOf(nextDeck.id, 'all', null, '') } : null}
          practiseHref={localePath(locale, `/exam/${scopeDeck ? scopeDeck.id : 'all'}/`)}
        />
      </>
    );
  }

  return (
    <>
      <TopBar
        title={t({ id: 'exam.browse.title', message: '背題瀏覽', comment: '背題瀏覽頁的標題' })}
        titleId="ll-exam-browse-title"
        backHref={localePath(locale, '/exam/')}
        backLabel={t({ id: 'exam.run.back', message: '回到期中考苦練' })}
        backShortLabel={t({ id: 'exam.run.back.short', message: '苦練' })}
      />
      <BrowseList
        index={index}
        questions={questions}
        scope={scope}
        show={show}
        read={read}
        pos={pos}
        hide={hide}
        onHide={setHide}
        hrefOf={hrefOf}
        onScope={(s) => {
          savePos(withScope(posRef.current, s));
          setSearch(paramsOf(s, show, null), { replace: true });
        }}
        onShow={(f) => setSearch(paramsOf(scope, f, null), { replace: true })}
        find={find}
        terms={terms}
        searchIndex={searchIndex}
        onFind={(v) => setSearch(paramsOf(scope, show, null, v), { replace: true })}
        onReset={resetScope}
        focusId={leftQuestion}
        onFocusUsed={() => setLeftQuestion(null)}
      />
    </>
  );
}
