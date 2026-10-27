// 「我的」頁的收藏區（站規 2.12、03 第 2.7 節）：每題一張 NavCard（包在自己的 li 裡，li 帶 data-question-id 給 E2E 找）：標題是所屬關卡名、
// 說明是關卡代號的 Badge 加題目摘錄（最多兩行）；圖示欄是和作答頁「收藏」按鈕同一個圖示（第 2 輪看圖驗收：代號塞在 36px 的圖示欄裡，
// 文字放大 200% 時超出方塊、貼到標題），用實心的愛心（第 4 輪看圖驗收：這些題目都已經收藏，作答頁按下「收藏」後也是實心；空心讀起來像「未收藏」），移除鈕是連結外側的 IconButton（可讀名稱帶題目摘錄）。600 以下卡片不畫箭頭（NavCard 的 chevron="wide"），文字欄用到整列寬。
// 區塊標題和「學習」「這台裝置」同一種小標（footnote 600），右邊是題數的 Badge。
// 摘錄（me.css 的 .ll-favourites__desc，最多兩行）：代號 Badge 和摘錄的第一個字在同一行。第 9 輪起依詞換行（375 原本斷成「申請一／筆」「如／果」），
// （「股東會上有人想分股利」），排不進第二行時第二行只剩幾個字就截斷（第 5 輪看圖驗收）。
// 卡片標題（關卡名）、已下架的說明與空清單的說明是完整顯示的短句，照全站規則逐字換行（07 第 3.5 節）。
// 題目已下架時是不可點的卡（同版面、沒有箭頭），說明「這一關已下架」，一樣可以移除。
// 移除後焦點移到同一位置的下一張（沒有就上一張，都沒有就回到區塊標題），並由常駐的 role=status 播報（finding pages-a-2）。
// 只在「我的」頁以 lazy 載入；名稱與摘錄從已 precache 的快照取。一掛載就讀（維護者 2026-10-26：整頁資料齊了才一次出現），讀到後經 onCount 回報題數，
// 「我的」把它算進 usePageReady 的條件；在那之前這一區什麼都不畫（整頁本來就還看不見）。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatNumber, localePath, type Locale } from '@ledgerland/i18n';
import { Badge, Button, HeartIcon, IconButton, NavCard, TrashIcon } from '@ledgerland/web-ui';
import { MapIcon } from '@ledgerland/web-ui/map';
import { loadManifest, loadQuestion, loadTermIndex, type QuestionSnapshot } from '../../lib/content.ts';
import { levelPosition, numberChapters } from '../glossary/unlocks.ts';
import { useLevelCodeFormatter } from '../home/codes.ts';
import { listFavourites, removeFavourite } from './favourites.ts';
import { renderPlain, valueContextOf } from './placeholders.ts';
import '../../styles/me.css';

interface FavouriteItem {
  readonly questionId: string;
  readonly levelId?: string;
  readonly levelTitle?: string;
  readonly excerpt?: string;
  /** 關卡的章序與關序（短代號「1-2」用）；章節清單裡找不到時沒有 */
  readonly position?: { readonly chapterNo: number; readonly levelNo: number; readonly extension: boolean };
}

const EXCERPT_LENGTH = 60;
/** 移除鈕的可讀名稱只帶摘錄的前幾個字（站規 2.12） */
const LABEL_EXCERPT = 12;

function excerptOf(q: QuestionSnapshot, locale: Locale, termLabel: (id: string) => string | undefined): string {
  const prompt = typeof q['prompt'] === 'string' ? q['prompt'] : '';
  const plain = renderPlain(prompt, valueContextOf(q), locale, { term: termLabel, option: () => '' })
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > EXCERPT_LENGTH ? `${plain.slice(0, EXCERPT_LENGTH)}…` : plain;
}

export async function loadFavouriteItems(locale: Locale): Promise<FavouriteItem[]> {
  const ids = await listFavourites();
  if (ids.length === 0) return [];
  const [terms, chapters] = await Promise.all([
    loadTermIndex(locale).catch(() => []),
    loadManifest()
      .then((m) => numberChapters(m.chapters))
      .catch(() => []),
  ]);
  const labelOf = (id: string) => terms.find((t) => t.id === id)?.label;
  return Promise.all(
    ids.map(async (questionId): Promise<FavouriteItem> => {
      const found = await loadQuestion(questionId, locale).catch(() => undefined);
      if (!found) return { questionId };
      const pos = levelPosition(chapters, found.level.chapterId, found.level.id);
      return {
        questionId,
        levelId: found.level.id,
        levelTitle: found.level.title,
        excerpt: excerptOf(found.question, locale, labelOf),
        ...(pos?.levelNo === undefined ? {} : { position: { chapterNo: pos.chapterNo, levelNo: pos.levelNo, extension: pos.extension } }),
      };
    }),
  );
}

export interface FavouritesSectionProps {
  locale: Locale;
  /** 區塊標題的 id（「我的」學習群組的「收藏的題目」列捲到這裡並把焦點移過來） */
  headingId?: string;
  /** 收藏數（讀到與每次移除後回報，給「我的」學習群組的列顯示） */
  onCount?: (n: number) => void;
}

