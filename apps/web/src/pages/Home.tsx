// 首頁（站規 2.1）：PageHeader（中站名、右語言切換）；主卡是鈴、問候與唯一一顆主按鈕（沒有進度「開始闖關」，有進度「繼續 1-2」）；
// 有進度時主卡第二行是下一關的關名（取代固定的介紹），按鈕只放短代號，375 也排得進一行（第 1 輪看圖驗收）；
// 目前章節小地圖（1.16，整張卡是去闖關地圖的連結）、今日複習（有到期題目才出現）與捷徑。桌面兩欄（7/12 與 5/12，上緣對齊）。
// 寬版（1024 起）的主卡多一段「這一章的進度」（進度條與星星數，第 2 輪看圖驗收：主卡被拉到和右欄一樣高，內容太少、上下兩大片空白）。
// 維護者 2026-10-26：點進任何一頁都要直接看到完整的資訊，不可以先畫版面、數字「…」或占位長條再補上。首頁把進度與統計（useHomeData，連同小地圖的模組）、
// 今日複習數（useDueCount）與匯入提示卡要不要出現（useImportPrompt）全部讀齊才經 usePageReady 回報，整頁才一次淡入；
// 讀到之前整頁看不見（Root 的 PageReveal），所以這裡沒有任何占位。首頁仍在首次載入的 chunk 裡：地圖的幾何與進度的 runtime 仍是動態 import。
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { formatNumber, localePath } from '@ledgerland/i18n';
import {
  Badge,
  BookmarkIcon,
  Button,
  CardsIcon,
  GearIcon,
  NavCard,
  NavList,
  NavRow,
  PageHeader,
  PlayIcon,
  ProgressBar,
  StarIcon,
  StatChip,
} from '@ledgerland/web-ui';
import { MapIcon, MapMarker, MedalIcon } from '@ledgerland/web-ui/map';
import { useExpandedBanner } from '../components/Banners.tsx';
import { ImportPromptCard, useImportPrompt } from '../components/ImportPromptCard.tsx';
import { LangSwitch } from '../components/LangSwitch.tsx';
import { PhrasedParts } from '../features/me/PhrasedParts.tsx';
import { useLevelCodeFormatter } from '../features/home/codes.ts';
import { useHomeData } from '../features/home/useHomeData.ts';
import { useDueCount } from '../features/quiz/useDueCount.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../features/home/home.css';
import '../styles/me.css';

/** 有進度時的問候：短代號整塊不斷（第 9 輪：375 加 200% 字級排成「今天從 1-／3 繼續吧」，連字號落在行尾像破折號） */
function ContinueGreeting({ code }: { code: string }) {
  const nextCode = <span className="ll-nowrap">{code}</span>;
  return (
    <Trans id="home.greet.continue" comment="首頁主卡的問候（有進度）；nextCode 是下一關的短代號，例如 1-2（整塊不換行）">
      今天從 {nextCode} 繼續吧
    </Trans>
  );
}

