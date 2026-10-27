// 錯題本（03 第 2.10 節、02 頁面地圖 /review/）：今天要複習的題目（本地日期、一次最多 10 題）逐題作答，作答來源是 review，
// 依 nextReview 更新盒子；題目改版（answer）回盒子 1 並顯示「題目已更新」、文字改版只加小標記；已下架顯示「這題已下架」可移除。
// 每次進來都和今天的清單比對（題目、順序、開始日期都相同才沿用暫存）：答完一題離開再回來、App 開著過夜，都換成今天到期的題目，不會卡在載入不到的題目。
// 今天的複習做完後，同一天再進來（或在完成畫面切換語言）照樣顯示完成畫面。判分模組載不到時顯示 LoadFailedBanner。
// 畫面（站規 2.5）：TopBar「地圖」加 h1「錯題本」。有到期題時先是入口卡：舞台（鈴 72px、大字題數、primary「開始複習」）加「今天的題目」清單：
// 最多 5 列不可點的資訊列（16px 書籤圖示、關卡代號 Badge、關卡名稱、來源一行；沒有框也沒有底色，上下分隔線，看起來不像可以點的卡片），
// 1024px 以上舞台在左、清單在右（清單貼齊上緣，不在欄裡垂直置中）；
// 按下後是複習中：TopBar compact（圖示返回「離開錯題複習」回到入口，進度暫存；標題是純文字「錯題複習」，前面 16px 的 danger 書籤，
// 不做成有底色的膠囊：和 danger 按鈕「移除」太像，M3 驗收第 4 輪；右邊語言切換和作答頁相同，窄時收成圖示）、
// 題目卡裡一條 4px 的 danger 直條（離左緣 8px、上下各留 24px、兩端圓頭，和選項說明框的色條同一種；不畫在大圓角的 border-left 上）標示錯題模式；
// 完成與沒有到期題都是同一種結果卡（鈴 96px、置中，ll-result--card）：完成是「今天的錯題都複習完了」加「回到地圖」，沒有到期題是 EmptyState 加「去闖關地圖」，
// 有下一次排程時加一行「下次複習」；完成的說明分兩段（成績一句、之後怎麼複習一句），不在詞的中間換行；
// 已下架題目每列寫出原本的關卡（代號 Badge 加名稱，從作答紀錄找；找不到就寫哪一天答過）、來源、右側「已下架」Badge
// 與 danger「移除」，看得出按下會刪掉哪一題；每列前面和「今天的題目」一樣有 16px 書籤欄（空心、text-3），兩張卡的文字欄對齊。
// 列窄（手機、文字放大）時「移除」自己一列靠右，來源與上次作答拿到整個文字欄（M3 驗收第 5 輪）。
// 一次出現（維護者 2026-10-26）：到期清單（題目內容與關卡名）、名詞索引、工作階段（沿用或重新開始）與空狀態的下一次排程都到了才向 usePageReady 回報齊了、
// 整頁一次淡入；在那之前只有 TopBar 的 h1（換頁的焦點落點），沒有骨架，大字題數第一次出現就是數字。
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDate, formatNumber, localePath } from '@ledgerland/i18n';
import { generateAttemptId, type JsonValue, type ReviewQueueEntry } from '@ledgerland/progress';
import { REVIEW_DAILY_LIMIT, nextReview, onQuestionRevised } from '@ledgerland/quiz';
import { Badge, BookmarkIcon, Button, Card, EmptyState, PlayIcon, QuestionCard, TopBar, TrashIcon } from '@ledgerland/web-ui';
import { MapIcon, MapMarker } from '@ledgerland/web-ui/map';
import { QuizLangSwitch } from '../features/quiz/LevelSession.tsx';
import { DeferredFeedbackView as FeedbackView } from '../features/quiz/feedback-lazy.tsx';
import { Markup } from '../features/quiz/Markup.tsx';
import { QuestionView, valueContextOf } from '../features/quiz/QuestionView.tsx';
import { canSubmit } from '../features/quiz/answers.ts';
import { levelCodeLabel } from '../features/quiz/level-code.ts';
import { LoadFailedBanner } from '../features/quiz/LoadFailed.tsx';
import { loadScoring } from '../features/quiz/scoring-lazy.ts';
import { reviewSessionMatches } from '../features/quiz/session-entry.ts';
import { TermsProvider, useTerms } from '../features/quiz/terms.tsx';
import { preloadQuestionModules } from '../features/quiz/lazy-data.ts';
import { PendingContext, usePendingScope } from '../features/quiz/useAsync.ts';
import { loadChapterIndex, loadManifest, loadQuestion, resolveId, type ContentManifest, type QuestionSnapshot, type ResolvedId } from '../lib/content.ts';
import { logError } from '../lib/errors.ts';
import { afterFirstPaint } from '../lib/idle.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { nowIso, secureRandom, todayLocal } from '../lib/progress/app-info.ts';
import { getProgressStore } from '../lib/progress/index.ts';
import { useLocale } from '../lib/useLocale.ts';
import { installQuizPersistence, useQuiz } from '../store/quiz.ts';

