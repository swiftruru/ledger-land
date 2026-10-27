// 「我的 › 徽章」（站規 2.11、03 第 2.10 節）：頂端摘要卡（已取得 n／m 枚加 ProgressBar md 與取得規則）與徽章格（375 兩欄、600 三欄、1024 四欄）。
// 每格是不可點的卡片：72px 徽章、章節眉標（一行，完整章名只給螢幕閱讀器）、徽章名、狀態 Badge（精通是星星金、完成是綠、未取得是中性）
// 與已取得的日期；取得條件只在摘要卡說一次。整章不計分的延伸章（finding pages-a-1）的規則也在摘要卡。
// 徽章格分「主線」與「延伸」兩段（第 2 輪看圖驗收：延伸章原本從第三列中間開始），各有一個小標與已取得數；完成卡和精通卡一樣有淡底與內框，顏色和狀態 Badge 同一個色系（精通星星金、完成成功色，第 4 輪看圖驗收：完成卡原本是 accent，深色像「被選取」；me.css）。
// 徽章圖重用地圖的 ChapterBadge（@ledgerland/web-ui/map）；這個元件只在徽章頁以 lazy 載入，不進首次載入的 chunk。
// 章節之後另有「特別徽章」一區（features/badges/special.ts，維護者 2026-10-27）：探索獎勵，和章節徽章分開算，
// 自己有「已取得 a／b」；頂端摘要卡與進度條的 n／m 只算章節徽章。
// 章節索引、進度的徽章與不計分的章一掛載就讀，三樣都到齊才經 usePageReady 回報、整頁一次出現（維護者 2026-10-26：不先畫骨架格再補徽章）；
// 讀到之前整頁看不見，所以沒有骨架、數字也不是「…」。
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { formatDate, formatNumber, type Locale } from '@ledgerland/i18n';
import { Badge, ProgressBar } from '@ledgerland/web-ui';
import { ChapterBadge, SpecialBadge } from '@ledgerland/web-ui/map';
import { loadChapterIndex } from '../../lib/content.ts';
import { usePageReady } from '../../lib/page-ready.tsx';
import { useGlossaryIndex } from '../glossary/useGlossaryIndex.ts';
import { useUnlocks } from '../glossary/useUnlocks.ts';
import { Phrased, PhrasedRich } from '../me/Phrased.tsx';
import { awardChapterBadges } from './award.ts';
import { badgeStatusOf, isoDatePart, unscoredChapterIds } from './badges.ts';
import { SPECIAL_BADGES, specialBadgeStatus, type SpecialBadgeKey } from './special.ts';
import '../../styles/me.css';

/** 整章不計分的章（章節索引已 precache，讀不到時當作沒有） */
function useUnscoredChapters(locale: Locale): ReadonlySet<string> | null {
  const [value, setValue] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => {
    let alive = true;
    loadChapterIndex(locale).then(
      (s) => alive && setValue(unscoredChapterIds(s)),
      () => alive && setValue(new Set()),
    );
    return () => {
      alive = false;
    };
  }, [locale]);
  return value;
}

/** 內容在徽章名裡標好的斷點（U+200B） */
const ZWSP = '\u200b';

/** 特別徽章的名稱與取得條件（字串放主 catalog；新增特別徽章時這裡與 special.ts 一起加） */
function useSpecialBadgeText(): (key: SpecialBadgeKey) => { title: string; cond: string } {
  const { t } = useLingui();
  return (key) => {
    switch (key) {
      case 'creditsEggs':
        return {
          title: t({ id: 'badges.special.creditsEggs', message: '幕後偵探', comment: '特別徽章的名稱：在「幕後」頁找齊全部彩蛋' }),
          cond: t({ id: 'badges.special.creditsEggs.cond', message: '在「幕後」找到全部彩蛋', comment: '特別徽章「幕後偵探」的取得條件' }),
        };
    }
  };
}

