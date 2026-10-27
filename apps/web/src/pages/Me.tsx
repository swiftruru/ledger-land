// 「我的」（站規 2.8，寬版）：PageHeader（中「我的」、右星星總數）；玩家卡（1.15）與徽章摘要卡；三組選單列（學習、這台裝置、關於，
// 每組最多兩種圖示底色）；最下面是收藏區（2.12）。桌面左 5/12（固定在畫面上）右 7/12。語言切換在首頁頁首與設定頁，這裡不再放。
// 第 1 輪看圖驗收：玩家卡的膠囊是徽章、圖鑑、收藏（星星只在頁首）；「學習」組改放真正的去處「錯題本」（收藏的捷徑在玩家卡）；
// 1024 以上「關於」移到左欄（玩家卡、徽章卡、關於；右欄是學習、這台裝置、收藏），兩欄長度相近。「關於」只渲染一份（第 2 輪看圖驗收：
// 原本 DOM 裡有兩份、依斷點隱藏一份，選「第二列」的截圖選到隱藏的那份）：useExpanded 依斷點決定放在哪一欄，兩種版面的閱讀順序都和畫面一致。
// Me 和其他 Tab 頁一樣 lazy 載入（第 3 輪 handoff：/en/ 入口的首次載入 JS 超過 150 KB；直接開 /me/ 時由殼層預先載入它的 chunk）；
// 統計、徽章圖（地圖的 chunk）與收藏（要讀關卡快照）都另切 chunk 以 import() 載入，但一掛載就開始讀，全部到齊才經 usePageReady 回報、整頁一次出現
// （維護者 2026-10-26：不可以先畫版面、數字「…」或占位長條再補上）。讀到之前整頁看不見，所以這裡沒有任何占位。
// 選單列與徽章卡的說明照全站規則逐字換行（07 第 3.5 節，2026-10-27 起）；數字和量詞包成 .ll-keep 整塊不斷（「2／14 枚」「1 題」）。
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Suspense, lazy, useEffect, useState, type MouseEvent } from 'react';
import { formatNumber, localePath } from '@ledgerland/i18n';
import {
  Badge,
  CompassIcon,
  DeviceIcon,
  ExportIcon,
  GearIcon,
  HeartIcon,
  InfoIcon,
  NavCard,
  NavList,
  NavRow,
  PageHeader,
  ProgressBar,
  ShieldIcon,
  StarIcon,
  StatChip,
} from '@ledgerland/web-ui';
import { MedalIcon, ReviewIcon } from '@ledgerland/web-ui/map';
import { PlayerCard } from '../features/me/PlayerCard.tsx';
import { daysSinceLocal } from '../features/me/days.ts';
import { useExpanded } from '../features/me/useExpanded.ts';
import { EMPTY_STATS, usePlayerStats } from '../features/me/usePlayerStats.ts';
import { useDueCount } from '../features/quiz/useDueCount.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/me.css';

// 收藏區以 lazy 載入；它讀到資料後經 onCount 回報題數，模組與資料都到齊時 favCount 才不是 null（算進 ready）
const FavouritesSection = lazy(() => import('../features/quiz/FavouritesSection.tsx'));

type BadgeRowModule = typeof import('../features/me/BadgeRow.tsx');

/** 徽章摘要卡的徽章橫排（地圖的 chunk）：模組到了才畫，和統計一起出現；undefined 是還在載，載不到時 null（只少橫排，進度條照畫） */
function useBadgeRow(): BadgeRowModule | null | undefined {
  const [mod, setMod] = useState<BadgeRowModule | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    import('../features/me/BadgeRow.tsx').then(
      (m) => alive && setMod(m),
      () => alive && setMod(null),
    );
    return () => {
      alive = false;
    };
  }, []);
  return mod;
}

export const FAVOURITES_TITLE_ID = 'll-favourites-title';