export interface ReviewItem {
  entry: ReviewQueueEntry;
  question?: QuestionSnapshot;
  levelTitle?: string;
  /** 關卡的短編號（1-2、E1-1）；查不到時省略 */
  levelCode?: string;
  /** 題目不在快照裡：下架或不認識 */
  resolved?: ResolvedId;
  /** 這次載入時發現的改版種類 */
  revised?: 'answer' | 'text';
}

const KEY = 'review';
/** 鈴的 svg 尺寸：viewBox 上下各有一段留白，可見的帽頂到鞋底約是尺寸的 0.79（15-quiz-session.css 再把留白收掉）。
 *  完成與空狀態看起來 96px（站規 2.5），入口卡 72px */
const BELL_SM = 122;
const BELL_ENTRY = 91;

/** 已經按過「開始複習」的工作階段種子：切換語言重新掛載時留在複習中；按返回或重新整理後回到入口 */
let openedSeed: string | null = null;

function errorText(e: unknown): [string, string] {
  return e instanceof Error ? [e.message, e.stack ?? ''] : [String(e), ''];
}

/** 已下架的題目原本在哪一關：題目本身不在快照裡了，從作答紀錄找最後一次帶 levelId 的紀錄，再查章節索引的名稱與代號（關卡也下架了就只剩代號或什麼都沒有） */
async function retiredOrigin(
  store: Awaited<ReturnType<typeof getProgressStore>>,
  questionId: string,
  locale: 'zh-TW' | 'en',
  manifest: ContentManifest | undefined,
): Promise<Pick<ReviewItem, 'levelTitle' | 'levelCode'>> {
  const attempts = await store.listAttempts({ questionId }).catch(() => []);
  const levelId = attempts.findLast((a) => a.levelId !== undefined)?.levelId;
  if (levelId === undefined) return {};
  const chapters = await loadChapterIndex(locale).catch(() => []);
  const levelTitle = chapters.flatMap((c) => c.levels ?? []).find((l) => l.id === levelId)?.title;
  const levelCode = manifest === undefined ? undefined : levelCodeLabel(manifest, levelId);
  return { ...(levelTitle === undefined ? {} : { levelTitle }), ...(levelCode === undefined ? {} : { levelCode }) };
}

/** 讀今天到期的題目並比對 rev（answer 改版回盒子 1，text 改版只標記），回傳可作答與已下架的清單 */
export async function loadReviewItems(locale: 'zh-TW' | 'en'): Promise<ReviewItem[]> {
  const store = await getProgressStore();
  const due = await store.listDueReviews(todayLocal(), REVIEW_DAILY_LIMIT);
  const manifest = due.length > 0 ? await loadManifest().catch(() => undefined) : undefined;
  const items: ReviewItem[] = [];
  for (const entry of due) {
    const found = await loadQuestion(entry.questionId, locale).catch(() => undefined);
    if (found === undefined) {
      const resolved = await resolveId(entry.questionId, locale).catch((): ResolvedId => ({ status: 'unknown' }));
      items.push({ entry, resolved, ...(await retiredOrigin(store, entry.questionId, locale, manifest)) });
      continue;
    }
    const q = found.question;
    let current = entry;
    let revised: 'answer' | 'text' | undefined;
    if (q.rev > entry.rev) {
      revised = q.revKind === 'answer' ? 'answer' : 'text';
      current = onQuestionRevised(entry, q.rev, revised);
      await store.putReview(current);
    } else if (entry.updateKind !== undefined) revised = entry.updateKind;
    const levelCode = manifest === undefined ? undefined : levelCodeLabel(manifest, found.level.id);
    items.push({ entry: current, question: q, levelTitle: found.level.title, ...(levelCode === undefined ? {} : { levelCode }), revised });
  }
  return items;
}