export function Home() {
  const { t } = useLingui();
  const locale = useLocale();
  const due = useDueCount();
  const home = useHomeData(locale);
  const code = useLevelCodeFormatter();
  const quest = home?.data.quest ?? null;
  const stats = home?.data.stats ?? null;
  // 小地圖與它的說明（同一個 lazy 模組，和進度一起到）；chunk 載不到（離線又沒有快取）時是 null，卡片只畫地景底色
  const Mini = home?.mini ?? null;
  const fmt = (n: number) => formatNumber(n, locale);
  const next = quest?.next;
  const nextCode = next ? code(next.chapterNo, next.levelNo, next.extension) : '';
  const nextTitleText = next?.title ?? '';
  const state = quest?.state ?? 'new';
  const playHref = localePath(locale, '/play/');
  // 匯入提示卡出現時（App 第一次啟動、資料庫是空的），它的「貼上備份碼」是這個畫面唯一的主按鈕，主卡的按鈕改成 secondary（站規 5.2）；
  // 儲存層橫幅（資料會遺失，保留 primary sm）展開時也一樣，畫面上只留一顆 primary。
  // 第 4 輪看圖驗收：只改顏色時主卡的按鈕仍是 lg 滿版（約 420×56），比提示卡的 primary sm 大很多，主次在尺寸上顛倒；
  // 讓位時改成 sm、不滿版（和提示卡的按鈕同一個尺寸，站規 2.7「不比主動作大」），手機排在問候下面、鈴的右邊（home.css 的 .ll-home-hero--quiet）
  const importPrompt = useImportPrompt();
  const storageBanner = useExpandedBanner() === 'storage';
  const quiet = importPrompt.show === true || storageBanner;
  // 這一頁第一次繪製要的資料：進度與統計（含小地圖的模組）、今日複習數、匯入提示卡要不要出現（都取不到也會回報 true，畫面照樣出來）
  usePageReady(home !== undefined && due !== null && importPrompt.show !== null);
  const ctaProps = quiet ? ({ variant: 'secondary', size: 'sm', block: false } as const) : ({ variant: 'primary', size: 'lg', block: true } as const);

  const greeting =
    state === 'continue' ? (
      <ContinueGreeting code={nextCode} />
    ) : state === 'allDone' ? (
      t({ id: 'home.greet.allDone', message: '全部關卡都闖過了，去拿更多星星吧', comment: '首頁主卡的問候（所有關卡都完成）' })
    ) : (
      t({ id: 'home.greet.new', message: '從第 1 章開始吧', comment: '首頁主卡的問候（還沒有進度，或進度還在讀）' })
    );

  // 主卡唯一一顆按鈕：有進度「繼續 1-2」直接開始下一關，全部完成「前往闖關地圖」，沒有進度「開始闖關」（同一個 Button，只換圖示、網址與字）
  const goNext = state === 'continue' && next;
  const cta = (
    <Button
      {...ctaProps}
      icon={state === 'allDone' ? <MapIcon /> : <PlayIcon />}
      href={goNext ? localePath(locale, `/level/${next.levelId}/`) : playHref}
      data-testid="home-play"
      className="ll-home-hero__cta"
    >
      {goNext
        ? t({
            id: 'home.continue.code',
            message: `繼續 ${nextCode}`,
            comment: '首頁主按鈕（有進度）：直接開始下一關；nextCode 是短代號，例如 1-2（關名在主卡的第二行）',
          })
        : state === 'allDone'
          ? t({ id: 'home.play.map', message: '前往闖關地圖', comment: '首頁主按鈕（所有關卡都完成）' })
          : t({ id: 'home.play', message: '開始闖關', comment: '首頁進入闖關地圖的主按鈕（還沒有進度）' })}
    </Button>
  );

  // 章名與關卡名依詞換行（第 9 輪看圖驗收：320 的「下一關「綜合挑／戰：…」」、200% 的「一／家小店的帳」）：
  // 詞在懶載入的 home-quest.ts 切好（titleParts），這裡只用 PhrasedParts 放 <wbr>，首次載入的 JS 不帶切詞程式
  const chapterNo = quest ? fmt(quest.chapter.chapterNo) : '';
  const chapterName = quest ? <PhrasedParts text={quest.chapter.title} parts={quest.chapter.titleParts} /> : null;
  const nextTitle = <PhrasedParts text={nextTitleText} parts={next?.titleParts} />;
  const chapterTitle = quest ? (
    quest.chapter.extension ? (
      <Trans id="home.minimap.chapterTitleExt" comment="首頁章節小地圖卡的標題（延伸章）；chapterNo 是已格式化的章序，chapterName 是章名">
        延伸第 {chapterNo} 章 {chapterName}
      </Trans>
    ) : (
      <Trans id="home.minimap.chapterTitle" comment="首頁章節小地圖卡的標題；chapterNo 是已格式化的章序，chapterName 是章名">
        第 {chapterNo} 章 {chapterName}
      </Trans>
    )
  ) : (
    t({ id: 'home.minimap.title', message: '闖關地圖', comment: '首頁章節小地圖卡在進度讀到之前的標題' })
  );
  // 這一章的進度（寬版主卡與手機、平板的小地圖卡共用）；沒有關卡（quest 是 null）時沒有這一段
  const prog = quest?.progress;
  const done = prog ? fmt(prog.done) : '';
  const levelTotal = prog ? fmt(prog.total) : '';
  const a = prog ? fmt(prog.stars) : '';
  const b = prog ? fmt(prog.maxStars) : '';
  const progLevels = t({
    id: 'home.progress.levels',
    message: `${done}／${levelTotal} 關`,
    comment: '首頁寬版主卡：這一章完成的關數；done、levelTotal 已格式化',
  });
  const progStars = t({ id: 'me.stat.ratio', message: `${a}／${b}`, comment: '統計膠囊上的「已取得／總數」；a、b 已格式化' });
  const progTitle = t({ id: 'home.progress.title', message: '這一章的進度', comment: '首頁寬版主卡：目前章節進度的小標' });
  const starsLabel = t({
    id: 'home.progress.starsLabel',
    message: `這一章的星星 ${progStars} 顆`,
    comment: '首頁寬版主卡星星膠囊的可讀名稱；progStars 是「拿到的／滿星數」，例如 4／9',
  });

  // 小地圖卡的說明（ChapterMiniMap.tsx 的 MiniMapDesc，和小地圖同一個 lazy 模組，首次載入的 JS 不增加）：有進度時是這一章的進度，
  // 字串和寬版主卡共用（第 4 輪看圖驗收：主卡第二行已經寫下一關的關名，這裡再寫一次是重複）
  const chapterDesc = quest && Mini ? <Mini.MiniMapDesc quest={quest} title={progTitle} levels={progLevels} stars={progStars} starsLabel={starsLabel} /> : null;
  // 第 6 輪看圖驗收：小標列原本橫跨整排，「2／3 關」落在星星膠囊正上方，像兩個疊起來的分數。改成兩欄（home.css）：
  // 左欄是小標列（小標靠左、關數靠右，對齊進度條尾端）與進度條，右欄是星星膠囊，跨兩列垂直置中
  const chapterProgress = prog ? (
    <div className="ll-home-hero__progress" data-testid="home-chapter-progress">
      <p className="ll-home-hero__prog-head">
        <span>{progTitle}</span>
        <span className="ll-num">{progLevels}</span>
      </p>
      <ProgressBar size="md" value={prog.done} max={prog.total || 1} className="ll-home-hero__bar" />
      {prog.maxStars > 0 && <StatChip icon={<StarIcon filled />} tone="star" value={progStars} label={starsLabel} className="ll-home-hero__stars" />}
    </div>
  ) : null;

  const terms = stats?.terms;
  const termsDone = terms ? fmt(terms.done) : '';
  const termsTotal = terms ? fmt(terms.total) : '';
  const earned = stats ? fmt(stats.badges.earned) : '';
  const total = stats ? fmt(stats.badges.total) : '';
  return (
    <>
      <PageHeader title={t({ id: 'home.siteName', message: '會計樂園', comment: '首頁頁首的站名' })} end={<LangSwitch size="sm" />} />
      <div className="ll-home">
        <div className="ll-home__main">
          <section className={`ll-home-hero${quiet ? ' ll-home-hero--quiet' : ''}`} aria-labelledby="ll-home-greet">
            <span className="ll-home-hero__stage" aria-hidden="true">
              <MapMarker pose="wave" size={120} className="ll-home-hero__bell" />
            </span>
            <div className="ll-home-hero__text">
              <h2 id="ll-home-greet" className="ll-home-hero__greet">
                {greeting}
              </h2>
              {state === 'continue' && nextTitleText !== '' ? (
                <p className="ll-home-hero__tag ll-home-hero__tag--next" data-testid="home-next-title">
                  <Trans
                    id="home.hero.next"
                    comment="首頁主卡的第二行（有進度）：下一關的關卡名；nextTitle 是關卡名（依詞換行）。「下一關」的字與字之間有看不見的 U+2060，兩行時不拆成「下一／關「…」」"
                  >
                    下⁠一⁠關「{nextTitle}」
                  </Trans>
                </p>
              ) : (
                <p className="ll-home-hero__tag">
                  <Trans
                    id="home.tagline"
                    comment="首頁主卡的介紹，兩句；詞的字與字之間有看不見的 U+2060（word joiner），只在詞與詞之間、標點後換行（「會計入門」「可離線使用」整塊不拆）。闖關、實驗室是 Tab 的短名（D9）。375 排成「用闖關與實驗室學會計入門。」換行「中英雙語，可離線使用。」兩行；320 三行，在「學」或句號後換行"
                  >
                    用闖⁠關與實⁠驗⁠室學會⁠計⁠入⁠門。中⁠英⁠雙⁠語，可⁠離⁠線⁠使⁠用。
                  </Trans>
                </p>
              )}
            </div>
            {chapterProgress}
            {cta}
          </section>
          <ImportPromptCard {...importPrompt} />
        </div>
        <div className="ll-home__side">
          <NavCard
            as="div"
            href={playHref}
            icon={<MapIcon />}
            title={chapterTitle}
            description={chapterDesc}
            media={quest && Mini ? <Mini.default quest={quest} /> : <div className="ll-minimap" aria-hidden="true" />}
            data-testid="home-minimap"
          />
          {due !== null && due > 0 && (
            <NavList aria-label={t({ id: 'home.review.label', message: '今日複習', comment: '首頁今日複習清單的可讀名稱' })}>
              <NavRow
                icon={<BookmarkIcon />}
                title={t({ id: 'home.review.title', message: '錯題本', comment: '首頁今日複習列的標題' })}
                description={
                  <Plural
                    id="home.due"
                    comment="首頁今日複習列的說明；due 是今天到期的題數，0 題時整列不顯示；數字和「題」之間是不換行空白，「今天」「複習」的字之間有看不見的 U+2060（首次載入的 chunk 不切詞，200% 字級不再斷成「複／習」）"
                    value={due}
                    other="今⁠天要複⁠習 # 題"
                  />
                }
                trailing={<Badge kind="danger">{fmt(due)}</Badge>}
                href={localePath(locale, '/review/')}
                data-testid="home-due"
              />
            </NavList>
          )}
          <NavList title={t({ id: 'home.shortcuts', message: '捷徑', comment: '首頁捷徑清單的標題' })}>
            <NavRow
              icon={<CardsIcon />}
              title={t({ id: 'home.shortcut.terms', message: '名詞圖鑑', comment: '首頁捷徑：名詞圖鑑' })}
              description={
                terms
                  ? t({
                      id: 'home.shortcut.termsCount',
                      message: `已收進 ${termsDone}／${termsTotal} 個名詞`,
                      comment: '首頁捷徑：名詞圖鑑的收集數；termsDone、termsTotal 已格式化（參考名詞不算）',
                    })
                  : null
              }
              href={localePath(locale, '/terms/')}
            />
            <NavRow
              icon={<MedalIcon />}
              title={t({ id: 'me.badges', message: '徽章', comment: '「我的」與首頁捷徑連到徽章頁' })}
              description={
                stats
                  ? t({
                      id: 'me.badges.count',
                      message: `已取得 ${earned}／${total} 枚`,
                      comment: '徽章的取得數；earned、total 已格式化；總數和「枚」之間是不換行空白',
                    })
                  : null
              }
              href={localePath(locale, '/me/badges/')}
            />
            <NavRow
              icon={<GearIcon />}
              title={t({ id: 'me.settings', message: '設定', comment: '「我的」與首頁捷徑連到設定頁' })}
              description={t({
                id: 'home.shortcut.settings.desc',
                message: '語⁠言、外⁠觀、深⁠色⁠風⁠味',
                comment: '首頁捷徑：設定的說明；詞的字與字之間有看不見的 U+2060，200% 字級時只在頓號後換行（第 9 輪：「外／觀」）',
              })}
              href={localePath(locale, '/me/settings/')}
            />
          </NavList>
        </div>
      </div>
    </>
  );
}
