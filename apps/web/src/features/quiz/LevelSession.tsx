// 作答頁的工作階段（02 第 5 節、03 第 2.4 到 2.12 節、05 第 8.5 節）：pages/Level.tsx 載好關卡快照與名詞索引後渲染這個元件，依題型渲染元件，
// 「確認答案」後用 packages/quiz 判分、寫作答紀錄、錯題本與名詞解鎖；作答工作階段在路由外的 store（切換語言、開名詞卡、重新整理都從暫存還原，不重新出題）。
// 同一路由的結束狀態是結果頁：星星、正確率、回到地圖（?from=<levelId>）、再挑戰；第一次完成任何關卡時呼叫 maybePersist('first-level-complete')。
// 完成紀錄依工作階段種子只寫一次（store 的 claimCompletion）：在結果頁切換語言重新掛載時不重記；從地圖、Tab bar、章節頁或返回鍵再進已完成的關卡，
// 一律開新的一輪。分辨「離開」與「切換語言」靠卸載時的網址（session-entry.ts）：不用 navigate state，因為 state 會留在那一筆歷史紀錄裡，
// 之後用返回鍵回到那一筆時會被誤認成切換語言。
// 判分模組或結果頁延後載入失敗時顯示 LoadFailedBanner（再試一次、重新整理），不會按了「確認答案」沒反應或結果頁一直是「…」。
// 還原暫存時，答案改版的題目（暫存記的 answerRev 和現在的快照不同）作廢、退回那一題重新作答，並提示「部分題目已更新」（02 第 3 節第 7 點）。
// 判分與紀錄（packages/quiz 的 score、core、zod）不在第一次繪製的關鍵路徑：第一次繪製送出後預載（scoring-lazy.ts），按下「確認答案」、
// 還原已確認的作答與結果頁才等它（06 第 8.2 節、14 第 5.2 節）；結果頁元件和判分一起預載（result-lazy.ts）。
// 計時（03 第 2.10 節）：開始工作階段時讀 localStorage 鏡像的 timerEnabled 決定上限（關閉時 0），開啟時第一次繪製後才讀進度資料庫的「寬鬆」並補上時間；
// 每秒 tick，按鈕隨時暫停或繼續；切到背景由 installQuizPersistence 自動暫停、離開作答畫面（Tab bar、返回、名詞頁、去別關）時這裡自動暫停並立即寫暫存，
// 回來都不自動恢復，由學生按「繼續」（02 第 5.1、5.3 節）；不計分的關卡不計時。計時狀態在工作階段裡，切換語言照樣保留、照樣倒數。
// 全站沒開計時時，第一題還沒確認前可以按「這一關計時」單次開啟（不改設定）；時間到之後照樣累計用時，結果頁顯示這一關的用時；
// 「剩 1 分鐘」與「時間到」的螢幕閱讀器提醒可以在設定裡關閉（timerAnnounce，第一次繪製後才讀；讀到之前先不播報）。
// 收藏（03 第 2.7 節）：只有不計分的取捨題；清單第一次繪製後才讀（level-favourites.ts），按下依畫面上的狀態寫入目標值（先樂觀更新再寫回）。
// 為什麼不放在 pages/Level.tsx：頁面 chunk 在殼層預先載入的第一波裡，Lighthouse 模擬下它每大約 1 KB 就讓關卡快照較大的關卡多一輪請求（約 150ms）；
// 這個檔案在 quiz-view 群組（vite.config.ts），和題目元件同一個 chunk，不在那條關鍵路徑上（2026-10-24 實測）。錯題本因此多載這段程式。
// 收進圖鑑不再用浮動提示（M3 驗收第 2 輪：手機上它停在「下一題」正上方，剛好蓋住「我是猜的」那一列）：回饋面板「相關名詞」小標旁的「新收進 N」
// 與新收 chip 的金色勾章（FeedbackView 的 newTermIds），結果頁照樣有「新收名詞」。
// 頁首右側的語言切換（QuizLangSwitch）也從這裡匯出：pages/Level.tsx 的載入中與離線、錯題複習共用，換狀態時頁首不跳。
// 沒有骨架（維護者 2026-10-26：點進任何一頁都要直接看到完整的資訊）：這一頁用 usePageReady 回報「第一題齊了沒」（關卡快照由 pages/Level.tsx 回報；
// 這裡等工作階段開始或從暫存還原、名詞索引、還原的已確認作答重算完、這一題的作答區模組與資料），齊了整頁一次淡入（lib/page-ready.tsx）。
// 之後的題目：回饋期間就預載下一題要的模組與名詞定義（lazy-data.ts、terms.tsx），換題時第一次渲染就完整；萬一還沒到，整張題目卡先不顯示、齊了再淡入
// （useAsync.ts 的 usePendingScope，15-quiz-session.css 的 .ll-question-wrap），畫面上不會有只有題幹沒有作答區的一格。
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { type JsonValue } from '@ledgerland/progress';
import type { LevelItem, LevelScore } from '@ledgerland/quiz';
import { localePath } from '@ledgerland/i18n';
import { Button, IconButton, NoteTag, QuestionCard, TimerIcon, Toast, ToastRegion, TopBar, TranslateIcon, useStatementNames } from '@ledgerland/web-ui';
import { LangSwitch, useSwitchLocale } from '../../components/LangSwitch.tsx';
import { DeferredFeedbackView as FeedbackView } from './feedback-lazy.tsx';
import { Markup } from './Markup.tsx';
import { QuestionView, optionsOf, statementCodesOf, statementTermIds, valueContextOf } from './QuestionView.tsx';
import { canSubmit } from './answers.ts';
import { isFavourite } from './favourites.ts';
import type { LevelNotes } from './level-notes.ts';
import { preloadQuestionModules } from './lazy-data.ts';
import { canFavourite, useFavouriteList } from './level-favourites.ts';
import { levelTimerMs, mirroredTimerEnabled, startTicker } from './level-timer.ts';
import { LoadFailedBanner, LoadFailedState } from './LoadFailed.tsx';
import { loadResultView, type ResultViewComponent } from './result-lazy.ts';
import { loadScoring } from './scoring-lazy.ts';
import { isLevelPath, levelEntryAction, noteSessionExit, revisedQuestionIds, stayedOnPage } from './session-entry.ts';
import { noteLevelExit } from '../../lib/level-exit.ts';
import { prefetchTermDetails, useTerms } from './terms.tsx';
import { TIMER_ANNOUNCE_SETTING, TIMER_RELAXED_SETTING, parseTimerSettings } from './timer.ts';
import { TimerDisplay, timerDisplayProps } from './TimerDisplay.tsx';
import { PendingContext, usePendingScope } from './useAsync.ts';
import { captureScrollAnchor, useScrollAnchor } from './useScrollAnchor.ts';
import type { LevelSnapshot, QuestionSnapshot } from '../../lib/content.ts';
import { generateAttemptId } from '@ledgerland/progress';
import { logError } from '../../lib/errors.ts';
import { afterFirstPaint } from '../../lib/idle.ts';
import { usePageReady } from '../../lib/page-ready.tsx';
import { nowIso, secureRandom } from '../../lib/progress/app-info.ts';
import { getProgressStore } from '../../lib/progress/index.ts';
import { maybePersist } from '../../lib/progress/persist.ts';
import { browserStorageOrNull } from '../../lib/progress/settings-mirror.ts';
import { useLocale } from '../../lib/useLocale.ts';
import { installQuizPersistence, useQuiz } from '../../store/quiz.ts';
import { NotFound } from '../../pages/NotFound.tsx';