export default function Me() {
  const { t } = useLingui();
  const locale = useLocale();
  const stats = usePlayerStats(locale);
  const [favCount, setFavCount] = useState<number | null>(null);
  const due = useDueCount();
  const badgeRow = useBadgeRow();
  const wide = useExpanded();
  const fmt = (n: number) => formatNumber(n, locale);
  const href = (p: string) => localePath(locale, p);
  // 這一頁第一次繪製要的資料：統計（含徽章與圖鑑數）、收藏（模組與清單）、今日複習數、徽章橫排的模組；取不到也會回報 true
  usePageReady(stats !== null && favCount !== null && due !== null && badgeRow !== undefined);
  // 讀到之前整頁看不見：用空統計排版面，數字不會以「…」出現在畫面上
  const shown = stats ?? EMPTY_STATS;

  const earned = fmt(shown.badges.earned);
  const total = fmt(shown.badges.total);
  const badgesDesc = (
    <Trans
      id="me.badges.earned"
      comment="「我的」徽章卡與徽章頁摘要卡的取得數；earned、total 已格式化；<0> 包住的「2／14 枚」整塊不斷行（320 加 200% 時「已取得／2／14 枚」）"
    >
      已取得{' '}
      <span className="ll-keep">
        {earned}／{total} 枚
      </span>
    </Trans>
  );
  const neverText = t({ id: 'me.backup.never', message: '還沒備份', comment: '「我的」備份列右側與備份頁：從來沒有匯出過' });
  const backupTrail = (() => {
    if (shown.lastExportedAt === null) return <Badge kind="warning">{neverText}</Badge>;
    const days = daysSinceLocal(shown.lastExportedAt);
    const daysText = fmt(days);
    return days === 0
      ? t({ id: 'me.backup.today', message: '今天備份過', comment: '「我的」備份列右側：今天匯出過' })
      : days === 1
        ? t({ id: 'me.backup.yesterday', message: '昨天備份過', comment: '「我的」備份列右側：昨天匯出過' })
        : t({ id: 'me.backup.daysAgo', message: `${daysText} 天前備份`, comment: '「我的」備份列右側：上次匯出是幾天前（至少 2 天）；daysText 已格式化' });
  })();

  // 玩家卡的「收藏」膠囊：同一頁的錨點，捲到收藏區並把焦點移到標題（不換頁）
  const goFavourites = (e: MouseEvent<HTMLAnchorElement>) => {
    const h = document.getElementById(FAVOURITES_TITLE_ID);
    if (!h) return;
    e.preventDefault();
    h.scrollIntoView({ block: 'start' });
    h.focus({ preventScroll: true });
  };

  const aboutGroup = (
    <NavList
      tone="neutral"
      className="ll-me__about"
      data-testid="me-about"
      title={t({ id: 'me.group.about', message: '關於', comment: '「我的」選單列的群組標題' })}
    >
      <NavRow
        icon={<ShieldIcon />}
        title={t({ id: 'me.privacy', message: '隱私說明', comment: '「我的」連到隱私說明' })}
        description={t({ id: 'me.privacy.desc', message: '進度存在哪裡、誰看得到', comment: '「我的」隱私說明列的說明' })}
        href={href('/privacy/')}
      />
      <NavRow
        icon={<InfoIcon />}
        title={t({ id: 'me.about', message: '關於與授權', comment: '「我的」連到關於與授權' })}
        description={t({ id: 'me.about.desc', message: '授權、原始碼與版本', comment: '「我的」關於與授權列的說明' })}
        href={href('/about/')}
      />
      <NavRow
        icon={<CompassIcon />}
        title={t({ id: 'me.design', message: '關於系統設計', comment: '「我的」連到關於系統設計' })}
        description={t({ id: 'me.design.desc', message: '這個網站怎麼設計出來的', comment: '「我的」關於系統設計列的說明' })}
        href={href('/design/')}
      />
      <NavRow
        icon={<HeartIcon />}
        title={t({ id: 'me.credits', message: '幕後', comment: '「我的」連到幕後（作者、老師與技術棧）' })}
        description={t({ id: 'me.credits.desc', message: '作者、老師，還有做網站的技術', comment: '「我的」幕後列的說明' })}
        href={href('/credits/')}
      />
    </NavList>
  );

  const stars = fmt(shown.stars);
  return (
    <>
      <PageHeader
        title={t({ id: 'me.title', message: '我的', comment: '「我的」頁面標題' })}
        end={
          <StatChip
            icon={<StarIcon filled />}
            tone="star"
            value={stars}
            label={t({ id: 'me.stat.stars', message: `星星 ${stars} 顆`, comment: '玩家卡與頁首的星星總數；stars 已格式化' })}
            href={href('/play/')}
          />
        }
      />
      <div className="ll-me">
        <div className="ll-me__side">
          <PlayerCard stats={shown} favourites={{ count: favCount ?? 0, href: `${href('/me/')}#${FAVOURITES_TITLE_ID}`, onClick: goFavourites }} />
          <NavCard
            as="div"
            href={href('/me/badges/')}
            icon={<MedalIcon />}
            title={t({ id: 'me.badges', message: '徽章', comment: '「我的」與首頁捷徑連到徽章頁' })}
            description={badgesDesc}
            media={
              <span className="ll-me-badges">
                {badgeRow ? <badgeRow.default list={shown.badges.list} total={shown.badges.total} /> : <span className="ll-me-badges__row" />}
                <ProgressBar size="sm" value={shown.badges.earned} max={shown.badges.total || 1} className="ll-me-badges__bar" />
              </span>
            }
            data-testid="badge-summary"
          />
          {wide && aboutGroup}
        </div>
        <div className="ll-me__main">
          <NavList title={t({ id: 'me.group.learn', message: '學習', comment: '「我的」選單列的群組標題' })}>
            {/* 徽章的去處是上面（桌面是左欄）的徽章摘要卡、收藏的捷徑是玩家卡的膠囊：這一組放錯題本（偏離站規 2.8，第 1 輪看圖驗收） */}
            <NavRow
              icon={<ReviewIcon />}
              title={t({ id: 'home.review.title', message: '錯題本', comment: '首頁今日複習列的標題' })}
              description={
                due !== null && due > 0 ? (
                  // 分支的根元素是 .ll-phrased（Lingui 的 Plural 分支只認 JSX 元素，不認 <>…</>）：只在 <wbr> 與空格處換行
                  <Plural
                    id="me.review.due"
                    comment="「我的」錯題本列的說明（今天有到期的題目）；due 是題數。<1/> 是可以換行的位置（320 加 200% 時「今天要／複習 1 題」），<2> 包住的「1 題」整塊不斷行"
                    value={due}
                    other={
                      <span className="ll-phrased">
                        今天要
                        <wbr />
                        複習 <span className="ll-keep"># 題</span>
                      </span>
                    }
                  />
                ) : (
                  t({
                    id: 'me.review.desc',
                    message: '答錯的題目會排在這裡，隔幾天回來複習',
                    comment: '「我的」學習群組錯題本列的說明（今天沒有到期的題目）',
                  })
                )
              }
              trailing={due !== null && due > 0 ? <Badge kind="danger">{fmt(due)}</Badge> : undefined}
              href={href('/review/')}
              data-testid="me-review-row"
            />
          </NavList>
          <NavList title={t({ id: 'me.group.device', message: '這台裝置', comment: '「我的」選單列的群組標題' })}>
            <NavRow
              icon={<GearIcon />}
              title={t({ id: 'me.settings', message: '設定', comment: '「我的」與首頁捷徑連到設定頁' })}
              description={t({ id: 'me.settings.desc', message: '語言、外觀、計時', comment: '「我的」設定列的說明' })}
              href={href('/me/settings/')}
            />
            <NavRow
              icon={<ExportIcon />}
              title={t({ id: 'me.backup', message: '備份', comment: '「我的」連到備份頁' })}
              description={t({ id: 'me.backup.desc', message: '匯出或匯入學習進度', comment: '「我的」備份列的說明' })}
              trailing={backupTrail}
              href={href('/me/backup/')}
            />
            <NavRow
              icon={<DeviceIcon />}
              title={t({ id: 'me.install', message: '安裝教學', comment: '「我的」與設定頁連到安裝教學' })}
              description={t({ id: 'me.install.desc', message: '把會計樂園加到主畫面', comment: '安裝教學列的說明' })}
              href={href('/install/')}
            />
          </NavList>
          {!wide && aboutGroup}
          <Suspense fallback={null}>
            <FavouritesSection locale={locale} headingId={FAVOURITES_TITLE_ID} onCount={setFavCount} />
          </Suspense>
        </div>
      </div>
    </>
  );
}