export default function FavouritesSection({ locale, headingId = 'll-favourites-title', onCount }: FavouritesSectionProps) {
  const { t } = useLingui();
  const code = useLevelCodeFormatter();
  const [items, setItems] = useState<FavouriteItem[] | null>(null);
  const [announce, setAnnounce] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadFavouriteItems(locale).then(
      (list) => alive && setItems(list),
      () => alive && setItems([]),
    );
    return () => {
      alive = false;
    };
  }, [locale]);

  useEffect(() => {
    if (items !== null) onCount?.(items.length);
  }, [items, onCount]);

  // 移除後把焦點移到下一張的移除鈕（同一位置；沒有就上一張；清單空了回到標題），不讓焦點掉到 body。
  // 每次 commit 之後都檢查（沒有待移的焦點時立刻結束）：被移除的那張卸載的同一個 commit 就要移，不能等下一次繪製
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    (target === '' ? heading.current : removeButtons.current.get(target))?.focus();
  });

  const retiredName = t({ id: 'favourites.retired', message: '這題已下架', comment: '收藏的題目已不在任何關卡' });
  const nameOf = (item: FavouriteItem) => item.levelTitle ?? retiredName;
  const shortExcerpt = (item: FavouriteItem) => {
    const text = item.excerpt ?? '';
    return text.length > LABEL_EXCERPT ? `${text.slice(0, LABEL_EXCERPT)}…` : text || nameOf(item);
  };

  const remove = async (item: FavouriteItem) => {
    if (items === null) return;
    const i = items.findIndex((x) => x.questionId === item.questionId);
    const rest = items.filter((x) => x.questionId !== item.questionId);
    pendingFocus.current = rest[i]?.questionId ?? rest[i - 1]?.questionId ?? '';
    setItems(rest);
    const name = nameOf(item);
    setAnnounce(
      t({ id: 'favourites.removed', message: `已移除收藏：${name}`, comment: '從收藏清單移除後的播報；name 是關卡名，題目已下架時是「這題已下架」' }),
    );
    await removeFavourite(item.questionId).catch(() => {});
  };

  return (
    <section className="ll-favourites" aria-labelledby={headingId} data-testid="favourites">
      <h2 id={headingId} ref={heading} tabIndex={-1} className="ll-favourites__title">
        <Trans id="favourites.heading" comment="「我的」頁收藏區的標題">
          收藏的題目
        </Trans>
        {items !== null && items.length > 0 && (
          <>
            {' '}
            <Badge className="ll-favourites__count">
              <span className="ll-num">{formatNumber(items.length, locale)}</span>
            </Badge>
          </>
        )}
      </h2>
      <p className="ll-sr-only" role="status">
        {announce}
      </p>
      {items !== null && items.length === 0 && (
        <div className="ll-favourites__empty" data-testid="favourites-empty">
          <p className="ll-favourites__empty-text">
            <Trans id="favourites.empty" comment="收藏清單是空的">
              還沒有收藏。作答取捨題時按「收藏」，就會放在這裡。
            </Trans>
          </p>
          <Button size="sm" icon={<MapIcon />} href={localePath(locale, '/play/')}>
            <Trans id="favourites.goMap" comment="收藏清單是空的時候的按鈕：去闖關地圖（和錯題本空狀態、找不到頁面的「去闖關地圖」同一種說法）">
              去闖關地圖
            </Trans>
          </Button>
        </div>
      )}
      {items !== null && items.length > 0 && (
        <ul className="ll-favourites__list" aria-label={t({ id: 'favourites.listLabel', message: '收藏的題目清單', comment: '收藏卡片清單的可讀名稱' })}>
          {items.map((item) => {
            const pos = item.position;
            const retired = item.levelId === undefined;
            const excerpt = shortExcerpt(item);
            const removeLabel = t({
              id: 'favourite.remove',
              message: `移除收藏：${excerpt}`,
              comment: '收藏卡移除按鈕的可讀名稱；後面是題目摘錄的前 12 個字（題目已下架時是「這題已下架」）',
            });
            return (
              <li key={item.questionId} className="ll-favourites__item" data-question-id={item.questionId}>
                <NavCard
                  as="div"
                  chevron="wide"
                  icon={<HeartIcon filled />}
                  title={<span className="ll-favourites__name">{nameOf(item)}</span>}
                  description={
                    retired ? (
                      t({ id: 'favourites.retiredLevel', message: '這一關已下架，可以移除這筆收藏。', comment: '已下架的收藏卡的說明' })
                    ) : (
                      <span className="ll-favourites__desc">
                        {pos && (
                          <>
                            <Badge className="ll-favourites__code">{code(pos.chapterNo, pos.levelNo, pos.extension)}</Badge>{' '}
                          </>
                        )}
                        <span className="ll-favourites__excerpt">{item.excerpt}</span>
                      </span>
                    )
                  }
                  href={retired ? undefined : localePath(locale, `/level/${item.levelId}/`)}
                  aside={
                    <IconButton
                      icon={<TrashIcon />}
                      label={removeLabel}
                      onClick={() => void remove(item)}
                      ref={(el: HTMLButtonElement | null) => {
                        if (el) removeButtons.current.set(item.questionId, el);
                        else removeButtons.current.delete(item.questionId);
                      }}
                      data-testid="favourite-remove"
                    />
                  }
                  data-testid={`favourite-${item.questionId}`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