/** 這一輪新收進圖鑑的名詞（依工作階段種子；切換語言重新掛載時照樣在，結果頁的「新收名詞」用；重新整理後沒有就不顯示） */
const newTermsBySeed = new Map<string, Set<string>>();
/** 每一題剛收進圖鑑的名詞（鍵是「種子:題目 ID」）：回饋面板的「新收進 N」與 chip 的鍍金樣式；切換語言重新掛載時照樣在 */
const freshTermsByQuestion = new Map<string, readonly string[]>();

/**
 * 作答頁與錯題複習頁首右側的語言切換。05 第 8 節要求作答中可以切換語言、保留題目、已選選項、計時與捲動位置，QR 進來的學生也要能在頁面上換，
 * 所以不拿掉；頁首夠寬時是「中／EN」分段控制（LangSwitch sm），頁首窄於 26em（手機、文字放大）時收成一顆 44px 的語言圖示按鈕，點了開選單
 * （M3 驗收第 2 輪：分段控制在 375px 占掉約 145px，把關卡名稱擠成兩字一行）。兩種都在 DOM 裡，由 15-quiz-session.css 的容器查詢 ll-level-head 切換。
 * 窄版的選單（QuizLangMenu.tsx，web-ui 的 Menu 在 overlay chunk）在第一次繪製送出後才載入（M3 收尾 QA，2026-10-26：作答頁第一波少一個 chunk）；
 * 之前先畫外觀與可讀名稱都相同的按鈕（同一個 IconButton，chrome、aria-haspopup="menu"），載入前就按下時先載入、載入後直接打開；換成真的按鈕時焦點跟過去。
 */
type QuizLangMenuModule = typeof import('./QuizLangMenu.tsx');
let quizLangMenu: QuizLangMenuModule | null = null;
let quizLangMenuPromise: Promise<QuizLangMenuModule> | null = null;
function loadQuizLangMenu(): Promise<QuizLangMenuModule> {
  quizLangMenuPromise ??= import('./QuizLangMenu.tsx').then(
    (m) => (quizLangMenu = m),
    (err: unknown) => {
      quizLangMenuPromise = null; // 離線又沒有 precache 時下次按下再試
      throw err;
    },
  );
  return quizLangMenuPromise;
}

/** 切換語言前先同步記下捲動錨點：useScrollAnchor 平常在捲動後的下一個影格才記錄，慢的環境（CI 的 Linux WebKit，影格可以晚超過 300ms）
 *  來不及記就切換、整頁重新掛載，還原用的會是上一次捲動的舊錨點（2026-10-28 main 的 E2E）。這一刻版面還沒動，記到的就是使用者看到的位置；
 *  載入中或離線的頁面沒有錨點元素時不覆蓋（可能是剛從暫存讀回、等著還原的錨點） */
