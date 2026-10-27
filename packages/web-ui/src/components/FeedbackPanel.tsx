// 回饋面板（03 第 2.9 節、07 第 8.3 節、站規 2.4.1）：上方是帶結果色的標題區（圖示、答對了／再想想、摘要），下方依序是你的答案與正解、解說、
// 逐選項說明（其他選項收在 Disclosure plain）、「相關名詞」chip、工具列（已放進錯題本、我是猜的、收藏切換、看動畫，按鈕都是 secondary sm）、「下一題」primary lg。
// 工具列的按鈕和狀態分得出來（M3 驗收第 4 輪）：「我是猜的，加入錯題本」與「收藏」是有外框與立體底邊的 secondary sm（quiet 靜止時只有圖示加字，
// 看起來像一行沒設計的文字）；「已放進錯題本」是平的 danger Badge（28px 高、實心書籤），放在常駐的 role="status" 裡，按下「我是猜的」換成它時會播報。
// 按「確認答案」後焦點移到這裡的標題（tabindex="-1"），不另用 aria-live；標題前有圖示加文字，不只靠顏色（16 第 4.3 節）。
// 剛按下確認時（scrollOnMount）把面板捲到畫面上緣（減少動態時直接跳過去）；還原暫存、切換語言重新掛載時不捲，照樣只移焦點。
// 「下一題」在面板底部的 sticky 動作列（04-quiz-types.css），長的回饋不必捲到最後才按得到：手機是工具列下面的一顆 block 按鈕；
// 600px 以上工具列（「我是猜的」或「已放進錯題本」）和「下一題」同一列，左右分開（M3 驗收第 2 輪）。
// 這一題剛收進圖鑑的名詞（newTerms）不再用浮動提示：「相關名詞」小標旁一個星星色的 Badge「新收進 N」（role="status"，非同步寫進進度後才出現時會播報），
// 新收的名詞 chip 整顆鍍金、最前面是金色勾章（TermChip 的 isNew），Badge 前面也是同一枚勾章。
// 取捨題用中性標題「解說觀點」。判分在父層：這裡只收結果與各段內容。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { formatNumber } from '@ledgerland/i18n';
import { Badge } from './Badge.tsx';
import { Button } from './Button.tsx';
import { Disclosure } from './Disclosure.tsx';
import { BookmarkIcon, ChatIcon, CheckCircleIcon, CheckIcon, FlaskIcon, HeartIcon, XCircleIcon } from './icons.tsx';
import { useUiLocale } from './NumberInput.tsx';

export type FeedbackOutcome = 'correct' | 'wrong' | 'neutral';

export interface FeedbackOptionNote {
  id: string;
  text: ReactNode;
  feedback: ReactNode;
  /** 你選的選項一定展開 */
  chosen: boolean;
}

export interface FeedbackPanelProps {
  /** 舊介面：true 答對、false 答錯；與 outcome 二選一 */
  correct?: boolean;
  /** correct 答對、wrong 答錯、neutral 取捨題的「解說觀點」 */
  outcome?: FeedbackOutcome;
  /** 結果列下方的第一句摘要（例如「你選對了其中兩個，還有一個正確答案沒選到。」） */
  summary?: ReactNode;
  /** 多正解題：答對時加「這題的其他合理答案也標出來了。」；答錯時加 all_correct 的規則說明 */
  multi?: 'any_correct' | 'all_correct';
  /** 你的答案與正解（計算型題目的算式等） */
  answer?: ReactNode;
  /** 解說（父層已把 {{option:…}} 等佔位符代入） */
  explanation?: ReactNode;
  /** 逐選項說明；你選的展開，其他收在「看其他選項為什麼不對」，expandAllOptions 時全部展開（multi_choice） */
  options?: readonly FeedbackOptionNote[];
  expandAllOptions?: boolean;
  /** 名詞卡 chip 插槽 */
  terms?: ReactNode;
  /** 這一題剛收進圖鑑的名詞數：大於 0 時「相關名詞」小標旁顯示「新收進 N」（寫進進度之後才知道，可能晚一點才給） */
  newTerms?: number;
  /** 「看動畫」：M5 才顯示，由 showAnimation 控制 */
  showAnimation?: boolean;
  onShowAnimation?: () => void;
  /** 錯題本狀態：added 顯示「已放進錯題本」、can_add 顯示「我是猜的，加入錯題本」按鈕 */
  mistakeState?: 'added' | 'can_add' | 'none';
  onAddMistake?: () => void;
  onNext?: () => void;
  /** 取捨題的「收藏」：給了就顯示切換按鈕（aria-pressed）；持久化由父層負責（03 第 2.7 節） */
  onFavourite?: () => void;
  favourited?: boolean;
  children?: ReactNode;
  /** 顯示時把焦點移到標題（預設 true） */
  focusOnMount?: boolean;
  /** 剛按下「確認答案」：顯示時把面板捲到畫面上緣（還原或重新掛載時不要給） */
  scrollOnMount?: boolean;
  className?: string;
}