export default function Review() {
  const locale = useLocale();
  return (
    <TermsProvider locale={locale}>
      <ReviewSession />
    </TermsProvider>
  );
}

function ReviewSession() {
  const { t } = useLingui();
  const locale = useLocale();
  const { ready: termsReady } = useTerms();
  const quiz = useQuiz();
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [boxNotes, setBoxNotes] = useState<Record<string, ReviewQueueEntry>>({});
  // 這次掛載已經決定好工作階段（沿用或重新開始）：之後清單變動（移除已下架的題目）不再重來，剛答完的題目不會被換掉
  const [settled, setSettled] = useState(false);
  // 判分模組載不到（顯示 LoadFailedBanner；「再試一次」重跑還原判分）
  const [loadFailed, setLoadFailed] = useState(false);
  // 剛按下「確認答案」的題目：回饋面板出現時捲到畫面上緣（還原、切換語言時不捲）
  const [freshConfirm, setFreshConfirm] = useState<string | null>(null);

  useEffect(() => {
    installQuizPersistence();
  }, []);

  // 判分與紀錄的 chunk 在第一次繪製送出後預載（和作答頁相同，見 scoring-lazy.ts）
  useEffect(() => afterFirstPaint(() => void loadScoring()), []);

  useEffect(() => {
    let alive = true;
    loadReviewItems(locale).then(
      (list) => alive && setItems(list),
      () => alive && setItems([]),
    );
    return () => {
      alive = false;
    };
  }, [locale]);

  const answerable = useMemo(() => (items ?? []).filter((it) => it.question !== undefined), [items]);
  const retired = useMemo(() => (items ?? []).filter((it) => it.question === undefined), [items]);
  const byId = useMemo(() => new Map(answerable.map((it) => [it.entry.questionId, it] as const)), [answerable]);

  const beginFresh = useCallback(() => {
    if (answerable.length === 0) return;
    useQuiz.getState().begin(
      KEY,
      {
        mode: 'review',
        questionIds: answerable.map((it) => it.entry.questionId),
        shuffleSeed: generateAttemptId(secureRandom),
        startedAt: nowIso(),
      },
      { answerRevs: Object.fromEntries(answerable.map((it) => [it.entry.questionId, it.question!.answerRev] as const)) },
    );
  }, [answerable]);

  // 開始或還原（每次掛載都比對）：store 已有錯題本的工作階段時 hydrate 直接沿用它（已完成的回 false），
  // 題目、順序與開始日期都和今天的清單一致、答案也沒改版才沿用，否則重新開始
  useEffect(() => {
    if (items === null || answerable.length === 0 || settled) return;
    let alive = true;
    void useQuiz
      .getState()
      .hydrate(KEY)
      .then((restored) => {
        if (!alive) return;
        setSettled(true);
        const current = useQuiz.getState();
        const session = current.session;
        const ids = answerable.map((it) => it.entry.questionId);
        const matches =
          restored &&
          current.key === KEY &&
          session !== null &&
          reviewSessionMatches(session, ids, todayLocal()) &&
          // 答案改版的題目（暫存記的 answerRev 和現在不同）：整個錯題本重新開始，不沿用舊的判分
          ids.every((id) => {
            const was = current.answerRevs[id];
            return was === undefined || was === byId.get(id)?.question?.answerRev;
          });
        if (!matches) beginFresh();
      });
    return () => {
      alive = false;
    };
  }, [items, answerable, byId, beginFresh, settled]);

  const session = quiz.key === KEY ? quiz.session : null;

  // 已確認卻還沒有判分結果的題目（重新整理、還原暫存之後）：依存下的答案重算；判分模組載不到時顯示 LoadFailedBanner
  const needsRescore =
    session !== null &&
    session.questionIds.some((id) => session.questions[id]?.confirmed && session.questions[id]?.answer !== undefined && quiz.results[id] === undefined);
  const rescore = useCallback(() => {
    let alive = true;
    loadScoring().then(
      ({ scoreSnapshotQuestion }) => {
        if (!alive) return;
        const latest = useQuiz.getState();
        if (latest.key !== KEY || latest.session === null) return;
        for (const id of latest.session.questionIds) {
          const qs = latest.session.questions[id];
          const q = byId.get(id)?.question;
          if (qs?.confirmed && qs.answer !== undefined && q && latest.results[id] === undefined)
            latest.setResult(id, scoreSnapshotQuestion(q, qs.answer).result);
        }
      },
      (e: unknown) => {
        if (!alive) return;
        setLoadFailed(true);
        void logError(...errorText(e));
      },
    );
    return () => {
      alive = false;
    };
  }, [byId]);
  useEffect(() => (needsRescore ? rescore() : undefined), [needsRescore, rescore]);

  const retryLoad = () => {
    setLoadFailed(false);
    if (needsRescore) rescore();
  };
  const loadFailedBanner = loadFailed ? <LoadFailedBanner onRetry={retryLoad} /> : null;

  const removeEntry = async (questionId: string) => {
    const store = await getProgressStore();
    await store.removeReview(questionId);
    setItems((list) => (list === null ? list : list.filter((it) => it.entry.questionId !== questionId)));
  };

  // 入口與複習中：按過「開始複習」的工作階段才進複習中（切換語言重新掛載時照樣留在複習中）
  const [opened, setOpened] = useState<string | null>(openedSeed);
  const inReview = opened !== null && session !== null && session.shuffleSeed === opened && !session.completed;
  const focusAfter = useRef<'mode' | 'entry' | null>(null);
  const startReview = (seed: string) => {
    openedSeed = seed;
    focusAfter.current = 'mode';
    setOpened(seed);
  };
  const leaveReview = () => {
    openedSeed = null;
    focusAfter.current = 'entry';
    setOpened(null);
  };
  // 進出複習中都像換頁：焦點移到新的 h1
  useEffect(() => {
    const target = focusAfter.current;
    // 只在畫面真的換到目標狀態之後才移焦點（複習中的 h1 要等畫面換過去才在 DOM 裡）
    if (target === null || (target === 'mode') !== inReview) return;
    focusAfter.current = null;
    document.getElementById(target === 'mode' ? 'll-review-mode-title' : 'll-review-title')?.focus();
  }, [inReview]);

  // 沒有到期題時的下一次排程（「下次複習：10月27日 2 題」）：清單讀到、確定是空的才讀；undefined 是還在讀，null 是沒有排程（讀不到也算沒有）。
  // 空狀態要等它到了才算齊（那一行不能晚一步冒出來）
  const [nextDue, setNextDue] = useState<{ date: string; count: number } | null | undefined>(undefined);
  const empty = items !== null && answerable.length === 0;
  useEffect(() => {
    if (!empty) return;
    let alive = true;
    void getProgressStore()
      .then((store) => store.listReviews())
      .then(
        (all) => {
          if (!alive) return;
          const today = todayLocal();
          const future = all.filter((r) => r.status !== 'mastered' && r.dueAt > today).map((r) => r.dueAt);
          if (future.length === 0) {
            setNextDue(null);
            return;
          }
          const date = future.reduce((a, b) => (b < a ? b : a));
          setNextDue({ date, count: future.filter((d) => d === date).length });
        },
        () => alive && setNextDue(null),
      );
    return () => {
      alive = false;
    };
  }, [empty]);

  // 第一次繪製要的資料（維護者 2026-10-26）：到期清單（題目內容、關卡名）到了；空的話再等下一次排程；有題的話再等工作階段決定好（沿用或重新開始）
  // 與名詞索引（題目裡的名詞 chip）。讀不到時各自退回空清單或空索引，不會一直等
  // 作答區（四種延後載入的題型、核心資料、選報表題的名詞定義）還沒齊時由 PendingContext 回報（和 LevelSession 同一套），整頁一起等
  const area = usePendingScope();
  const ready = items !== null && (empty ? nextDue !== undefined : session !== null && termsReady && settled && !area.pending);
  usePageReady(ready);
  // 目前這一題要的作答區模組與名詞定義先載（換題時下一題第一次渲染就完整，和 LevelSession 同一套）；hook 要在所有提早 return 之前
  const currentQ = session ? byId.get(session.questionIds[session.currentIndex]!)?.question : undefined;
  useEffect(() => {
    if (currentQ) preloadQuestionModules(currentQ);
  }, [currentQ]);

  const playHref = localePath(locale, '/play/');
  const topBar = (
    <TopBar
      title={t({ id: 'review.title', message: '錯題本', comment: '錯題本頁面的標題' })}
      titleId="ll-review-title"
      backHref={playHref}
      backLabel={t({ id: 'review.back', message: '回到闖關地圖', comment: '錯題本頁首返回按鈕的可讀名稱（錯題本在 Tab bar 的「闖關」底下）' })}
      backShortLabel={t({ id: 'review.back.short', message: '地圖', comment: '錯題本頁首返回按鈕上的短字（必須是「回到闖關地圖」的一部分）' })}
    />
  );
  // 還在讀：整頁被 PageReveal 藏著，只放 TopBar（h1 是換頁的焦點落點，內容到了之後是同一個元素）；沒有骨架
  if (items === null) return topBar;

  // 今天開始的錯題本工作階段已經做完（同一天再進來、在完成畫面切換語言時清單已經空了）
  const doneToday = session !== null && session.completed && session.startedAt.slice(0, 10) === todayLocal() ? session : null;

  // 來源一行：「答錯 2 次」或「你標成猜的」（入口清單、已下架清單共用）
  const sourceText = (entry: ReviewQueueEntry) => {
    if (entry.addedBy === 'guessed')
      return t({ id: 'review.source.guessed', message: '你標成猜的', comment: '錯題本入口每一列的來源：作答時按了「我是猜的」' });
    const times = formatNumber(Math.max(1, entry.wrongCount), locale);
    return t({ id: 'review.source.wrong', message: `答錯 ${times} 次`, comment: '錯題本入口每一列的來源：答錯的次數；times 是已格式化的次數' });
  };

  // 已下架的題目：每列第一行是原本的關卡（代號 Badge、名稱一行截斷）加右側「已下架」Badge；第二行是來源與上次作答的日期，右邊 danger「移除」。
  // 作答紀錄裡找不到關卡時，第一行改寫「10月20日答過的題目」，至少看得出是哪一題
  const retiredList = retired.length > 0 && (
    <Card as="section" className="ll-review-retired" aria-labelledby="ll-review-retired">
      <h2 id="ll-review-retired" className="ll-review-retired__title">
        <Trans id="review.retired.title" comment="錯題本裡已下架題目的區塊標題">
          已下架的題目
        </Trans>
      </h2>
      <ul className="ll-review-retired__list">
        {retired.map((it) => {
          const date = formatDate(it.entry.lastAnsweredAt.slice(0, 10), locale);
          const known = it.levelTitle !== undefined;
          return (
            <li key={it.entry.questionId} className="ll-review-retired__row" data-testid="review-retired-row">
              <span className="ll-review-retired__mark" aria-hidden="true">
                <BookmarkIcon size={16} />
              </span>
              <p className="ll-review-retired__name">
                {it.levelCode !== undefined && <Badge className="ll-num">{it.levelCode}</Badge>}
                <span className="ll-review-retired__label">
                  {known
                    ? it.levelTitle
                    : t({
                        id: 'review.retired.answeredOn',
                        message: `${date}答過的題目`,
                        comment: '已下架的題目找不到原本的關卡時，那一列的名稱；date 是上次作答的日期（已格式化）',
                      })}
                </span>
                <Badge className="ll-review-retired__badge">
                  {t({ id: 'review.retired.badge', message: '已下架', comment: '錯題本已下架題目每一列右側的標籤' })}
                </Badge>
              </p>
              <div className="ll-review-retired__meta">
                <p className="ll-review-retired__source">
                  <span>{sourceText(it.entry)}</span>
                  {known && (
                    <span>
                      {/* 「上次作答」和日期是同一項，整項一起換行；整項比一行還寬時才在「上次作答」後面換行（日期整段不拆） */}
                      <Trans id="review.retired.lastOn" comment="已下架題目那一列的上次作答日期；date 已格式化（整段日期不換行）">
                        上次作答 <span className="ll-review-retired__date">{date}</span>
                      </Trans>
                    </span>
                  )}
                </p>
                {it.resolved?.status === 'retired' && it.resolved.supersededBy !== undefined && (
                  <p className="ll-review-retired__note">
                    {t({ id: 'review.retired.superseded', message: '已有替代題目，會在重玩該關時遇到。', comment: '下架題目有替代題時的補充' })}
                  </p>
                )}
              </div>
              <Button
                variant="danger"
                size="sm"
                minWidth="action"
                icon={<TrashIcon />}
                className="ll-review-retired__remove"
                onClick={() => void removeEntry(it.entry.questionId)}
              >
                <Trans id="review.retired.remove" comment="從錯題本移除已下架題目的按鈕">
                  移除
                </Trans>
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );

  const doneView = (done: NonNullable<typeof session>) => {
    const correct = done.questionIds.filter((id) => done.questions[id]?.correct === true).length;
    const right = formatNumber(correct, locale);
    const total = formatNumber(done.questionIds.length, locale);
    return (
      <>
        {topBar}
        <section className="ll-result ll-result--review ll-result--card" aria-labelledby="ll-review-done">
          <div className="ll-result__stage">
            {/* 鈴的表情跟著成績（和結果頁相同）：一題都沒答對時雙手交握、微笑、不閃光 */}
            <div className="ll-result__bell ll-result__bell--sm" aria-hidden="true">
              {correct === 0 ? <MapMarker pose="clasp" expression="smile" size={BELL_SM} /> : <MapMarker pose="wave" expression="joy" size={BELL_SM} />}
            </div>
            <h2 id="ll-review-done" className="ll-result__title" tabIndex={-1}>
              <Trans id="review.done.heading" comment="今天的錯題複習做完時，小舞台的標題">
                今天的錯題都複習完了
              </Trans>
            </h2>
            {/* 成績一句、之後怎麼複習一句，各自一段（M3 驗收第 4 輪）；字照全站規則逐字換行 */}
            <p className="ll-result__score">
              {t({
                id: 'review.done.score',
                message: `答對 ${right} 題，共 ${total} 題。`,
                comment: '錯題複習完成的成績；right 是答對題數、total 是題數（都已格式化）',
              })}
            </p>
            <p className="ll-result__note ll-result__note--hint">
              <Trans id="review.done.comeBack" comment="錯題複習完成後，說明之後什麼時候再複習。不提間隔複習的「盒子」（學生看不懂的內部用語）">
                答對的會隔久一點再來，答錯的明天再見。
              </Trans>
            </p>
          </div>
          <div className="ll-result__actions ll-result__actions--single">
            <Button variant="primary" size="lg" icon={<MapIcon />} href={playHref}>
              <Trans id="review.done.toMap" comment="複習完成後回到闖關地圖的按鈕（和結果頁的「回到地圖」同一種說法）">
                回到地圖
              </Trans>
            </Button>
          </div>
        </section>
        {retiredList}
      </>
    );
  };

  if (answerable.length === 0) {
    if (doneToday !== null) return doneView(doneToday);
    const date = nextDue ? formatDate(nextDue.date, locale) : '';
    const n = nextDue ? formatNumber(nextDue.count, locale) : '';
    const nextLine = nextDue
      ? t({ id: 'review.next', message: `下次複習：${date} ${n} 題`, comment: '錯題本空狀態下的下一次排程；date 是已格式化的日期、n 是已格式化的題數' })
      : null;
    return (
      <>
        {topBar}
        <section className="ll-result ll-result--review ll-result--card ll-review-empty" aria-labelledby="ll-review-empty-title">
          <div className="ll-result__stage">
            <EmptyState
              className="ll-result__state"
              titleId="ll-review-empty-title"
              illustration={
                <span className="ll-result__bell ll-result__bell--sm">
                  <MapMarker pose="clasp" size={BELL_SM} />
                </span>
              }
              title={
                <Trans id="review.empty.heading" comment="錯題本沒有到期題目時的標題">
                  今天沒有要複習的題目
                </Trans>
              }
              description={
                <>
                  <Trans id="review.empty.comeBack" comment="錯題本沒有到期題目時的說明">
                    答錯或標成猜的題目，會在之後幾天回來找你。
                  </Trans>
                  {nextLine !== null && (
                    <span className="ll-review-empty__next" data-testid="review-next">
                      {nextLine}
                    </span>
                  )}
                </>
              }
              action={
                <Button variant="primary" icon={<MapIcon />} href={playHref}>
                  <Trans id="review.empty.goMap" comment="錯題本空狀態的按鈕：去闖關地圖（和找不到頁面的「去闖關地圖」同一種說法）">
                    去闖關地圖
                  </Trans>
                </Button>
              }
            />
          </div>
        </section>
        {retiredList}
      </>
    );
  }

  // 還沒決定好工作階段（沿用或重新開始）之前不畫 store 裡的舊工作階段（這時整頁還藏著，不會先閃一下昨天的畫面）
  if (session === null || !termsReady || !settled) return topBar;

  if (session.completed) return doneView(session);

  const updatedBadge = (it: ReviewItem) =>
    it.revised === 'answer' ? (
      <Badge kind="warning">{t({ id: 'review.updated.answer', message: '題目已更新', comment: '錯題本：題目答案改版時的標示' })}</Badge>
    ) : it.revised === 'text' ? (
      <Badge kind="info">{t({ id: 'review.updated.text', message: '文字有更新', comment: '錯題本：題目文字改版時的小標記' })}</Badge>
    ) : null;

  // 入口：今天要複習 N 題，最多列 5 題（不可點的資訊列），其餘「還有 N 題」；做到一半回來是「繼續複習」
  if (!inReview) {
    const count = answerable.length;
    const shown = answerable.slice(0, 5);
    const more = count - shown.length;
    const started = session.currentIndex > 0 || session.questionIds.some((id) => session.questions[id]?.confirmed);
    const n = formatNumber(count, locale);
    const moreN = formatNumber(more, locale);
    return (
      <>
        {topBar}
        <Card as="section" className="ll-review-entry" aria-labelledby="ll-review-entry-title">
          <div className="ll-review-entry__stage">
            <div className="ll-review-entry__bell" aria-hidden="true">
              <MapMarker pose="clasp" size={BELL_ENTRY} />
            </div>
            <h2 id="ll-review-entry-title" className="ll-review-entry__title">
              <Trans id="review.entry.count" comment="錯題本入口卡的標題：上面一行小字，下面是大字題數加單位；n 是已格式化的題數">
                <span className="ll-review-entry__eyebrow">今天要複習</span>{' '}
                <span className="ll-review-entry__count">
                  <span className="ll-review-entry__num ll-num">{n}</span> 題
                </span>
              </Trans>
            </h2>
            <div className="ll-review-entry__actions">
              <Button variant="primary" size="lg" block icon={<PlayIcon />} onClick={() => startReview(session.shuffleSeed)} data-testid="review-start">
                {started
                  ? t({ id: 'review.resume', message: '繼續複習', comment: '錯題本入口：今天的複習做到一半時的按鈕' })
                  : t({ id: 'review.start', message: '開始複習', comment: '錯題本入口的主要按鈕' })}
              </Button>
            </div>
          </div>
          <div className="ll-review-entry__queue">
            <h3 className="ll-review-entry__list-title">
              {t({ id: 'review.entry.listTitle', message: '今天的題目', comment: '錯題本入口卡裡，今天到期題目清單的小標' })}
            </h3>
            <ul className="ll-review-entry__list">
              {shown.map((it) => (
                <li key={it.entry.questionId} className="ll-review-entry__row">
                  <span className="ll-review-entry__mark" aria-hidden="true">
                    <BookmarkIcon filled size={16} />
                  </span>
                  <div className="ll-review-entry__main">
                    <p className="ll-review-entry__level">
                      {it.levelCode !== undefined && <Badge className="ll-num">{it.levelCode}</Badge>}
                      <span>{it.levelTitle}</span>
                    </p>
                    <p className="ll-review-entry__source">
                      <span>{sourceText(it.entry)}</span>
                      {updatedBadge(it)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {more > 0 && (
              <p className="ll-review-entry__more">
                {t({ id: 'review.entry.more', message: `還有 ${moreN} 題`, comment: '錯題本入口：列表只列 5 題，其餘的題數；moreN 是已格式化的題數' })}
              </p>
            )}
          </div>
        </Card>
        {retiredList}
      </>
    );
  }

  const qid = session.questionIds[session.currentIndex]!;
  const item = byId.get(qid);
  const q = item?.question;
  if (!item || !q) return <NotFoundInline />;
  const qs = session.questions[qid]!;
  const result = quiz.results[qid];
  const note = boxNotes[qid];

  // 判分模組載好之後才讀 store：連按兩次時第二次會看到已確認而直接返回。載不到時顯示 LoadFailedBanner，不會按了沒反應
  const onSubmit = async () => {
    let scoring: Awaited<ReturnType<typeof loadScoring>>;
    try {
      scoring = await loadScoring();
    } catch (e) {
      setLoadFailed(true);
      void logError(...errorText(e));
      return;
    }
    const { scoreSnapshotQuestion, recordAttempt, recordReviewResult } = scoring;
    setLoadFailed(false);
    const current = useQuiz.getState();
    const state = current.session?.questions[qid];
    if (current.key !== KEY || !state || state.confirmed || state.answer === undefined) return;
    const { result: r, answer } = scoreSnapshotQuestion(q, state.answer);
    setFreshConfirm(qid);
    current.confirm(qid, r);
    if (current.attemptIds[qid] !== undefined) return;
    recordAttempt({ q, answer, result: r, source: 'review', durationMs: Date.now() - current.questionShownAt }).then(
      ({ attemptId }) => {
        useQuiz.getState().markAttempt(qid, attemptId);
      },
      // 寫不進去（資料庫暫停等）：記進錯誤紀錄，儲存層的提示由 storageStatus 負責
      (e: unknown) => void logError(...errorText(e)),
    );
    // 盒子的下一個狀態是純函式，先顯示再寫入
    const next = nextReview(item.entry, r.correct ? 'correct' : 'wrong', nowIso());
    setBoxNotes((m) => ({ ...m, [qid]: next }));
    recordReviewResult(item.entry, r.correct).catch((e: unknown) => void logError(...errorText(e)));
  };

  const boxText = (entry: ReviewQueueEntry) => {
    if (entry.status === 'mastered') return t({ id: 'review.box.mastered', message: '已掌握，離開複習清單。', comment: '複習答對後盒子 4 升級為已掌握' });
    const box = entry.box;
    const dueAt = formatDate(entry.dueAt, locale);
    return t({
      id: 'review.box.next',
      message: `現在在盒子 ${box}，下次複習：${dueAt}。`,
      comment: '複習作答後的盒子狀態；box 是盒子號碼、dueAt 是已格式化的日期',
    });
  };

  return (
    <>
      <div className="ll-level-head ll-review-head">
        <TopBar
          compact
          title={
            <span className="ll-review-mode">
              <BookmarkIcon filled size={18} />
              {t({ id: 'review.mode', message: '錯題複習', comment: '錯題複習中的頁首標題' })}
            </span>
          }
          titleId="ll-review-mode-title"
          onBack={leaveReview}
          backLabel={t({ id: 'review.leave', message: '離開錯題複習', comment: '錯題複習中頁首返回圖示的可讀名稱（回到錯題本入口，進度暫存）' })}
          actions={<QuizLangSwitch />}
        />
      </div>
      <p className="ll-review-source">
        {item.levelCode !== undefined && <Badge className="ll-num">{item.levelCode}</Badge>}
        <span className="ll-review-source__level">{item.levelTitle}</span>
        {updatedBadge(item)}
      </p>
      {loadFailedBanner}
      {/* 作答區還沒齊時整張題目卡隱藏、齊了淡入（和 LevelSession 同一個 .ll-question-wrap） */}
      <div className="ll-question-wrap" data-ready={area.pending ? 'false' : 'true'}>
        <>
          <QuestionCard
            className="ll-question--review"
            index={session.currentIndex + 1}
            total={session.questionIds.length}
            prompt={
              <Markup
                text={(q['prompt'] as string | undefined) ?? t({ id: 'quiz.tf.prompt', message: '下面這句話對不對？' })}
                ctx={valueContextOf(q)}
                plainTerms
              />
            }
            checked={qs.confirmed}
            canSubmit={canSubmit(q, qs.answer)}
            onSubmit={() => void onSubmit()}
            {...(q.type === 'classify' ? { submitLabel: t({ id: 'quiz.submit.classify', message: '確認分類' }) } : {})}
            feedback={
              result === undefined ? undefined : (
                <FeedbackView
                  q={q}
                  result={result}
                  mistakeState="none"
                  onNext={() => useQuiz.getState().next()}
                  scrollOnMount={freshConfirm === qid}
                  nextLabel={note && <p className="ll-review-box">{boxText(note)}</p>}
                />
              )
            }
          >
            {({ promptId }) => (
              <PendingContext.Provider value={area.registry}>
                <QuestionView
                  q={q}
                  answer={qs.answer as JsonValue | undefined}
                  checked={qs.confirmed}
                  {...(result === undefined ? {} : { result })}
                  shuffleSeed={session.shuffleSeed}
                  promptId={promptId}
                  onChange={(answer, rawInput) => useQuiz.getState().select(qid, answer, rawInput)}
                />
              </PendingContext.Provider>
            )}
          </QuestionCard>
        </>
      </div>
    </>
  );
}

function NotFoundInline() {
  return (
    <p className="ll-muted">
      <Trans id="review.questionMissing" comment="錯題本裡的題目載入不到時的說明">
        這題暫時載入不到，重新整理後再試一次。
      </Trans>
    </p>
  );
}
