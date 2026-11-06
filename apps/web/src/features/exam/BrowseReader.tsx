// 背題瀏覽的閱讀頁（2026-11-06）：一次一題（HandoutQuestionReadout），底部固定一列：上一題、主要按鈕、下一題。
// 只有主要按鈕「讀完了，下一題」會把這一題記成已讀；左右兩顆只是翻頁，翻過去不算讀完。已讀的題可以在最上面「改回未讀」。
// 範圍的最後一題按下「讀完了」後換成結束卡。頁面以題目 ID 當 key 重掛，所以「看答案」與結束卡的狀態每一題都從頭開始。
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { formatNumber } from '@ledgerland/i18n';
import { ArrowRightIcon, Badge, Button, Card, CaretLeftIcon, CaretRightIcon, CheckIcon, IconButton, PlayIcon, ProgressBar, Switch } from '@ledgerland/web-ui';
import type { HandoutQuestionSnapshot } from '../../lib/content.ts';
import { useLocale } from '../../lib/useLocale.ts';
import { HandoutQuestionReadout } from './HandoutQuestionReadout.tsx';

export interface BrowseReaderProps {
  q: HandoutQuestionSnapshot;
  deckCode: string;
  sectionTitle: string;
  /** 這一題在範圍裡是第幾題（從 1 起算）與範圍的總題數 */
  position: number;
  total: number;
  /** 範圍裡已讀的題數（結束卡用） */
  readCount: number;
  isRead: boolean;
  hide: boolean;
  onHide: (on: boolean) => void;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onRead: () => void;
  onUnread: () => void;
  listHref: string;
  /** 範圍是一份講義時的編號；全部時是 null */
  scopeDeckCode: string | null;
  /** 範圍是一份講義而且後面還有一份時：下一份的編號與清單網址 */
  nextDeck: { code: string; href: string } | null;
  practiseHref: string;
}

