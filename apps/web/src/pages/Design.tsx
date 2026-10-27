// 關於系統設計（02 第 1.1 節、站規 2.14）：網站作者的設計筆記，公開、雙語、可離線。文字沿用定稿，之後會隨著系統成形慢慢補上。
// 頁首 TopBar 的返回是「我的」；日後提到其他頁一律用 TextLink。
// 版面（第 2 輪驗收：大畫面不能只是一欄純文字）：每一段是 section，標題前有 20px 線條圖示（32px 中性底色方塊，和目錄列的圖示一樣）；
// 1024 以上兩欄（路由是寬版）：左邊 65ch 內文，右邊 sticky 的「本頁目錄」（NavList neutral、compact 列，每段一列；目前段落的圖示方塊有 accent 框）。
// 目錄的列是頁內錨點：按下時自己捲到那一段並把焦點移到段落標題（react-router 的 Link 不會捲到 #id），網址的 hash 跟著換；
// 第 4 輪驗收：頁內錨點不畫「前往別頁」的右箭頭（NavRow chevron="none"，少一欄 20px），目前段落仍是圖示方塊的 accent 框。
// 1024 以下目錄不顯示（十二列太長，手機上直接往下讀）。頁尾一組「更多」選單列：隱私說明、關於與授權。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { localePath } from '@ledgerland/i18n';
import {
  BookIcon,
  ChatIcon,
  CodeIcon,
  DeviceIcon,
  FileIcon,
  HandIcon,
  HeartIcon,
  InfoIcon,
  LightbulbIcon,
  NavList,
  NavRow,
  PaletteIcon,
  ProcessIcon,
  ShieldIcon,
  StatementIcon,
  TopBar,
  TranslateIcon,
} from '@ledgerland/web-ui';
import { MapIcon } from '@ledgerland/web-ui/map';
import { useBackToMe } from '../components/useBackLabels.ts';
import { ProseWords } from '../components/ProseWords.tsx';
import { Phrased } from '../features/me/Phrased.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/info.css';

interface Section {
  id: string;
  icon: ReactNode;
  title: string;
  body: ReactNode;
}

/** 段落標題的 id（目錄的錨點） */
const anchorId = (id: string) => `design-${id}`;