function flushScrollAnchor(): void {
  const anchor = captureScrollAnchor();
  if (anchor) useQuiz.getState().setAnchor(anchor);
}

export function QuizLangSwitch() {
  const { t } = useLingui();
  const current = useLocale();
  // 和 LangSwitch 同一個實作：以 replace 換到另一種語言的同一頁並記住偏好；作答狀態在路由外的 store，不受影響
  const go = useSwitchLocale(flushScrollAnchor);
  const currentNote = t({ id: 'quiz.lang.current', message: '（目前）', comment: '作答頁語言選單裡，目前語言那一項後面的視覺隱藏補充' });
  const label = t({ id: 'quiz.lang.menu', message: '切換語言', comment: '作答頁頁首窄的時候，語言圖示按鈕的可讀名稱（點了開語言選單）' });
  const [menu, setMenu] = useState<QuizLangMenuModule | null>(quizLangMenu);
  const [openOnLoad, setOpenOnLoad] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  const swapIn = useCallback((m: QuizLangMenuModule) => {
    const trigger = wrap.current?.querySelector('[data-testid="quiz-lang-menu"]');
    refocus.current = trigger !== null && trigger !== undefined && trigger === document.activeElement;
    setMenu(() => m);
  }, []);
  useEffect(() => {
    if (menu) return;
    let alive = true;
    const cancel = afterFirstPaint(() => {
      loadQuizLangMenu().then(
        (m) => alive && swapIn(m),
        () => {},
      );
    });
    return () => {
      alive = false;
      cancel();
    };
  }, [menu, swapIn]);
  // 換成真的選單按鈕：原本停在暫代按鈕上的焦點移到新的按鈕（打開時焦點由選單移到第一項）
  useLayoutEffect(() => {
    if (!menu || !refocus.current) return;
    refocus.current = false;
    if (!openOnLoad) wrap.current?.querySelector<HTMLElement>('[data-testid="quiz-lang-menu"]')?.focus({ preventScroll: true });
  }, [menu, openOnLoad]);
  return (
    <div className="ll-quiz-lang" ref={wrap}>
      <span className="ll-quiz-lang__wide">
        <LangSwitch size="sm" beforeSwitch={flushScrollAnchor} />
      </span>
      {menu ? (
        <menu.QuizLangMenu className="ll-quiz-lang__narrow" label={label} current={current} currentNote={currentNote} onSelect={go} defaultOpen={openOnLoad} />
      ) : (
        <div className="ll-menu ll-quiz-lang__narrow">
          <IconButton
            icon={<TranslateIcon />}
            label={label}
            variant="chrome"
            aria-haspopup="menu"
            aria-expanded={false}
            data-testid="quiz-lang-menu"
            onClick={() => {
              setOpenOnLoad(true);
              loadQuizLangMenu().then(swapIn, () => setOpenOnLoad(false));
            }}
          />
        </div>
      )}
    </div>
  );
}

/** 結果頁需要的值：星星與正確率（先前的最佳星數跟著工作階段種子存在 store，切換語言重新掛載後照樣顯示） */
interface Completion {
  /** 算出這份結果的工作階段種子（重玩後舊的結果不沿用） */
  seed: string;
  score: LevelScore;
  /** 結果頁元件（result-lazy.ts，和判分一起延後載入） */
  View: ResultViewComponent;
}

function errorText(e: unknown): [string, string] {
  return e instanceof Error ? [e.message, e.stack ?? ''] : [String(e), ''];
}

