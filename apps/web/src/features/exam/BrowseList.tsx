// 背題瀏覽的清單（2026-11-06）：範圍、開始卡（從第一題開始讀、接著讀、都讀完了）、篩選、依講義與段落收合的題目標題，
// 最下面的「更多」放遮住答案、列印與把這個範圍改回未讀。點一題進閱讀頁（BrowseReader.tsx）。
// 一進來只打開一段（接著讀的那一題所在的段；從閱讀頁回來時是剛才那一題的段），其餘收著，收著的段不畫題目列。
// 搜尋框（2026-11-06）：用關鍵字找題（search.ts），搜尋中不顯示開始卡、比中的段落全部打開，題目列多一行比中的地方的摘錄。
// 列印：按「列印」或瀏覽器自己的列印時，才把這個範圍的完整題目畫出來（.ll-exam-browse__print，只在列印時顯示）。
import { useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { formatNumber, localePath } from '@ledgerland/i18n';
import {
  Badge,
  Button,
  Card,
  CheckCircleIcon,
  CircleIcon,
  ConfirmSheet,
  Disclosure,
  FileIcon,
  MoreIcon,
  NavList,
  NavRow,
  PlayIcon,
  ProgressBar,
  RetryIcon,
  SearchField,
  Segmented,
  Switch,
  Toast,
  ToastRegion,
  XIcon,
} from '@ledgerland/web-ui';
import type { HandoutManifestEntry, HandoutQuestionSnapshot } from '../../lib/content.ts';
import { useLocale } from '../../lib/useLocale.ts';
import { HandoutQuestionReadout } from './HandoutQuestionReadout.tsx';
import { excerptOf, highlightOf, matchesTerms, type SearchIndex } from './search.ts';
import { ALL_SCOPE, lastIn, orderOf, readCountOf, resumeTarget, visibleIds, type BrowsePos, type ShowFilter } from './reading.ts';

export interface BrowseListProps {
  index: HandoutManifestEntry;
  questions: ReadonlyMap<string, HandoutQuestionSnapshot>;
  scope: string;
  show: ShowFilter;
  read: ReadonlySet<string>;
  pos: BrowsePos;
  hide: boolean;
  onHide: (on: boolean) => void;
  hrefOf: (scope: string, show: ShowFilter, q: string | null) => string;
  onScope: (scope: string) => void;
  onShow: (show: ShowFilter) => void;
  /** 搜尋框裡的字、拆好的詞（空的代表不搜尋）與比對用的索引 */
  find: string;
  terms: readonly string[];
  searchIndex: SearchIndex;
  onFind: (keyword: string) => void;
  /** 只看某條公式的相關題（?formula=）：題目 ID 的集合與公式名稱；清除就拿掉參數 */
  only: ReadonlySet<string> | null;
  onlyLabel: string | null;
  onClearOnly: () => void;
  /** 把目前範圍改回未讀；回傳復原 */
  onReset: () => () => void;
  /** 剛從閱讀頁回來時的那一題 */
  focusId: string | null;
  onFocusUsed: () => void;
}

const UNDO_MS = 6000;

export function BrowseList({
  index,
  questions,
  scope,
  show,
  read,
  pos,
  hide,
  onHide,
  hrefOf,
  onScope,
  onShow,
  find,
  terms,
  searchIndex,
  onFind,
  only,
  onlyLabel,
  onClearOnly,
  onReset,
  focusId,
  onFocusUsed,
}: BrowseListProps) {
  const { t } = useLingui();
  const locale = useLocale();
  const n = (x: number) => formatNumber(x, locale);
  const decks = [...index.decks].sort((a, b) => a.order - b.order);
  const shown = decks.filter((d) => scope === ALL_SCOPE || d.id === scope);
  const scopeDeck = scope === ALL_SCOPE ? null : (shown[0] ?? null);
  const order = orderOf(index, scope);
  const readCount = readCountOf(order, read);
  const lastId = lastIn(pos, scope);
  const target = resumeTarget(order, lastId, read);
  const targetQuestion = target ? questions.get(target.id) : undefined;
  const targetDeck = decks.find((d) => d.id === targetQuestion?.deck);
  const targetSection = targetDeck?.sections.find((s) => s.id === targetQuestion?.section);

  // 打開的段：換範圍時重新決定（不用 key 重掛整個清單，範圍的切換鈕才不會失去焦點）
  const initialOpen = (): ReadonlySet<string> => {
    const section = questions.get(focusId ?? target?.id ?? '')?.section;
    return new Set(section ? [section] : []);
  };
  const [opened, setOpened] = useState<{ scope: string; ids: ReadonlySet<string> }>(() => ({ scope, ids: initialOpen() }));
  if (opened.scope !== scope) setOpened({ scope, ids: initialOpen() });
  const open = opened.scope === scope ? opened.ids : new Set<string>();
  const toggle = (sectionId: string, on: boolean) =>
    setOpened((prev) => {
      const ids = new Set(prev.ids);
      if (on) ids.add(sectionId);
      else ids.delete(sectionId);
      return { scope: prev.scope, ids };
    });

  // 從閱讀頁回來：捲到剛才那一題，焦點放回那一列
  useEffect(() => {
    if (focusId === null) return;
    onFocusUsed();
    const row = document.getElementById(`ll-exam-browse-row-${focusId}`);
    if (!row) return;
    row.scrollIntoView({ block: 'center' });
    (row.matches('a, button') ? row : row.querySelector<HTMLElement>('a, button'))?.focus({ preventScroll: true });
    // 只在掛上來的那一次做
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 列印：要印的時候才畫完整的題目
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  const print = () => {
    flushSync(() => setPrinting(true));
    window.print();
  };

  // 重設：先確認，做完後幾秒內可以復原
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<{ n: number; count: number; undo: () => void } | null>(null);
  const noteSeq = useRef(0);
  const noteHeld = useRef(false);
  useEffect(() => {
    if (!note) return;
    const timer = window.setInterval(() => {
      if (!noteHeld.current) setNote((cur) => (cur?.n === note.n ? null : cur));
    }, UNDO_MS);
    return () => window.clearInterval(timer);
  }, [note]);
  const reset = () => {
    const count = readCount;
    const undo = onReset();
    setConfirming(false);
    setNote({ n: ++noteSeq.current, count, undo });
  };

  // 和苦練首頁同一則訊息（佔位符要一樣，所以傳整個物件進來）
  const deckCode = (d: { code: string }) => t({ id: 'exam.deck.code', message: `講義 ${d.code}` });
  const countText = (done: number, total: number) => {
    const a = n(done);
    const b = n(total);
    return t({ id: 'exam.browse.count', message: `已讀 ${a}／${b} 題`, comment: '背題瀏覽：某個範圍讀完幾題；數字已格式化' });
  };
  // 段落標題右邊的短版（手機上標題才不會被擠到換行）
  const shortCount = (done: number, total: number) => {
    const a = n(done);
    const b = n(total);
    return t({ id: 'exam.browse.count.short', message: `已讀 ${a}／${b}`, comment: '背題瀏覽：段落標題右邊的已讀數（短版）；數字已格式化' });
  };
  const scopeCode = scopeDeck?.code ?? '';
  const resetLabel = scopeDeck
    ? t({ id: 'exam.browse.reset.deck', message: `把講義 ${scopeCode} 改回未讀`, comment: '背題瀏覽：重設一份講義的已讀；scopeCode 是講義編號' })
    : t({ id: 'exam.browse.reset.all', message: '全部改回未讀', comment: '背題瀏覽：重設全部題目的已讀' });
  const readCountText = n(readCount);
  const noteCount = n(note?.count ?? 0);
  // 搜尋：清單只列比中的題（再套已讀與未讀的篩選）；只看某條公式的相關題時再交集
  const searching = terms.length > 0;
  const inOnly = (id: string) => only === null || only.has(id);
  const listed = (ids: readonly string[]) => visibleIds(ids, read, show).filter((id) => inOnly(id) && matchesTerms(searchIndex, id, terms));
  const scopeHits = searching ? order.filter((id) => inOnly(id) && matchesTerms(searchIndex, id, terms)).length : order.length;
  const onlyCount = only === null ? 0 : order.filter((id) => only.has(id)).length;
  const onlyCountText = n(onlyCount);
  const onlyName = onlyLabel ?? '';
  // 開始卡在搜尋中或只看相關題時不顯示（接著讀的位置和篩過的清單對不上）
  const filtering = searching || only !== null;
  const listedCount = listed(order).length;
  const anyVisible = listedCount > 0;
  const hitsText = n(listedCount);
  const keyword = find.trim();
  /** 把比中的字標出來 */
  const marked = (text: string) => {
    const h = searching ? highlightOf(text, terms) : null;
    return h ? (
      <>
        {h.before}
        <mark className="ll-exam-browse__hit">{h.hit}</mark>
        {h.after}
      </>
    ) : (
      text
    );
  };

  return (
    <>
      <div className="ll-exam-browse__screen">
        <p className="ll-exam-intro">
          {t({
            id: 'exam.browse.intro',
            message: '依講義與段落列出收錄的全部題目。點題目進去一次讀一題，題目、選項、解答與解析都照講義。',
            comment: '背題瀏覽頁開頭的說明',
          })}
        </p>
        <div className="ll-exam-browse__tools" data-testid="exam-browse-tools">
          <Segmented<string>
            size="sm"
            value={scope}
            onChange={onScope}
            label={t({ id: 'exam.browse.deck', message: '要看哪一份講義', comment: '背題瀏覽頁工具列：講義篩選的可讀名稱' })}
            options={[
              {
                value: ALL_SCOPE,
                label: t({ id: 'exam.browse.deck.all', message: `全部 ${n(index.questionCount)}`, comment: '背題瀏覽頁的講義篩選：全部；count 已格式化' }),
              },
              ...decks.map((d) => ({ value: d.id, label: <span className="ll-num">{d.code}</span>, ariaLabel: deckCode(d) })),
            ]}
          />
        </div>
        <SearchField
          className="ll-exam-browse__search"
          label={t({ id: 'exam.browse.find.label', message: '搜尋題目', comment: '背題瀏覽：關鍵字搜尋欄的標籤' })}
          placeholder={t({ id: 'exam.browse.find.placeholder', message: '例如：毛利率、存貨', comment: '背題瀏覽：搜尋欄的提示文字（只是例子）' })}
          value={find}
          onChange={onFind}
          describedBy={searching ? 'll-exam-browse-found' : undefined}
          data-testid="exam-browse-search"
        />
        {only !== null && (
          <div className="ll-exam-browse__only" data-testid="exam-browse-only">
            <span className="ll-exam-browse__only-text">
              {t({
                id: 'exam.browse.only',
                message: `只看：${onlyName} 的相關題（${onlyCountText} 題）`,
                comment: '背題瀏覽：只看某條公式的相關題時的膠囊；onlyName 是公式名稱、onlyCountText 是已格式化的題數',
              })}
            </span>
            <Button size="sm" variant="quiet" icon={<XIcon />} onClick={onClearOnly} data-testid="exam-browse-only-clear">
              {t({ id: 'exam.browse.only.clear', message: '看全部', comment: '背題瀏覽：清掉「只看某條公式的相關題」的按鈕' })}
            </Button>
          </div>
        )}
        {/* 結果數：看得到，輸入時也禮貌地唸出來 */}
        <p id="ll-exam-browse-found" className="ll-exam-browse__found" aria-live="polite" data-testid="exam-browse-found">
          {searching && scopeHits > 0
            ? t({ id: 'exam.browse.find.count', message: `找到 ${hitsText} 題`, comment: '背題瀏覽：搜尋結果的題數；hitsText 已格式化' })
            : ''}
        </p>

        {target && !filtering && (
          <Card as="section" className="ll-exam-hero" aria-labelledby="ll-exam-browse-start" data-testid="exam-browse-start" data-kind={target.kind}>
            <h2 id="ll-exam-browse-start" className="ll-exam-hero__title">
              {target.kind === 'start'
                ? t({ id: 'exam.browse.start.title', message: '開始背題', comment: '背題瀏覽的開始卡：還沒讀過' })
                : target.kind === 'resume'
                  ? t({ id: 'exam.browse.resume.title', message: '接著讀', comment: '背題瀏覽的開始卡：讀過一些' })
                  : scopeDeck
                    ? t({ id: 'exam.browse.done.deck', message: `講義 ${scopeCode} 都讀完了`, comment: '背題瀏覽：一份講義全部已讀' })
                    : t({ id: 'exam.browse.done.all', message: '全部都讀完了', comment: '背題瀏覽：全部題目已讀' })}
            </h2>
            {target.kind === 'start' && (
              <p className="ll-exam-hero__note">
                {t({
                  id: 'exam.browse.start.body',
                  message: '點題目進去，一次讀一題。讀完按「讀完了」，下次回來從這裡接著讀。',
                  comment: '背題瀏覽的開始卡：一句玩法說明',
                })}
              </p>
            )}
            {target.kind === 'resume' && targetQuestion && (
              <p className="ll-exam-hero__note" data-testid="exam-browse-resume-where">
                <span className="ll-num">{targetDeck ? deckCode(targetDeck) : null}</span>
                {'　'}
                <span lang="zh-TW">{targetSection?.title}</span>
                {'　'}
                <strong lang="zh-TW">{targetQuestion.topic}</strong>
              </p>
            )}
            <div className="ll-exam-hero__progress">
              <ProgressBar size="md" value={readCount} max={order.length || 1} />
              <span className="ll-exam-hero__count ll-num" data-testid="exam-browse-count">
                {countText(readCount, order.length)}
              </span>
            </div>
            <div className="ll-exam-hero__actions">
              {target.kind === 'done' ? (
                <>
                  <Button variant="primary" size="md" icon={<PlayIcon />} href={localePath(locale, `/exam/${scopeDeck ? scopeDeck.id : 'all'}/`)}>
                    {t({ id: 'exam.browse.done.practise', message: '去練習', comment: '背題瀏覽：都讀完之後，去作答練習' })}
                  </Button>
                  <Button size="md" icon={<RetryIcon />} href={hrefOf(scope, 'all', order[0] ?? null)} data-testid="exam-browse-go">
                    {t({ id: 'exam.browse.done.again', message: '從頭再讀', comment: '背題瀏覽：都讀完之後，從第一題再讀一次（不會清掉已讀）' })}
                  </Button>
                </>
              ) : (
                <Button variant="primary" size="md" icon={<PlayIcon />} href={hrefOf(scope, 'all', target.id)} data-testid="exam-browse-go">
                  {target.kind === 'start'
                    ? t({ id: 'exam.browse.start.go', message: '從第一題開始讀', comment: '背題瀏覽的開始卡按鈕' })
                    : t({ id: 'exam.browse.resume.go', message: '接著讀', comment: '背題瀏覽的開始卡按鈕：回到上次的進度' })}
                </Button>
              )}
            </div>
          </Card>
        )}

        <div className="ll-exam-browse__tools">
          <Segmented<ShowFilter>
            size="sm"
            value={show}
            onChange={onShow}
            label={t({ id: 'exam.browse.show', message: '要列出哪些題', comment: '背題瀏覽：已讀與未讀篩選的可讀名稱' })}
            options={[
              { value: 'all', label: t({ id: 'exam.browse.show.all', message: '全部', comment: '背題瀏覽的篩選：不分已讀未讀' }) },
              { value: 'unread', label: t({ id: 'exam.browse.show.unread', message: '未讀', comment: '背題瀏覽的篩選' }) },
              { value: 'read', label: t({ id: 'exam.browse.show.read', message: '已讀', comment: '背題瀏覽的篩選' }) },
            ]}
          />
        </div>

        {!anyVisible && (
          <p className="ll-exam-intro" data-testid="exam-browse-empty">
            {searching && scopeHits === 0
              ? t({
                  id: 'exam.browse.find.empty',
                  message: `找不到含有「${keyword}」的題目。換一個詞，或清掉搜尋看全部。`,
                  comment: '背題瀏覽：搜尋沒有結果；keyword 是使用者輸入的字',
                })
              : only !== null && onlyCount === 0
                ? t({
                    id: 'exam.browse.only.empty',
                    message: '這個範圍沒有這條公式的相關題。換一份講義，或看全部。',
                    comment: '背題瀏覽：只看某條公式的相關題，但目前範圍裡一題都沒有',
                  })
                : show === 'unread'
                  ? t({ id: 'exam.browse.empty.unread', message: '這個範圍的題都讀過了。', comment: '背題瀏覽：篩選未讀但沒有未讀的題' })
                  : t({ id: 'exam.browse.empty.read', message: '這個範圍還沒有讀過的題。', comment: '背題瀏覽：篩選已讀但還沒有已讀的題' })}
          </p>
        )}

        {shown.map((d) => {
          const deckIds = d.sections.flatMap((s) => s.questionIds);
          if (listed(deckIds).length === 0) return null;
          return (
            <section key={d.id} aria-labelledby={`ll-exam-browse-${d.id}`} data-testid={`exam-browse-deck-${d.id}`}>
              <h2 id={`ll-exam-browse-${d.id}`} className="ll-exam-browse__deck">
                <span className="ll-num">{deckCode(d)}</span> <span lang="zh-TW">{d.title}</span>
              </h2>
              {scope === ALL_SCOPE && (
                <div className="ll-exam-deck__progress">
                  <ProgressBar size="sm" value={readCountOf(deckIds, read)} max={deckIds.length || 1} />
                  <span className="ll-exam-deck__count ll-num" data-testid={`exam-browse-deck-count-${d.id}`}>
                    {countText(readCountOf(deckIds, read), deckIds.length)}
                  </span>
                </div>
              )}
              {d.sections.map((s) => {
                const ids = listed(s.questionIds);
                if (ids.length === 0) return null;
                const done = readCountOf(s.questionIds, read);
                // 搜尋中比中的段落都打開
                // 搜尋中或只看某條公式的相關題時，有題的段落全部打開
                const isOpen = filtering || open.has(s.id);
                return (
                  <Disclosure
                    key={s.id}
                    className="ll-exam-browse__sec"
                    data-testid={`exam-browse-section-${s.id}`}
                    summary={<span lang="zh-TW">{s.title}</span>}
                    trailing={
                      <Badge kind={done === s.questionIds.length ? 'success' : 'neutral'}>
                        <span className="ll-num">{shortCount(done, s.questionIds.length)}</span>
                      </Badge>
                    }
                    open={isOpen}
                    onToggle={(on) => toggle(s.id, on)}
                  >
                    {isOpen && (
                      <NavList inset={false} aria-label={s.title}>
                        {ids.map((id) => {
                          const q = questions.get(id);
                          if (!q) return null;
                          const isRead = read.has(id);
                          const excerpt = searching ? excerptOf(q, terms) : null;
                          return (
                            <NavRow
                              key={id}
                              id={`ll-exam-browse-row-${id}`}
                              size={searching ? 'md' : 'compact'}
                              description={
                                excerpt ? (
                                  <span lang="zh-TW">
                                    {excerpt.before}
                                    <mark className="ll-exam-browse__hit">{excerpt.hit}</mark>
                                    {excerpt.after}
                                  </span>
                                ) : undefined
                              }
                              className={isRead ? 'll-exam-browse__row is-read' : 'll-exam-browse__row'}
                              href={hrefOf(scope, show, id)}
                              icon={isRead ? <CheckCircleIcon filled /> : <CircleIcon />}
                              title={
                                <>
                                  <span lang="zh-TW">{marked(q.topic)}</span>
                                  <span className="ll-sr-only">
                                    {isRead
                                      ? t({ id: 'exam.browse.row.read', message: '（已讀）', comment: '背題瀏覽的題目列：螢幕閱讀器唸的狀態' })
                                      : t({ id: 'exam.browse.row.unread', message: '（未讀）', comment: '背題瀏覽的題目列：螢幕閱讀器唸的狀態' })}
                                  </span>
                                </>
                              }
                              trailing={
                                id === lastId ? (
                                  <Badge kind="accent">
                                    {t({ id: 'exam.browse.row.last', message: '上次讀到', comment: '背題瀏覽的題目列：上次停在這一題' })}
                                  </Badge>
                                ) : undefined
                              }
                              data-testid="exam-browse-row"
                            />
                          );
                        })}
                      </NavList>
                    )}
                  </Disclosure>
                );
              })}
            </section>
          );
        })}

        <Disclosure
          className="ll-exam-browse__more"
          icon={<MoreIcon />}
          summary={t({ id: 'exam.browse.more', message: '更多', comment: '背題瀏覽清單最下面的展開列：遮住答案、列印、改回未讀' })}
          data-testid="exam-browse-more"
        >
          <Switch
            checked={hide}
            onChange={onHide}
            label={t({ id: 'exam.browse.hide', message: '遮住答案與解析', comment: '背題瀏覽頁工具列的開關' })}
            description={t({
              id: 'exam.browse.hide.desc',
              message: '讀題時先不顯示答案，按「看答案」才掀開；列印時也不印答案。',
              comment: '背題瀏覽：遮住答案開關的說明',
            })}
          />
          <div className="ll-exam-hero__actions">
            <Button size="sm" icon={<FileIcon />} onClick={print} data-testid="exam-browse-print">
              {t({ id: 'exam.browse.print', message: '列印', comment: '背題瀏覽頁工具列的按鈕：列印目前顯示的題目' })}
            </Button>
            {readCount > 0 && (
              <Button size="sm" icon={<RetryIcon />} onClick={() => setConfirming(true)} data-testid="exam-browse-reset">
                {resetLabel}
              </Button>
            )}
          </div>
          <p className="ll-exam-hero__note">
            {t({
              id: 'exam.browse.more.note',
              message: '已讀的紀錄只存在這台裝置，還不會跟著備份；清除網站資料或換裝置後要重新讀過。作答的紀錄不受影響。',
              comment: '背題瀏覽：已讀紀錄的保存範圍',
            })}
          </p>
        </Disclosure>
      </div>

      <p className="ll-exam-print-only">{t({ id: 'exam.licence', message: '題目經陳彥宏老師授權使用。' })}</p>
      {printing && (
        <div className="ll-exam-browse__print" data-testid="exam-browse-print-sheet">
          {shown.map((d) => (
            <section key={d.id}>
              <h2 className="ll-exam-browse__deck">
                <span className="ll-num">{deckCode(d)}</span> <span lang="zh-TW">{d.title}</span>
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
                    return q ? (
                      <article key={id} className="ll-exam-browse__item" data-testid="exam-browse-item">
                        <HandoutQuestionReadout
                          q={q}
                          heading="h4"
                          hideAnswer={hide}
                          source={<span className="ll-num">{t({ id: 'exam.q.slide', message: `第 ${n(q.slide)} 頁` })}</span>}
                        />
                      </article>
                    ) : null;
                  })}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      <ConfirmSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={reset}
        title={resetLabel}
        description={t({
          id: 'exam.browse.reset.desc',
          message: `會把 ${readCountText} 題改回未讀，上次讀到的位置也會清掉。作答的紀錄（答對、答錯、熟練）不受影響。`,
          comment: '背題瀏覽：重設已讀的確認說明；readCountText 是已格式化的題數',
        })}
        confirmLabel={t({ id: 'exam.browse.reset.go', message: '改回未讀', comment: '背題瀏覽：重設已讀的確認按鈕' })}
        confirmIcon={<RetryIcon />}
        data-testid="exam-browse-reset-confirm"
      />
      <ToastRegion className="ll-float-toasts" data-testid="exam-browse-toasts" onHoldChange={(held) => (noteHeld.current = held)}>
        {note && (
          <Toast
            key={note.n}
            kind="info"
            onDismiss={() => setNote(null)}
            action={{
              label: t({ id: 'exam.browse.reset.undo', message: '復原', comment: '背題瀏覽：重設已讀之後的浮動提示動作' }),
              onClick: () => {
                note.undo();
                setNote(null);
              },
            }}
          >
            {t({ id: 'exam.browse.reset.done', message: `已經把 ${noteCount} 題改回未讀。`, comment: '背題瀏覽：重設已讀之後的浮動提示；noteCount 已格式化' })}
          </Toast>
        )}
      </ToastRegion>
    </>
  );
}