export default function BadgesSection({ locale }: { locale: Locale }) {
  const { t } = useLingui();
  const specialText = useSpecialBadgeText();
  const index = useGlossaryIndex(locale);
  // 讀徽章之前先補寫：已達成但還沒寫進進度的章（例如這個修正之前完成、還沒開過地圖的章），取得時間用該章最後一關完成的時間
  const reconcile = useCallback(() => awardChapterBadges(locale), [locale]);
  const unlocks = useUnlocks('badge', reconcile);
  const unscored = useUnscoredChapters(locale);
  const ready = index !== null && unlocks !== null && unscored !== null;
  usePageReady(ready);
  const fmt = (n: number) => formatNumber(n, locale);
  const chapterCount = index?.chapters.length ?? 0;
  const earnedCount = ready ? index.chapters.filter((c) => badgeStatusOf(unlocks, c.id).state !== 'locked').length : 0;
  const earned = fmt(earnedCount);
  const total = fmt(chapterCount);
  const date = (iso: string) => formatDate(isoDatePart(iso), locale, 'medium');
  const earnedIn = (list: readonly { id: string }[]) => (ready ? list.filter((c) => badgeStatusOf(unlocks, c.id).state !== 'locked').length : 0);
  const groups = ready
    ? [
        { key: 'main', chapters: index.chapters.filter((c) => !c.extension) },
        { key: 'ext', chapters: index.chapters.filter((c) => c.extension) },
      ]
        .filter((g) => g.chapters.length > 0)
        .map((g) => {
          const a = fmt(earnedIn(g.chapters));
          const b = fmt(g.chapters.length);
          return {
            ...g,
            title:
              g.key === 'main'
                ? t({ id: 'badges.group.main', message: '主線章節', comment: '徽章頁的分段小標：主線的章' })
                : t({ id: 'badges.group.ext', message: '延伸章節', comment: '徽章頁的分段小標：延伸區的章' }),
            count: t({ id: 'me.stat.ratio', message: `${a}／${b}`, comment: '統計膠囊上的「已取得／總數」；a、b 已格式化' }),
          };
        })
    : [];
  // 特別徽章：目前只有「幕後偵探」；a／b 是這一區自己的數，不進摘要卡
  const specials = ready
    ? SPECIAL_BADGES.map((def) => {
        const status = specialBadgeStatus(unlocks, def);
        const earnedDate = status.doneAt === undefined ? null : date(status.doneAt);
        return { def, status, earnedDate, text: specialText(def.key) };
      })
    : [];
  const specialCount = (() => {
    const a = fmt(specials.filter((s) => s.status.state === 'done').length);
    const b = fmt(specials.length);
    return t({ id: 'me.stat.ratio', message: `${a}／${b}`, comment: '統計膠囊上的「已取得／總數」；a、b 已格式化' });
  })();

  return (
    <section className="ll-badges" aria-labelledby="ll-badges-summary" data-testid="badges">
      <div className="ll-badges__summary">
        <p id="ll-badges-summary" className="ll-badges__count">
          {/* 和「我的」徽章卡同一個訊息：「2／14 枚」整塊不斷行（第 7 輪看圖驗收：切詞把「2／」和「14 枚」拆成兩行） */}
          <Trans
            id="me.badges.earned"
            comment="「我的」徽章卡與徽章頁摘要卡的取得數；earned、total 已格式化；<0> 包住的「2／14 枚」整塊不斷行（320 加 200% 時「已取得／2／14 枚」）"
            render={PhrasedRich}
          >
            已取得{' '}
            <span className="ll-keep">
              {earned}／{total} 枚
            </span>
          </Trans>
        </p>
        <ProgressBar size="md" value={earnedCount} max={chapterCount || 1} />
        <p className="ll-badges__rules">
          {/* 依詞換行（Phrased，第 7 輪 handoff 收尾：375 原本斷成「「完／成」」「外／觀」，320 斷成「延伸／章」） */}
          <Phrased
            text={t({
              id: 'badges.rules',
              message: '每一章一枚徽章：章內每關至少一星就「完成」，每關三星就是同一枚徽章的「精通」外觀。',
              comment: '徽章頁摘要卡的取得規則',
            })}
          />
          {unscored !== null && unscored.size > 0 && (
            <>
              {/* 中文的句號後面不加空格 */}
              {locale === 'en' ? ' ' : ''}
              <Phrased
                text={t({
                  id: 'badges.rules.unscored',
                  message: '整章不計分的延伸章，每關讀完就完成，沒有精通。',
                  comment: '徽章頁摘要卡的取得規則：整章不計分的延伸章',
                })}
              />
            </>
          )}
        </p>
      </div>
      {ready &&
        groups.map((g) => (
          <section key={g.key} className="ll-badges__group" aria-labelledby={`ll-badges-${g.key}`} data-testid={`badges-${g.key}`}>
            <h2 id={`ll-badges-${g.key}`} className="ll-badges__group-title">
              {g.title}{' '}
              <Badge>
                <span className="ll-num">{g.count}</span>
              </Badge>
            </h2>
            <ul className="ll-badges__grid">
              {g.chapters.map((c) => {
                const info = index.info.get(c.id);
                const status = badgeStatusOf(unlocks, c.id);
                const chapterNo = fmt(c.chapterNo);
                const title = info?.title;
                const badgeTitle = info?.badgeTitle ?? title ?? c.id;
                // 眉標只寫「第 7 章」或「延伸第 3 章」（一行）；完整章名只給螢幕閱讀器（第 1 輪看圖驗收：章名換兩三行、在詞中間斷開）
                const short = c.extension
                  ? t({
                      id: 'badges.extChapterNoTitle',
                      message: `延伸第 ${chapterNo} 章`,
                      comment: '徽章所屬的延伸章（讀不到章節名）；chapterNo 是延伸區自己的章序',
                    })
                  : t({ id: 'badges.chapterNoTitle', message: `第 ${chapterNo} 章`, comment: '徽章所屬的章（讀不到章節名）；chapterNo 是已格式化的章序號' });
                const full =
                  title === undefined
                    ? short
                    : c.extension
                      ? t({
                          id: 'badges.eyebrow.extChapter',
                          message: `延伸第 ${chapterNo} 章：${title}`,
                          comment: '徽章所屬的延伸章；chapterNo 是延伸區自己的章序（和地圖的「延伸第 N 章」相同），title 是章節名',
                        })
                      : t({
                          id: 'badges.eyebrow.chapter',
                          message: `第 ${chapterNo} 章：${title}`,
                          comment: '徽章所屬的章；chapterNo 是已格式化的章序號，title 是章節名',
                        });
                const stateBadge =
                  status.state === 'mastery' ? (
                    <Badge kind="warning">{t({ id: 'badges.state.mastery', message: '精通', comment: '徽章格的狀態：精通' })}</Badge>
                  ) : status.state === 'done' ? (
                    <Badge kind="success">{t({ id: 'badges.state.done', message: '完成', comment: '徽章格的狀態：完成' })}</Badge>
                  ) : (
                    <Badge>{t({ id: 'badges.state.locked', message: '未取得', comment: '徽章格的狀態：還沒取得' })}</Badge>
                  );
                // 只有已取得的徽章顯示取得日期；取得條件只在摘要卡說一次（不在每一格重複）
                const earnedIso = status.state === 'mastery' ? (status.masteryAt ?? status.doneAt) : status.state === 'done' ? status.doneAt : undefined;
                const earnedDate = earnedIso === undefined ? null : date(earnedIso);
                return (
                  <li key={c.id} className="ll-badges__item" data-chapter-id={c.id} data-state={status.state}>
                    <ChapterBadge state={status.state} size={72} className="ll-badges__icon" />
                    <span className="ll-badges__eyebrow">
                      <span aria-hidden="true">{short}</span>
                      <span className="ll-sr-only">{full}</span>
                    </span>
                    {/* 徽章名依詞換行（第 9 輪：320 的「資金來源偵／探」，原本是沒切詞的 keep-all，放不下時在行尾硬斷）；
                          內容用 U+200B 標好的斷點之間整塊不拆（「看懂／股東權益／與融資」三段） */}
                    <span className="ll-badges__title">
                      <Phrased text={badgeTitle} keep={badgeTitle.includes(ZWSP) ? badgeTitle.split(ZWSP) : []} />
                    </span>
                    <span className="ll-badges__state">
                      {stateBadge}
                      {earnedDate !== null && (
                        <span className="ll-badges__cond">
                          {t({
                            id: 'badges.earnedOn',
                            message: `${earnedDate} 取得`,
                            comment: '徽章格：已取得徽章的取得日期；earnedDate 是已格式化的日期（精通是精通的日期）',
                          })}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      {ready && specials.length > 0 && (
        <section className="ll-badges__group" aria-labelledby="ll-badges-special" data-testid="badges-special">
          <h2 id="ll-badges-special" className="ll-badges__group-title">
            {t({ id: 'badges.group.special', message: '特別徽章', comment: '徽章頁的分段小標：不屬於任何章的探索獎勵' })}{' '}
            <Badge>
              <span className="ll-num">{specialCount}</span>
            </Badge>
          </h2>
          <ul className="ll-badges__grid">
            {specials.map(({ def, status, earnedDate, text }) => (
              <li key={def.key} className="ll-badges__item" data-special-badge={def.key} data-state={status.state}>
                <SpecialBadge state={status.state} size={72} className="ll-badges__icon" />
                <span className="ll-badges__eyebrow">
                  {t({ id: 'badges.special.eyebrow', message: '特別', comment: '特別徽章格的眉標（取代章節徽章的「第 N 章」）' })}
                </span>
                <span className="ll-badges__title">
                  <Phrased text={text.title} />
                </span>
                <span className="ll-badges__state">
                  {status.state === 'done' ? (
                    <Badge kind="success">{t({ id: 'badges.state.done', message: '完成', comment: '徽章格的狀態：完成' })}</Badge>
                  ) : (
                    <Badge>{t({ id: 'badges.state.locked', message: '未取得', comment: '徽章格的狀態：還沒取得' })}</Badge>
                  )}
                  {/* 特別徽章各有自己的條件，寫在格子裡；已取得時再加取得日期 */}
                  <span className="ll-badges__cond">
                    <Phrased text={text.cond} />
                  </span>
                  {earnedDate !== null && (
                    <span className="ll-badges__cond">
                      {t({
                        id: 'badges.earnedOn',
                        message: `${earnedDate} 取得`,
                        comment: '徽章格：已取得徽章的取得日期；earnedDate 是已格式化的日期（精通是精通的日期）',
                      })}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