/** 系統的減少動態，或 App 內的開關（html[data-motion="reduced"]） */
function reducedMotion(): boolean {
  if (document.documentElement.dataset.motion === 'reduced') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 捲到某一段，焦點移到段落標題（tabindex=-1，只在需要時加） */
function goToSection(id: string, smooth: boolean): void {
  const heading = document.getElementById(anchorId(id));
  if (!heading) return;
  heading.scrollIntoView({ block: 'start', behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}

/** 判斷「目前段落」的那條線：標題上緣捲過視窗頂端往下 96px 就算進入那一段 */
const CURRENT_LINE_PX = 96;

/** 目前段落：捲動時找最後一個捲過判斷線的標題；捲到頁底時是最後一段。按目錄跳過去的那一段先固定，直到使用者自己捲動 */
function useCurrentSection(ids: readonly string[]): [string, (id: string) => void] {
  const [current, setCurrent] = useState(ids[0] ?? '');
  const pinned = useRef<string | null>(null);
  const key = ids.join(' ');
  useEffect(() => {
    const list = key.split(' ');
    let frame = 0;
    const update = () => {
      frame = 0;
      if (pinned.current) {
        setCurrent(pinned.current);
        return;
      }
      let next = list[0] ?? '';
      for (const id of list) {
        const el = document.getElementById(anchorId(id));
        if (el && el.getBoundingClientRect().top <= CURRENT_LINE_PX) next = id;
      }
      const doc = document.documentElement;
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 2) next = list[list.length - 1] ?? next;
      setCurrent(next);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // 使用者自己捲動（滾輪、觸控、鍵盤）時解除固定
    const release = () => {
      pinned.current = null;
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('wheel', release, { passive: true });
    window.addEventListener('touchstart', release, { passive: true });
    window.addEventListener('keydown', release);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('wheel', release);
      window.removeEventListener('touchstart', release);
      window.removeEventListener('keydown', release);
    };
  }, [key]);
  const pin = (id: string) => {
    pinned.current = id;
    setCurrent(id);
  };
  return [current, pin];
}

export default function Design() {
  const { t } = useLingui();
  const locale = useLocale();
  const location = useLocation();
  const back = useBackToMe();
  const sections: Section[] = [
    {
      id: 'why',
      icon: <LightbulbIcon />,
      title: t({ id: 'design.why.title', message: '為什麼想做這個' }),
      body: (
        <>
          <p>
            <Trans id="design.why.1" render={ProseWords}>
              會計課上到一半，我發現自己最記得的，不是哪個科目該放哪裡，而是老師把一家小公司的故事從頭講到尾：先拿錢成立，買了一台電腦，進了一批貨，賣掉，借錢，再還錢。三張報表就在這些小事裡慢慢長出來。
            </Trans>
          </p>
          <p>
            <Trans id="design.why.2" render={ProseWords}>
              那時候我想，如果可以把這個過程做成一個可以動手玩的東西，讓數字自己跑，讓人看見每一筆交易在報表裡留下的痕跡，也許會計就不會那麼像一堆要背的規則了。
            </Trans>
          </p>
          <p>
            <Trans id="design.why.3" render={ProseWords}>
              LedgerLand 就是這樣開始的。它不是要取代課程，比較像一本可以翻、可以按的練⁠習⁠簿。
            </Trans>
          </p>
        </>
      ),
    },
    {
      id: 'statements',
      icon: <StatementIcon />,
      title: t({ id: 'design.statements.title', message: '從報表倒著看' }),
      body: (
        <>
          <p>
            <Trans id="design.statements.1" render={ProseWords}>
              老師的教法是先看報表，再回頭看交易，而不是先學借貸再學分錄。我喜歡這個順序，因為它跟一般人認識一家公司的方式比較像：先看結果，再問為什麼。
            </Trans>
          </p>
          <p>
            <Trans id="design.statements.2" render={ProseWords}>
              所以這裡的主線也是這樣。借貸和分錄沒有消失，只是放在後面一點的地方，等你想知道「數字從哪裡來」的時候再打開。
            </Trans>
          </p>
        </>
      ),
    },
    {
      id: 'source',
      icon: <ProcessIcon />,
      title: t({ id: 'design.source.title', message: '數字只有一個來源' }),
      body: (
        <>
          <p>
            <Trans id="design.source.1" render={ProseWords}>
              網站裡所有的數字，包括餘額、三張報表、財務比率、題目的答案，都是從同一組分錄算出來的。沒有任何一個數字是另外手寫上去的。
            </Trans>
          </p>
          <p>
            <Trans id="design.source.2" render={ProseWords}>
              這樣做的理由很簡單：如果有一天某個地方算錯了，它只會錯在一個地方，改一次就好。也因為這樣，你在實驗室裡改了一筆金額，後面的每一張表都會跟著變，不會有哪個角落還留著舊的數字。
            </Trans>
          </p>
        </>
      ),
    },
    {
      id: 'layout',
      icon: <BookIcon />,
      title: t({ id: 'design.layout.title', message: '課程的版面，現行的準則' }),
      body: (
        <>
          <p>
            <Trans id="design.layout.1" render={ProseWords}>
              課程用的報表格式，有幾個現行準則已經不再使用的名字，像是經常利益、非常損益、遞延資產。我沒有把它們拿掉，因為那是課堂上會看到的樣子。
            </Trans>
          </p>
          <p>
            <Trans id="design.layout.2" render={ProseWords}>
              我做的是把兩邊並排：報表照課程的版面顯示，旁邊標出哪些項目在現行的國際財務報導準則裡沒有，點開可以看到現在的做法是什麼。實驗室裡也可以整套切換成準則的版本，看看同一組交易在兩種規則下，數字差在哪裡。
            </Trans>
          </p>
          <p>
            <Trans id="design.layout.3" render={ProseWords}>
              我不想替哪一邊選邊，只想把差異放在看得見的地方。
            </Trans>
          </p>
        </>
      ),
    },
    {
      id: 'unsaid',
      icon: <ChatIcon />,
      title: t({ id: 'design.unsaid.title', message: '老師沒有說的部分' }),
      body: (
        <>
          <p>
            <Trans id="design.unsaid.1" render={ProseWords}>
              教材裡有一些地方沒有明說，例如設立費要不要資本化、盤點多出來的存貨要記在哪裡、付利息算哪一種活動。一開始我列了一長串問題，想一條一條問老師。
            </Trans>
          </p>
          <p>
            <Trans id="design.unsaid.2" render={ProseWords}>
              後來覺得這樣太細了，也太打擾。只要做法符合一般公認的會計原則，剩下的就由我判斷，把理由寫下來。老師知道這個專案，會幫忙留意內容；有不一樣的意見，再改就好。每一個這樣的選擇，都做成可以切換的設定，不是寫死的規則。
            </Trans>
          </p>
          <p>
            <Trans id="design.unsaid.3" render={ProseWords}>
              這一頁後面會慢慢補上那些選擇，以及為什麼。
            </Trans>
          </p>
        </>
      ),
    },
    {
      id: 'questions',
      icon: <FileIcon />,
      title: t({ id: 'design.questions.title', message: '題目是自己寫的' }),
      body: (
        <>
          <p>
            <Trans id="design.questions.1" render={ProseWords}>
              所有的題目、解說、名詞卡都是重新寫過的，不是把課本的題目換個數字。教材是地圖，不是答案本。
            </Trans>
          </p>
          <p>
            <Trans id="design.questions.2" render={ProseWords}>
              唯一直接沿用的是故事裡那家公司的情境和金額，因為它和課堂上用的是同一組數字，對照起來最方便。這部分經過老師同意，也在授權說明裡寫清楚了。
            </Trans>
          </p>
        </>
      ),
    },
    {
      id: 'play',
      icon: <MapIcon />,
      title: t({ id: 'design.play.title', message: '沒有生命值，沒有排行榜' }),
      body: (
        <>
          <p>
            <Trans id="design.play.1" render={ProseWords}>
              闖關區長得像遊戲，但這裡沒有倒數計時、沒有體力、沒有要跟別人比的名次。關卡也不會鎖住你。
            </Trans>
          </p>
          <p>
            <Trans id="design.play.2" render={ProseWords}>
              我希望它比較像散步，走錯了可以回頭再走一次，而不是一場要衝過的考試。星星只是記錄你來過哪裡。
            </Trans>
          </p>
        </>
      ),
    },
    {
      id: 'progress',
      icon: <HandIcon />,
      title: t({ id: 'design.progress.title', message: '進度留在你自己的手上' }),
      body: (
        <>
          <p>
            <Trans id="design.progress.1" render={ProseWords}>
              網站不需要帳號。你的進度存在你自己的手機或電腦裡，想換裝置的時候可以匯出備份，想清掉就清掉。
            </Trans>
          </p>
          <p>
            <Trans id="design.progress.2" render={ProseWords}>
              沒有追蹤，沒有 cookie。只有一個不認得你是誰的訪客計數，讓我知道有沒有人來過。
            </Trans>
          </p>
        </>
      ),
    },
    {
      id: 'mobile',
      icon: <DeviceIcon />,
      title: t({ id: 'design.mobile.title', message: '手機優先，離線也能用' }),
      body: (
        <>
          <p>
            <Trans id="design.mobile.1" render={ProseWords}>
              大多數人會在手機上打開它，可能在捷運上，可能在睡前。所以每一頁都先為小螢幕設計，加到主畫面之後，沒有網路也能繼續用。
            </Trans>
          </p>
        </>
      ),
    },
    {
      id: 'languages',
      icon: <TranslateIcon />,
      title: t({ id: 'design.languages.title', message: '兩種語言' }),
      body: (
        <>
          <p>
            <Trans id="design.languages.1" render={ProseWords}>
              中文是課堂的語言，英文是準則的語言。報表的每一列、每一個名詞，都同時有兩種寫法，而且是同一份資料，不是兩份各自維護的翻譯。切換語言的時候，你正在做的題目不會消失。
            </Trans>
          </p>
        </>
      ),
    },
    {
      id: 'colours',
      icon: <PaletteIcon />,
      title: t({ id: 'design.colours.title', message: '顏色' }),
      body: (
        <>
          <p>
            <Trans id="design.colours.1" render={ProseWords}>
              淺色是紙的顏色，深色有三種：夜空、莓果、紅酒。沒有特別的理由，只是看久了眼睛舒服一點，而且晚上讀書的時候，想要可以選一個自己喜歡的。
            </Trans>
          </p>
          <p>
            <Trans id="design.colours.2" comment="關於系統設計「顏色」一節的第二段：深色闖關地圖的地景色（作者的語氣）" render={ProseWords}>
              深色的闖關地圖改最久。一開始陸地和海在晚上一樣暗，看不出岸在哪裡；後來讓海偏深藍、陸地亮一點，再帶一點各自主題的顏色：夜空偏藍紫、莓果偏紫紅、紅酒偏紅棕。不過整張地圖都比卡片暗，地圖上的字永遠比地景顯眼。
            </Trans>
          </p>
        </>
      ),
    },
    {
      id: 'open',
      icon: <CodeIcon />,
      title: t({ id: 'design.open.title', message: '公開的理由' }),
      body: (
        <>
          <p>
            <Trans id="design.open.1" render={ProseWords}>
              程式碼和原創的內容都是公開的。一方面是因為我覺得學習的東西本來就該讓人看見怎麼做出來的；另一方面也是提醒自己，寫下的每一個選擇都要經得起別人翻閱。
            </Trans>
          </p>
          <p>
            <Trans id="design.open.2" render={ProseWords}>
              如果你發現哪裡不對，或者有更好的說法，歡迎告訴我。這個網站會一直慢慢修。
            </Trans>
          </p>
        </>
      ),
    },
  ];
  const ids = sections.map((s) => s.id);
  const [current, pin] = useCurrentSection(ids);

  // 帶著 #design-… 打開這一頁（例如分享的連結）：頁面是懶載入的，瀏覽器自己的捲動找不到標題，載入後補捲一次
  const initialHash = useRef(location.hash);
  useEffect(() => {
    const hash = initialHash.current;
    if (!hash.startsWith('#design-')) return;
    const heading = document.getElementById(decodeURIComponent(hash.slice(1)));
    heading?.scrollIntoView({ block: 'start' });
  }, []);

  const jump = (id: string) => (e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    e.preventDefault();
    pin(id);
    goToSection(id, true);
    // 換 hash 但保留 react-router 放在 history.state 裡的資料（返回鍵照常）
    window.history.replaceState(window.history.state, '', `#${anchorId(id)}`);
  };

  return (
    <>
      <TopBar
        title={t({ id: 'design.title', message: '關於系統設計' })}
        backHref={localePath(locale, '/me/')}
        backLabel={back.label}
        backShortLabel={back.short}
      />
      <div className="ll-design">
        {/* 左欄：內文與頁尾的「更多」（同一欄，寬度對齊）；右欄：目錄 */}
        <div className="ll-design__main">
          <div className="ll-prose ll-design__body">
            {sections.map((s) => (
              <section key={s.id} className="ll-design__section" aria-labelledby={anchorId(s.id)} data-testid={`design-section-${s.id}`}>
                <h2 id={anchorId(s.id)} className="ll-design__heading">
                  <span className="ll-design__icon" aria-hidden="true">
                    {s.icon}
                  </span>
                  <span>{s.title}</span>
                </h2>
                {s.body}
              </section>
            ))}
            <p className="ll-muted ll-small ll-design__foot">
              <Trans id="design.footer" render={ProseWords}>
                這一頁會跟著系統一起慢慢成形。
              </Trans>
            </p>
          </div>
          <NavList
            tone="neutral"
            title={t({ id: 'design.more', message: '更多', comment: '關於系統設計頁最後一組選單列的標題' })}
            className="ll-info-nav"
            data-testid="design-more"
          >
            <NavRow
              icon={<ShieldIcon />}
              title={t({ id: 'me.privacy', message: '隱私說明', comment: '「我的」連到隱私說明' })}
              description={<Phrased text={t({ id: 'me.privacy.desc', message: '進度存在哪裡、誰看得到', comment: '「我的」隱私說明列的說明' })} />}
              href={localePath(locale, '/privacy/')}
            />
            <NavRow
              icon={<InfoIcon />}
              title={t({ id: 'me.about', message: '關於與授權', comment: '「我的」連到關於與授權' })}
              description={<Phrased text={t({ id: 'me.about.desc', message: '授權、原始碼與版本', comment: '「我的」關於與授權列的說明' })} />}
              href={localePath(locale, '/about/')}
            />
            <NavRow
              icon={<HeartIcon />}
              title={t({ id: 'me.credits', message: '幕後', comment: '「我的」連到幕後（作者、老師與技術棧）' })}
              description={<Phrased text={t({ id: 'me.credits.desc', message: '作者、老師，還有做網站的技術', comment: '「我的」幕後列的說明' })} />}
              href={localePath(locale, '/credits/')}
            />
          </NavList>
        </div>
        <nav className="ll-design__toc" aria-labelledby="ll-design-toc-title" data-testid="design-toc">
          <NavList
            tone="neutral"
            title={t({ id: 'design.toc', message: '本頁目錄', comment: '關於系統設計頁右側（1024 以上）的段落目錄標題' })}
            titleId="ll-design-toc-title"
            className="ll-design__toclist"
          >
            {sections.map((s) => (
              <NavRow
                key={s.id}
                size="compact"
                icon={s.icon}
                title={s.title}
                href={`#${anchorId(s.id)}`}
                onClick={jump(s.id)}
                current={current === s.id ? 'location' : undefined}
                chevron="none"
                data-testid={`design-toc-${s.id}`}
              />
            ))}
          </NavList>
        </nav>
      </div>
    </>
  );
}