export function FeedbackPanel({
  correct,
  outcome,
  summary,
  multi,
  answer,
  explanation,
  options,
  expandAllOptions,
  terms,
  newTerms = 0,
  showAnimation,
  onShowAnimation,
  mistakeState = 'none',
  onAddMistake,
  onNext,
  onFavourite,
  favourited = false,
  children,
  focusOnMount = true,
  scrollOnMount = false,
  className,
}: FeedbackPanelProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const summaryId = useId();
  const { t } = useLingui();
  const locale = useUiLocale();
  const kind: FeedbackOutcome = outcome ?? (correct ? 'correct' : 'wrong');
  // 只在掛載時做一次（之後 props 改變不再搶焦點或捲動）
  useEffect(() => {
    if (focusOnMount) ref.current?.focus(scrollOnMount ? { preventScroll: true } : undefined);
    if (scrollOnMount) sectionRef.current?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const chosen = options?.filter((o) => o.chosen) ?? [];
  const others = options?.filter((o) => !o.chosen) ?? [];
  const renderOption = (o: FeedbackOptionNote) => (
    <li key={o.id} className={`ll-feedback__option${o.chosen ? ' is-chosen' : ''}`}>
      <span className="ll-feedback__option-text">{o.text}</span>
      <span className="ll-feedback__option-note">{o.feedback}</span>
    </li>
  );
  const canAddMistake = mistakeState === 'can_add' && onAddMistake !== undefined;
  const hasFootActions = Boolean((showAnimation && onShowAnimation) || onFavourite || mistakeState === 'added' || canAddMistake);
  // 錯題本狀態、我是猜的、收藏、看動畫（都在主按鈕「下一題」之前）
  const footTools = hasFootActions ? (
    <div className="ll-feedback__tools">
      {(mistakeState === 'added' || canAddMistake) && (
        // 常駐的狀態區：答對時是空的（視覺上不占位置），按下「我是猜的」後插進 Badge，螢幕閱讀器播報一次
        <span role="status" className="ll-feedback__mistake">
          {mistakeState === 'added' && (
            <Badge kind="danger" className="ll-feedback__mistake-badge">
              <BookmarkIcon filled size={16} />
              {t({ id: 'quiz.feedback.mistakeAdded', message: '已放進錯題本', comment: '答錯時的錯題本狀態' })}
            </Badge>
          )}
        </span>
      )}
      {canAddMistake && (
        <Button size="sm" icon={<BookmarkIcon />} onClick={onAddMistake}>
          <Trans
            id="quiz.feedback.addMistakeGuess"
            comment="答對時可自行加入錯題本的小按鈕。譯文要短：320 寬的回饋區一行只放得下約 160px 的標籤（英文 15px 粗體約 20 個字元）"
          >
            我是猜的，加入錯題本
          </Trans>
        </Button>
      )}
      {onFavourite && (
        // 切換按鈕：文字固定是「收藏」，狀態由 aria-pressed、實心愛心與按下外觀表示（站規 2.4.1；星星只代表關卡成績）
        <Button size="sm" pressed={favourited} icon={<HeartIcon filled={favourited} />} onClick={onFavourite} className="ll-feedback__favourite">
          <Trans id="quiz.feedback.favourite" comment="取捨題「收藏」切換按鈕（按下時 aria-pressed），放進「我的」頁的收藏清單">
            收藏
          </Trans>
        </Button>
      )}
      {showAnimation && onShowAnimation && (
        <Button size="sm" icon={<FlaskIcon />} onClick={onShowAnimation}>
          <Trans id="quiz.feedback.showAnimation" comment="題目有 labRef 時開啟實驗室動畫的按鈕（M5）">
            看動畫
          </Trans>
        </Button>
      )}
    </div>
  ) : null;
  const count = formatNumber(newTerms, locale);
  const newTermsText =
    newTerms > 0
      ? t({
          id: 'quiz.feedback.newTerms',
          message: `新收進 ${count}`,
          comment: '回饋區「相關名詞」小標旁的星星色標籤：這一題剛收進圖鑑的名詞個數；count 是已格式化的個數',
        })
      : null;
  return (
    <section
      ref={sectionRef}
      className={`ll-feedback ll-feedback--${kind === 'correct' ? 'ok' : kind === 'wrong' ? 'no' : 'neutral'}${className ? ` ${className}` : ''}`}
    >
      <div className="ll-feedback__head">
        <h2 ref={ref} tabIndex={-1} className="ll-feedback__title" aria-describedby={summary ? summaryId : undefined}>
          <span className="ll-feedback__icon" aria-hidden="true">
            {kind === 'correct' ? <CheckCircleIcon filled /> : kind === 'wrong' ? <XCircleIcon /> : <ChatIcon />}
          </span>
          {kind === 'correct' ? (
            <Trans id="quiz.feedback.correct" comment="答對時的回饋標題">
              答對了！
            </Trans>
          ) : kind === 'wrong' ? (
            <Trans id="quiz.feedback.wrong" comment="答錯時的回饋標題">
              再想想
            </Trans>
          ) : (
            <Trans id="quiz.feedback.viewpoint" comment="取捨題（不計分）的中性回饋標題">
              解說觀點
            </Trans>
          )}
        </h2>
        {summary && (
          <p id={summaryId} className="ll-feedback__summary">
            {summary}
          </p>
        )}
        {multi === 'any_correct' && kind === 'correct' && (
          <p className="ll-feedback__summary">
            <Trans id="quiz.multi.result.anyCorrectNote" comment="any_correct 答對時的加註">
              這題的其他合理答案也標出來了。
            </Trans>
          </p>
        )}
        {multi === 'all_correct' && kind === 'wrong' && (
          <p className="ll-feedback__summary">
            <Trans id="quiz.multi.result.allCorrectRule" comment="all_correct 答錯時的結果說明；不可加入正確答案的數量">
              要選出所有正確答案，而且沒有選到錯誤的選項，才算答對。
            </Trans>
          </p>
        )}
      </div>
      <div className="ll-feedback__main">
        {answer && (
          <div className="ll-feedback__section">
            <h3 className="ll-feedback__h">
              <Trans id="quiz.feedback.answer" comment="回饋區「你的答案與正解」段落標題">
                你的答案與正解
              </Trans>
            </h3>
            {answer}
          </div>
        )}
        {explanation && (
          <div className="ll-feedback__section">
            <h3 className="ll-feedback__h">
              <Trans id="quiz.feedback.explanation" comment="回饋區「解說」段落標題">
                解說
              </Trans>
            </h3>
            <div className="ll-feedback__explanation">{explanation}</div>
          </div>
        )}
        {options && options.length > 0 && (
          <div className="ll-feedback__section">
            <ul className="ll-feedback__options">{(expandAllOptions ? options : chosen).map(renderOption)}</ul>
            {!expandAllOptions && others.length > 0 && (
              // 標題回到欄的左緣（M3 驗收第 7 輪）：整個展開列往左右各伸 8px、summary 與內容的左右內距改 8px（15-quiz-session.css）
              <Disclosure
                variant="plain"
                className="ll-feedback__others"
                summaryClassName="ll-feedback__inset"
                bodyClassName="ll-feedback__inset"
                summary={
                  <Trans id="quiz.feedback.otherOptions" comment="回饋區收合其他選項說明的展開鈕">
                    看其他選項為什麼不對
                  </Trans>
                }
              >
                <ul className="ll-feedback__options">{others.map(renderOption)}</ul>
              </Disclosure>
            )}
          </div>
        )}
        {children}
        {terms && (
          <div className="ll-feedback__section ll-feedback__terms-section">
            <div className="ll-feedback__terms-head">
              <h3 className="ll-feedback__h">
                <Trans id="quiz.feedback.terms" comment="回饋區名詞卡 chip 的小標">
                  相關名詞
                </Trans>
              </h3>
              {/* 常駐的 live region：收進名詞是寫進進度之後才知道，Badge 晚一點插進來時播報一次 */}
              <span role="status" className="ll-feedback__terms-status">
                {newTermsText !== null && <NewTermsBadge text={newTermsText} />}
              </span>
            </div>
            <div className="ll-feedback__terms">{terms}</div>
          </div>
        )}
        {(hasFootActions || onNext) && (
          // 工具列與「下一題」：手機是兩列（display: contents，「下一題」照樣 sticky），600px 以上同一列（04-quiz-types.css）
          <div className="ll-feedback__actions">
            {footTools}
            {onNext && (
              <div className="ll-question__actions ll-feedback__next">
                <Button variant="primary" size="lg" onClick={onNext}>
                  <Trans id="quiz.next" comment="回饋之後前往下一題">
                    下一題
                  </Trans>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** 「新收進 N」：收集類的 Badge（kind="star"），前面一枚和新收名詞 chip 上同樣的金色勾章（.ll-stamp--inline） */
function NewTermsBadge({ text }: { text: string }) {
  return (
    <Badge kind="star" className="ll-feedback__new">
      <span className="ll-stamp ll-stamp--inline" aria-hidden="true">
        <CheckIcon size={10} strokeWidth={3} />
      </span>
      {text}
    </Badge>
  );
}

/** 系統的減少動態，或設定頁選了「減少動態」（boot 腳本寫在 html 的 data-motion） */
function prefersReducedMotion(): boolean {
  if (document.documentElement.dataset.motion === 'reduced') return true;
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