export function BrowseReader({
  q,
  deckCode,
  sectionTitle,
  position,
  total,
  readCount,
  isRead,
  hide,
  onHide,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onRead,
  onUnread,
  listHref,
  scopeDeckCode,
  nextDeck,
  practiseHref,
}: BrowseReaderProps) {
  const { t } = useLingui();
  const locale = useLocale();
  const n = (x: number) => formatNumber(x, locale);
  const [revealed, setRevealed] = useState(false);
  const [ended, setEnded] = useState(false);

  // 換了一題（或換成結束卡）：回到頁面最上面，焦點移到標題
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById(ended ? 'll-exam-reader-end' : 'll-exam-reader-title')?.focus({ preventScroll: true });
  }, [ended]);

  const deck = { code: deckCode };
  const a = n(readCount);
  const b = n(total);
  const countText = t({ id: 'exam.browse.count', message: `已讀 ${a}／${b} 題`, comment: '背題瀏覽：某個範圍讀完幾題；數字已格式化' });
  const listLabel = t({ id: 'exam.browse.toList', message: '回清單', comment: '背題瀏覽的閱讀頁：回到題目清單' });

  if (ended) {
    const scopeCode = scopeDeckCode ?? '';
    const nextCode = nextDeck?.code ?? '';
    return (
      <Card as="section" className="ll-exam-hero" aria-labelledby="ll-exam-reader-end" data-testid="exam-reader-end">
        <h2 id="ll-exam-reader-end" className="ll-exam-hero__title" tabIndex={-1}>
          {readCount < total
            ? t({ id: 'exam.browse.end.partial', message: '讀到最後一題了', comment: '背題瀏覽的結束卡：到了範圍的最後一題，但還有題沒讀' })
            : scopeDeckCode !== null
              ? t({ id: 'exam.browse.done.deck', message: `講義 ${scopeCode} 都讀完了`, comment: '背題瀏覽：一份講義全部已讀' })
              : t({ id: 'exam.browse.done.all', message: '全部都讀完了', comment: '背題瀏覽：全部題目已讀' })}
        </h2>
        <div className="ll-exam-hero__progress">
          <ProgressBar size="md" value={readCount} max={total || 1} />
          <span className="ll-exam-hero__count ll-num">{countText}</span>
        </div>
        <div className="ll-exam-hero__actions">
          <Button variant="primary" size="md" href={listHref} data-testid="exam-reader-end-list">
            {listLabel}
          </Button>
          {nextDeck && (
            <Button size="md" iconEnd={<ArrowRightIcon />} href={nextDeck.href}>
              {t({ id: 'exam.browse.end.next', message: `接著讀講義 ${nextCode}`, comment: '背題瀏覽的結束卡：去下一份講義的清單；nextCode 是講義編號' })}
            </Button>
          )}
          <Button size="md" icon={<PlayIcon />} href={practiseHref}>
            {t({ id: 'exam.browse.done.practise', message: '去練習', comment: '背題瀏覽：都讀完之後，去作答練習' })}
          </Button>
        </div>
      </Card>
    );
  }

  const hidden = hide && !revealed;
  const at = n(position);
  const prevLabel = t({ id: 'exam.browse.prev', message: '上一題', comment: '背題瀏覽的閱讀頁：只翻頁，不記已讀' });
  const nextLabel = t({ id: 'exam.browse.next', message: '下一題', comment: '背題瀏覽的閱讀頁：只翻頁，不記已讀' });
  return (
    <>
      <article className="ll-exam-reader" aria-labelledby="ll-exam-reader-title" data-testid="exam-reader" data-question={q.id}>
        <p className="ll-exam-reader__pos">
          <span className="ll-num" data-testid="exam-reader-pos">
            {t({ id: 'exam.browse.pos', message: `第 ${at}／${b} 題`, comment: '背題瀏覽的閱讀頁：這一題在目前範圍裡的位置；數字已格式化' })}
          </span>
          {isRead && (
            <>
              <Badge kind="success">{t({ id: 'exam.browse.isRead', message: '已讀', comment: '背題瀏覽的閱讀頁：這一題已經標成讀完' })}</Badge>
              <Button size="sm" variant="quiet" onClick={onUnread} data-testid="exam-reader-unread">
                {t({ id: 'exam.browse.unread', message: '改回未讀', comment: '背題瀏覽的閱讀頁：把這一題的已讀拿掉' })}
              </Button>
            </>
          )}
        </p>
        <HandoutQuestionReadout
          q={q}
          heading="h2"
          headingId="ll-exam-reader-title"
          headingFocusable
          hideAnswer={hidden}
          source={
            <>
              <span className="ll-num">{t({ id: 'exam.deck.code', message: `講義 ${deck.code}` })}</span>
              <span lang="zh-TW">{sectionTitle}</span>
              <span className="ll-num">{t({ id: 'exam.q.slide', message: `第 ${n(q.slide)} 頁` })}</span>
            </>
          }
        >
          {hide && (
            <div className="ll-exam-browse__reveal">
              <Button size="sm" onClick={() => setRevealed((v) => !v)} aria-expanded={!hidden} data-testid="exam-reader-reveal">
                {hidden
                  ? t({ id: 'exam.browse.reveal', message: '看答案', comment: '背題瀏覽頁：答案遮住時，只掀開這一題' })
                  : t({ id: 'exam.browse.cover', message: '遮回去', comment: '背題瀏覽頁：把這一題的答案再遮起來' })}
              </Button>
            </div>
          )}
        </HandoutQuestionReadout>
        <Switch
          className="ll-exam-reader__hide"
          checked={hide}
          onChange={(on) => {
            setRevealed(false);
            onHide(on);
          }}
          label={t({ id: 'exam.browse.hide', message: '遮住答案與解析', comment: '背題瀏覽頁工具列的開關' })}
        />
      </article>
      <div className="ll-exam-readbar" data-testid="exam-readbar">
        <div className="ll-exam-readbar__row">
          <IconButton icon={<CaretLeftIcon />} label={prevLabel} disabled={!hasPrev} onClick={onPrev} data-testid="exam-reader-prev" />
          {!isRead ? (
            <Button
              variant="primary"
              size="md"
              block
              icon={<CheckIcon />}
              onClick={() => {
                onRead();
                if (hasNext) onNext();
                else setEnded(true);
              }}
              data-testid="exam-reader-done"
            >
              {hasNext
                ? t({ id: 'exam.browse.done', message: '讀完了，下一題', comment: '背題瀏覽的閱讀頁：把這一題記成已讀，並到下一題' })
                : t({ id: 'exam.browse.doneLast', message: '讀完了', comment: '背題瀏覽的閱讀頁：範圍的最後一題，記成已讀' })}
            </Button>
          ) : hasNext ? (
            <Button variant="primary" size="md" block iconEnd={<ArrowRightIcon />} onClick={onNext} data-testid="exam-reader-done">
              {nextLabel}
            </Button>
          ) : (
            <Button variant="primary" size="md" block href={listHref} data-testid="exam-reader-done">
              {listLabel}
            </Button>
          )}
          <IconButton icon={<CaretRightIcon />} label={nextLabel} disabled={!hasNext} onClick={onNext} data-testid="exam-reader-next" />
        </div>
      </div>
    </>
  );
}