export function LevelSession({ snapshot, notes }: { snapshot: LevelSnapshot; notes: LevelNotes }) {
  const { level, questions } = snapshot;
  const { t } = useLingui();
  const locale = useLocale();
  const { ready: termsReady, terms } = useTerms();
  const statementNames = useStatementNames();
  const quiz = useQuiz();
  // 這一題的作答區齊了沒（題目元件用 usePendingReport 回報：四種題型的模組、核心資料、報表卡片的名詞定義）
  const area = usePendingScope();
  const key = `level:${level.id}`;
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q] as const)), [questions]);
  const [completion, setCompletion] = useState<Completion | null>(null);
  // 判分模組或結果頁載入失敗（顯示 LoadFailedBanner；「再試一次」重跑還原判分與結果頁的載入）
  const [loadFailed, setLoadFailed] = useState(false);
  // 還原暫存時有已作答的題目答案改版（作廢重答）：顯示一次「部分題目已更新」
  const [revisedNotice, setRevisedNotice] = useState(false);
  // 剛按下「確認答案」的題目：它的回饋面板出現時捲到畫面上緣（還原暫存、切換語言重新掛載時不捲）
  const [freshConfirm, setFreshConfirm] = useState<string | null>(null);
  const previousBest = useQuiz((s) => s.previousBest);
  const scoredCount = useMemo(() => level.questionIds.filter((id) => byId.get(id)?.scored === true).length, [level.questionIds, byId]);
  const favourites = useFavouriteList(useMemo(() => questions.some(canFavourite), [questions]));

  // 頁面隱藏或卸載時立即寫暫存；visibilitychange 轉 hidden 時計時自動暫停（store/quiz.ts）
  useEffect(() => {
    installQuizPersistence();
  }, []);

  // 離開作答畫面（Tab bar、返回、名詞頁、去別關）時計時自動暫停並立即寫暫存，回來由學生按「繼續」（02 第 5.1、5.3 節）。
  // data router 在卸載舊頁面之前就改好網址，所以這裡的 window.location 是目的地；還在同一關（切換語言、重新掛載）不算離開，計時照樣走。
  // 同時記下離開或沒離開，下一次掛載時決定已完成的關卡要留在結果頁還是開新的一輪（session-entry.ts）
  useEffect(
    () => () => {
      const stayed = isLevelPath(window.location.pathname, level.id);
      noteSessionExit(key, stayed);
      if (stayed) return;
      const s = useQuiz.getState();
      // 還沒做完就離開：地圖的 ?from 據此只顯示「已暫存」，不點星星、不播走路（lib/level-exit.ts）
      noteLevelExit(s.key === key && s.session !== null && !s.session.completed ? level.id : null);
      if (s.key !== key || s.session === null) return;
      if (s.session.timer.enabled && !s.session.timer.paused) s.pause();
      void s.flush();
    },
    [key, level.id],
  );

  // 判分、紀錄與結果頁的 chunk 在第一次繪製送出後預載，不和題目搶頻寬
  useEffect(
    () =>
      afterFirstPaint(() => {
        void loadScoring();
        void loadResultView();
      }),
    [],
  );

  const timerInput = useMemo(
    () => ({ unscored: level.unscored, timerSeconds: level.timerSeconds, scoredCount }),
    [level.unscored, level.timerSeconds, scoredCount],
  );
  // 「寬鬆」只存在進度資料庫：第一次繪製送出後才讀，是寬鬆就補上時間。只補同一個工作階段；不隨卸載取消，切換語言重新掛載時也補得到
  const applyRelaxed = useCallback(
    (shuffleSeed: string) => {
      afterFirstPaint(() => {
        void getProgressStore()
          .then((store) => store.getSetting(TIMER_RELAXED_SETTING))
          .then((entry) => {
            if (!parseTimerSettings(true, entry?.value).relaxed) return;
            const current = useQuiz.getState();
            if (current.key !== key || current.session?.shuffleSeed !== shuffleSeed) return;
            current.setTimerTotal(levelTimerMs({ ...timerInput, enabled: true, relaxed: true }));
          })
          .catch(() => {});
      });
    },
    [key, timerInput],
  );

  // 每題目前的 answerRev：開始時記進工作階段，還原時比對（答案改版的已確認作答作廢）
  const answerRevs = useMemo(() => Object.fromEntries(questions.map((q) => [q.id, q.answerRev] as const)), [questions]);

  // 開始新的工作階段：計時與否看 localStorage 鏡像的 timerEnabled（第一次繪製前可讀，不開進度資料庫）
  const beginFresh = useCallback(() => {
    const enabled = mirroredTimerEnabled(browserStorageOrNull());
    const shuffleSeed = generateAttemptId(secureRandom);
    const timerTotalMs = levelTimerMs({ ...timerInput, enabled, relaxed: false });
    useQuiz.getState().begin(
      key,
      {
        mode: 'level',
        levelId: level.id,
        levelRev: level.rev,
        questionIds: level.questionIds,
        shuffleSeed,
        startedAt: nowIso(),
        timerTotalMs,
      },
      { answerRevs },
    );
    if (timerTotalMs === 0) return;
    applyRelaxed(shuffleSeed);
  }, [key, level.id, level.rev, level.questionIds, timerInput, applyRelaxed, answerRevs]);

  // 單次開啟計時（不改全站設定）：從現在起算，「寬鬆」照樣補上；開啟後焦點移到暫停按鈕（原本的按鈕已經不在畫面上）
  const focusTimer = useRef(false);
  const enableTimerOnce = () => {
    const s = useQuiz.getState();
    const total = levelTimerMs({ ...timerInput, enabled: true, relaxed: false });
    if (s.key !== key || s.session === null || total === 0) return;
    s.enableTimer(total);
    focusTimer.current = true;
    applyRelaxed(s.session.shuffleSeed);
  };

  // 「剩 1 分鐘」與「時間到」的提醒設定：有計時才讀（沒計時的關卡不為它開進度資料庫），第一次繪製後才讀；
  // 讀到之前（null）先不播報，讀到開啟時 TimerDisplay 會補播一次
  const [announce, setAnnounce] = useState<boolean | null>(null);
  const timerOn = useQuiz((s) => s.key === key && s.session?.timer.enabled === true);
  useEffect(() => {
    if (!timerOn) return;
    let alive = true;
    const cancel = afterFirstPaint(() => {
      void getProgressStore()
        .then((store) => store.getSetting(TIMER_ANNOUNCE_SETTING))
        .then(
          (entry) => alive && setAnnounce(parseTimerSettings(undefined, undefined, entry?.value).announce),
          () => alive && setAnnounce(true),
        );
    });
    return () => {
      alive = false;
      cancel();
    };
  }, [timerOn]);

  // 開始、沿用或還原工作階段（session-entry.ts）：進行中的同一關沿用；已完成的同一關，切換語言留在結果頁、離開過再進來開新的一輪；
  // 其他情況從暫存還原：同一關、同一個 rev、同一組題目才還原，答案改版的題目作廢
  useEffect(() => {
    let alive = true;
    const s = useQuiz.getState();
    const action = levelEntryAction(s, key, stayedOnPage(key));
    if (action === 'keep') return;
    if (action === 'restart') {
      void s.clear().then(() => {
        if (!alive) return;
        setCompletion(null);
        beginFresh();
      });
      return () => {
        alive = false;
      };
    }
    void s.hydrate(key).then((restored) => {
      if (!alive) return;
      const current = useQuiz.getState();
      const session = current.session;
      const matches =
        restored &&
        current.key === key &&
        session !== null &&
        session.levelId === level.id &&
        session.levelRev === level.rev &&
        session.questionIds.length === level.questionIds.length &&
        session.questionIds.every((id, i) => id === level.questionIds[i]);
      if (!matches) {
        beginFresh();
        return;
      }
      const revised = revisedQuestionIds(session.questionIds, current.answerRevs, (id) => byId.get(id)?.answerRev);
      const changed = session.questionIds.some((id) => current.answerRevs[id] !== byId.get(id)?.answerRev);
      if (revised.length > 0) {
        current.invalidate(revised, answerRevs);
        if (revised.some((id) => session.questions[id]?.confirmed)) setRevisedNotice(true);
      } else if (changed) current.invalidate([], answerRevs);
    });
    return () => {
      alive = false;
    };
  }, [key, level, byId, beginFresh, answerRevs]);

  const session = quiz.key === key ? quiz.session : null;
  const completed = session?.completed === true;

  // 已確認卻還沒有判分結果的題目（重新整理、還原暫存之後）：依存下的答案重算；判分模組載不到時顯示 LoadFailedBanner，「再試一次」重跑
  const needsRescore =
    session !== null &&
    session.questionIds.some((id) => session.questions[id]?.confirmed && session.questions[id]?.answer !== undefined && quiz.results[id] === undefined);
  const rescore = useCallback(() => {
    let alive = true;
    loadScoring().then(
      ({ scoreSnapshotQuestion }) => {
        if (!alive) return;
        const latest = useQuiz.getState();
        if (latest.key !== key || latest.session === null) return;
        for (const id of latest.session.questionIds) {
          const qs = latest.session.questions[id];
          const q = byId.get(id);
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
  }, [key, byId]);
  useEffect(() => (needsRescore ? rescore() : undefined), [needsRescore, rescore]);

  // 每秒扣時間：暫停、時間到、結果頁、不計分的關卡都不跑；重新開始時從現在起算（暫停期間不算）。看回饋時 store 的 tick 不扣
  // 時間到之後照樣 tick：剩餘時間停在 0，用時繼續累計（store 的 tick）
  const timer = session?.timer;
  const timerRunning = timer !== undefined && timer.enabled && !timer.paused && !completed && termsReady && level.unscored !== true;
  const timerShown = timer?.enabled === true;
  useEffect(() => {
    if (!timerShown || !focusTimer.current) return;
    focusTimer.current = false;
    document.querySelector<HTMLElement>('.ll-timer__toggle')?.focus();
  }, [timerShown]);
  useEffect(() => (timerRunning ? startTicker((ms) => useQuiz.getState().tick(ms)) : undefined), [timerRunning]);
  // 完成關卡：更新 levelProgress（星星取最大），第一次完成任何關卡時呼叫 persist
  const items: LevelItem[] = useMemo(
    () => (session === null ? [] : session.questionIds.map((id) => ({ scored: byId.get(id)?.scored === true, score: session.questions[id]?.score ?? 0 }))),
    [session, byId],
  );
  // 結果頁每次掛載都算星星與正確率；完成紀錄依工作階段種子只寫一次（切換語言重新掛載、重新渲染都不重記）。
  // 種子在寫入之前同步記進 store；判分模組或結果頁載不到時還沒記，「再試一次」照常記
  const seed = session?.shuffleSeed;
  const showResult = useCallback(
    (seed: string) => {
      let alive = true;
      Promise.all([loadScoring(), loadResultView()]).then(
        async ([{ levelScore, recordLevelComplete }, View]) => {
          if (!alive) return;
          setCompletion({ seed, score: levelScore(items), View });
          if (!useQuiz.getState().claimCompletion(seed)) return;
          try {
            // 不計分的關卡（level.unscored）只記完成：不算星星、不動 stars（record.ts）
            const done = await recordLevelComplete(level.id, items, undefined, { unscored: level.unscored === true });
            useQuiz.getState().setPreviousBest(seed, done.previousStars);
            if (done.firstEver) void maybePersist('first-level-complete');
            // 章節徽章在完成關卡的這一刻寫進進度（03 第 2.10 節）：不等打開地圖，「我的 › 徽章」與匯出的備份馬上就有；地圖之後照樣顯示 Toast
            void import('../badges/award.ts').then(({ awardChapterBadges }) => awardChapterBadges(locale, { celebrate: true }));
          } catch (e) {
            // 進度資料庫暫停或寫不進去：結果頁照樣顯示，儲存層的提示由 storageStatus 負責
            void logError(...errorText(e));
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
    },
    [level.id, level.unscored, items, locale],
  );
  useEffect(() => (completed && seed !== undefined ? showResult(seed) : undefined), [completed, seed, showResult]);

  // 結果頁畫出來後焦點移到結果標題
  const resultShown = completed && completion !== null;
  useEffect(() => {
    if (resultShown) document.getElementById('ll-result-title')?.focus();
  }, [resultShown]);

  // 這一頁第一次繪製要的東西齊了沒（lib/page-ready.tsx）：工作階段（開始或從暫存還原）、名詞索引、還原的已確認作答重算完（回饋面板才畫得出來）、
  // 這一題的作答區；結果頁要等結果算好。載入失敗的畫面（LoadFailedBanner、LoadFailedState）也算齊了
  const resultReady = !completed || loadFailed || (completion !== null && completion.seed === session?.shuffleSeed);
  const questionReady = completed || loadFailed || (!needsRescore && !area.pending);
  const pageReady = session !== null && termsReady && resultReady && questionReady;
  usePageReady(pageReady);
  // 捲動位置依錨點還原：要等這一頁的內容齊了（pageReady）那一次排版才做，太早做頁面還太短、捲不到，布幕一掀開就會從頂端跳到還原的位置
  //（2026-10-26 CI 的 Linux WebKit：切換語言後先停在 6px，一個影格後才到 324px）
  useScrollAnchor(
    session !== null && !completed && pageReady,
    () => useQuiz.getState().getAnchor(),
    (anchor) => useQuiz.getState().setAnchor(anchor),
  );

  // 回饋期間預載下一題要的模組（四種題型的元件與核心資料）與報表卡片的名詞定義，換題時第一次渲染就完整
  const currentIndex = session?.currentIndex ?? -1;
  const currentId = session?.questionIds[currentIndex];
  const nextQ =
    session !== null && currentId !== undefined && quiz.results[currentId] !== undefined ? byId.get(session.questionIds[currentIndex + 1] ?? '') : undefined;
  useEffect(() => {
    if (nextQ === undefined) return;
    preloadQuestionModules(nextQ);
    if (nextQ.type === 'pick_statement')
      prefetchTermDetails([...statementTermIds(statementCodesOf(optionsOf(nextQ), statementNames), statementNames, terms).values()], locale);
  }, [nextQ, statementNames, terms, locale]);

  // 換題後焦點移到題幹；題目卡或整頁還沒顯示（visibility: hidden 的元素不能取得焦點）時等它出現再移
  useEffect(() => {
    if (currentIndex < 0 || completed || area.pending || !pageReady) return;
    let frame = 0;
    let tries = 0;
    const tryFocus = () => {
      const h = document.querySelector<HTMLElement>('.ll-question__prompt');
      if (!h || document.activeElement === h || document.activeElement?.closest('.ll-feedback')) return;
      h.focus({ preventScroll: true });
      // 整頁的布幕還沒掀開（PageReveal 在下一次重畫才把 data-ready 改成 true）：下一個影格再試，最多等約一秒
      if (document.activeElement !== h && tries++ < 60) frame = requestAnimationFrame(tryFocus);
    };
    tryFocus();
    return () => cancelAnimationFrame(frame);
  }, [currentIndex, completed, area.pending, pageReady]);

  // 收進圖鑑之後要重畫回饋面板（「新收進 N」與鍍金的 chip）；資料在模組層的 freshTermsByQuestion，切換語言重新掛載時照樣在
  const [, setFreshVersion] = useState(0);
  // 浮動提示區（15-quiz-session.css 的 .ll-float-toasts）現在只放「部分題目已更新」：常駐在 DOM，之後插入的提示讀得到
  const toastRegion = (
    <ToastRegion className="ll-float-toasts" data-testid="level-toasts">
      {revisedNotice && (
        <Toast kind="info" onDismiss={() => setRevisedNotice(false)}>
          {t({
            id: 'level.questionsUpdated',
            message: '部分題目已更新，請重新作答。',
            comment: '還原暫存時，有已作答的題目答案改版了，那幾題要重新作答（02 第 3 節第 7 點）',
          })}
        </Toast>
      )}
    </ToastRegion>
  );

  const backHref = localePath(locale, `/play/?from=${encodeURIComponent(level.id)}`);
  const hasNotes = notes.notInExam || notes.investment;
  // 頁首：TopBar compact（返回是圖示，可讀名稱「離開這一關，回到闖關地圖」；不跳確認，作答已暫存，站規 2.4.1）、關卡名稱、語言切換（窄時收成圖示）；
  // 下面一列是章節標示（延伸、非投資建議）。計時（倒數或「這一關計時」）在題目卡的題號列右側，不在頁首和題目之間另佔一列
  const header = () => (
    <div id="ll-level-head" data-ll-anchor data-ll-banner-after className="ll-level-head">
      <TopBar
        compact
        title={level.title}
        backHref={backHref}
        backLabel={t({ id: 'level.back', message: '離開這一關，回到闖關地圖', comment: '作答頁頁首返回圖示的可讀名稱（不跳確認，作答已暫存）' })}
        actions={<QuizLangSwitch />}
      />
      {hasNotes && (
        <div className="ll-level-strip">
          <p className="ll-level-notes" data-testid="level-notes">
            {notes.notInExam && <NoteTag kind="extension" />}
            {notes.investment && (
              <span className="ll-level-notes__advice" data-testid="level-not-advice">
                <Trans id="level.notInvestmentAdvice" comment="涉及投資（本益比、融資、估價）的延伸章，作答頁標題下的聲明（11 第 1 節）">
                  教學用途，不構成投資建議。
                </Trans>
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
  // 名詞資料載好才渲染題目（名詞 chip、科目卡與目標名稱都要用到），避免載入中途重新掛載題型元件。
  // 還沒好時只畫頁首（標題是 h1，換頁焦點有地方落）；整頁在 usePageReady 回報齊了之前不顯示，所以不需要占位
  // 提示區在每個分支都是外層 fragment 的第二個子節點：從第一次繪製就在 DOM，換到題目或結果頁也不重新掛載（live region 才讀得到之後插入的提示）
  const withToasts = (node: ReactNode) => (
    <>
      {node}
      {toastRegion}
    </>
  );

  if (session === null || !termsReady) return withToasts(header());

  // 判分模組載好之後才讀 store：連按兩次時第二次會看到已確認而直接返回。載不到時顯示 LoadFailedBanner，不會按了沒反應
  const onSubmit = async (q: QuestionSnapshot) => {
    let scoring: Awaited<ReturnType<typeof loadScoring>>;
    try {
      scoring = await loadScoring();
    } catch (e) {
      setLoadFailed(true);
      void logError(...errorText(e));
      return;
    }
    const { scoreSnapshotQuestion, recordAttempt } = scoring;
    setLoadFailed(false);
    const current = useQuiz.getState();
    const qs = current.session?.questions[q.id];
    if (current.key !== key || !qs || qs.confirmed || qs.answer === undefined) return;
    const { result, answer } = scoreSnapshotQuestion(q, qs.answer);
    setFreshConfirm(q.id);
    current.confirm(q.id, result);
    if (current.attemptIds[q.id] !== undefined) return;
    recordAttempt({ q, answer, result, source: 'play', levelId: level.id, durationMs: Date.now() - current.questionShownAt }).then(
      ({ attemptId, unlockedTerms }) => {
        useQuiz.getState().markAttempt(q.id, attemptId);
        if (unlockedTerms.length === 0) return;
        const seed = current.session?.shuffleSeed ?? '';
        const seen = newTermsBySeed.get(seed) ?? new Set<string>();
        for (const termId of unlockedTerms) seen.add(termId);
        if (current.session) newTermsBySeed.set(seed, seen);
        // 這一題的回饋面板：「相關名詞」小標旁「新收進 N」（role="status" 播報一次）、新收的 chip 整顆鍍金
        freshTermsByQuestion.set(`${seed}:${q.id}`, unlockedTerms);
        setFreshVersion((v) => v + 1);
      },
      // 寫不進去（資料庫暫停等）：記進錯誤紀錄，儲存層的提示由 storageStatus 負責
      (e: unknown) => void logError(...errorText(e)),
    );
  };

  // 「再試一次」：載入器失敗後已經放掉被拒絕的 Promise，重跑還原判分與結果頁；按「確認答案」的那條路由學生再按一次
  const retryLoad = () => {
    setLoadFailed(false);
    if (completed) showResult(session.shuffleSeed);
    else if (needsRescore) rescore();
  };

  const retry = () => {
    void useQuiz
      .getState()
      .clear()
      .then(() => {
        setCompletion(null);
        beginFresh();
      });
  };

  const loadFailedBanner = loadFailed ? <LoadFailedBanner onRetry={retryLoad} /> : null;

  if (completed) {
    // 結果還在算（判分與結果頁的模組早就預載，通常只差一個影格）：只畫頁首，整頁布幕等結果到了才掀開
    if (completion === null || completion.seed !== session.shuffleSeed) {
      return withToasts(
        <>
          {header()}
          {loadFailed && <LoadFailedState onRetry={retryLoad} />}
        </>,
      );
    }
    const wrongCount = session.questionIds.filter((id) => byId.get(id)?.scored && session.questions[id]?.correct === false).length;
    const bestStars = previousBest !== null && previousBest.seed === session.shuffleSeed ? previousBest.stars : undefined;
    const newTerms = newTermsBySeed.get(session.shuffleSeed)?.size ?? 0;
    return withToasts(
      <>
        {header()}
        <completion.View
          locale={locale}
          levelId={level.id}
          title={level.title}
          score={completion.score}
          wrongCount={wrongCount}
          onRetry={retry}
          unscored={level.unscored === true}
          {...(bestStars === undefined ? {} : { bestStars })}
          {...(session.timer.enabled && level.unscored !== true ? { timeUsedMs: quiz.timerUsedMs } : {})}
          {...(newTerms > 0 ? { newTerms } : {})}
        />
      </>,
    );
  }

  const qid = session.questionIds[session.currentIndex]!;
  const q = byId.get(qid);
  if (!q) return <NotFound />;
  const qs = session.questions[qid]!;
  // 收藏：依畫面上看到的狀態寫入目標值（清單還沒讀到時按下也不會把已收藏的題目取消）
  const favouriteProps = (shown: boolean) => ({ favourited: shown, onFavourite: () => favourites.set(q.id, !shown) });
  const result = quiz.results[qid];
  const guessed = quiz.guessed[qid] === true;
  const freshTerms = freshTermsByQuestion.get(`${session.shuffleSeed}:${qid}`);
  const mistakeState: 'added' | 'can_add' | 'none' = !q.scored || result === undefined ? 'none' : result.correct ? (guessed ? 'added' : 'can_add') : 'added';
  const promptText = (q.type === 'true_false' ? (q['prompt'] as string | undefined) : (q['prompt'] as string)) ?? '';
  const timerProps =
    level.unscored === true
      ? null
      : timerDisplayProps(session.timer, () => {
          const s = useQuiz.getState();
          if (s.session?.timer.paused) s.resume();
          else s.pause();
        });
  // 「這一關計時」只在關卡一開始（第一題還沒確認）、全站沒開計時、計分的關卡出現
  const canEnableTimer =
    timerProps === null &&
    level.unscored !== true &&
    scoredCount > 0 &&
    session.currentIndex === 0 &&
    !session.questionIds.some((id) => session.questions[id]?.confirmed);
  // 題號列右側：計時中是倒數與暫停，還沒開計時（第一題、計分關）是 secondary sm「這一關計時」
  const timerMeta =
    timerProps !== null ? (
      <TimerDisplay {...timerProps} silent={announce !== true} />
    ) : canEnableTimer ? (
      <Button size="sm" icon={<TimerIcon />} onClick={enableTimerOnce} data-testid="timer-once">
        <Trans id="level.timer.once" comment="作答頁開頭單次開啟計時的按鈕（不改設定頁的預設，03 第 2.10 節）">
          這一關計時
        </Trans>
      </Button>
    ) : undefined;
  return withToasts(
    <>
      {header()}
      {loadFailedBanner}
      {/* 作答區還沒齊（模組或資料還沒到）時整張題目卡先不顯示，齊了再淡入（15-quiz-session.css）；第一題由整頁的布幕負責 */}
      <div id={`ll-q-${qid}`} data-ll-anchor className="ll-question-wrap" data-ready={area.pending ? 'false' : 'true'}>
        {/* 題幹、選項、回饋與解說共用這一題自己的詞（中文依詞換行的 keep 清單，Markup.tsx） */}
        <PendingContext.Provider value={area.registry}>
          <>
            <QuestionCard
              index={session.currentIndex + 1}
              total={session.questionIds.length}
              prompt={
                promptText === '' ? (
                  t({ id: 'quiz.tf.prompt', message: '下面這句話對不對？', comment: '是非題沒有題幹時的標題' })
                ) : (
                  <Markup text={promptText} ctx={valueContextOf(q)} plainTerms />
                )
              }
              {...(timerMeta === undefined ? {} : { meta: timerMeta })}
              checked={qs.confirmed}
              canSubmit={canSubmit(q, qs.answer)}
              onSubmit={() => void onSubmit(q)}
              {...(q.type === 'classify' ? { submitLabel: t({ id: 'quiz.submit.classify', message: '確認分類', comment: '分類題的送出按鈕' }) } : {})}
              feedback={
                result === undefined ? undefined : (
                  <div id={`ll-fb-${qid}`} data-ll-anchor>
                    <FeedbackView
                      q={q}
                      result={result}
                      mistakeState={mistakeState}
                      onAddMistake={() => {
                        useQuiz.getState().markGuessed(qid);
                        void loadScoring().then(({ recordGuessed }) => recordGuessed(q));
                      }}
                      onNext={() => useQuiz.getState().next()}
                      scrollOnMount={freshConfirm === qid}
                      {...(freshTerms === undefined ? {} : { newTermIds: freshTerms })}
                      {...(canFavourite(q) ? favouriteProps(isFavourite(favourites.list ?? [], q.id)) : {})}
                    />
                  </div>
                )
              }
            >
              {({ promptId }) => (
                <QuestionView
                  q={q}
                  answer={qs.answer as JsonValue | undefined}
                  checked={qs.confirmed}
                  {...(result === undefined ? {} : { result })}
                  shuffleSeed={session.shuffleSeed}
                  promptId={promptId}
                  onChange={(answer, rawInput) => useQuiz.getState().select(qid, answer, rawInput)}
                />
              )}
            </QuestionCard>
          </>
        </PendingContext.Provider>
      </div>
    </>,
  );
}
