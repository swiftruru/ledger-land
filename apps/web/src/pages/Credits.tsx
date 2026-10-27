// 幕後（02 第 1.1 節的 /credits/，2026-10-27）：做網站的人、教我會計的老師、技術棧探索器與五個彩蛋；找齊解鎖一枚特別徽章（03 的特別徽章，分開計數）。
// 口吻是課堂上的師生：只是致謝，不寫審閱或背書（11 第 4.7 節；老師 2026-10-27 同意具名，14 的 T34）。
// 字串在第二層 catalog（locales/*/pages.po，i18n/pages-catalog.ts 延遲載入），不進首次載入的 JS（14 第 5.2 節）。
// 頁面本身沒有任何動畫；吉祥物與徽章圖來自地圖的 chunk（useMapModule）。彩蛋狀態、徽章解鎖、地圖模組、頁面 catalog 四樣齊了才整頁出現（usePageReady）。
// 頁首 TopBar 回「我的」；不 noindex；可離線。樣式在 styles/info.css 的 .ll-credits-* 與 .ll-stack*。
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { formatNumber, localePath } from '@ledgerland/i18n';
import {
  Badge,
  Button,
  CodeIcon,
  CompassIcon,
  Disclosure,
  HeartIcon,
  InfoIcon,
  NavList,
  NavRow,
  StarIcon,
  TextLink,
  Toast,
  ToastRegion,
  TopBar,
} from '@ledgerland/web-ui';
import { useBackToMe } from '../components/useBackLabels.ts';
import { MascotEgg } from '../features/credits/MascotEgg.tsx';
import { StackExplorer } from '../features/credits/StackExplorer.tsx';
import { EGG_IDS } from '../features/credits/eggs.ts';
import { useEggs } from '../features/credits/useEggs.ts';
import { useMapModule } from '../features/credits/useMapModule.ts';
import { Phrased } from '../features/me/Phrased.tsx';
import { usePagesCatalog } from '../i18n/pages-catalog.ts';
import { usePageReady } from '../lib/page-ready.tsx';
import { useLocale } from '../lib/useLocale.ts';
import '../styles/info.css';

const AUTHOR_SITE = 'https://swift.moe';
const AUTHOR_GITHUB = 'https://github.com/swiftruru';

export default function Credits() {
  const { t } = useLingui();
  const locale = useLocale();
  const back = useBackToMe();
  const catalogReady = usePagesCatalog(locale);
  const mapMod = useMapModule();
  const { found, unlocks, celebrating, dismissCelebration, mark } = useEggs();
  const [versionOpen, setVersionOpen] = useState(false);
  const builtAt = __LL_BUILT_AT__;
  usePageReady(catalogReady && mapMod !== undefined && found !== null && unlocks !== null);

  const fmt = (n: number) => formatNumber(n, locale);
  const foundCount = found?.size ?? 0;
  const total = EGG_IDS.length;
  const complete = foundCount >= total;
  const foundText = fmt(foundCount);
  const totalText = fmt(total);
  const foundHas = (id: (typeof EGG_IDS)[number]) => found?.has(id) ?? false;
  // 五個彩蛋的提示（維護者 2026-10-27 實機回饋：沒有提示找不到；提示說「在哪裡」，不說「怎麼觸發」）
  const hintText: Record<(typeof EGG_IDS)[number], string> = {
    mascot: t({ id: 'eggs.hint.mascot', message: '作者那一段的旁邊站著鈴，跟它打個招呼。', comment: '彩蛋提示：吉祥物' }),
    version: t({ id: 'eggs.hint.version', message: '方塊板下面那一串版本號，按按看。', comment: '彩蛋提示：版本號' }),
    flavours: t({ id: 'eggs.hint.flavours', message: '畫面那一層的 tokens 面板裡有三種口味，三種都試過才算。', comment: '彩蛋提示：三種口味' }),
    offline: t({ id: 'eggs.hint.offline', message: '安裝與主機那一層的 PWA 面板裡有一個問題，問問它。', comment: '彩蛋提示：離線' }),
    dedication: t({ id: 'eggs.hint.dedication', message: '這一頁的最後一列，打開它。', comment: '彩蛋提示：頁底的一行' }),
  };

  return (
    <>
      <TopBar
        title={t({ id: 'credits.title', message: '幕後', comment: '幕後頁的標題' })}
        backHref={localePath(locale, '/me/')}
        backLabel={back.label}
        backShortLabel={back.short}
      />
      <p className="ll-lede">
        <Trans id="credits.intro" comment="幕後頁導言">
          這一頁說說做這個網站的人、教我會計的老師，還有把它做出來的工具。順便藏了幾個彩蛋。
        </Trans>
      </p>
      <div className="ll-prose">
        <h2>
          <Trans id="credits.author.title" comment="幕後頁第一節的標題">
            做網站的人
          </Trans>
        </h2>
        <p>
          <Trans id="credits.author.p1" comment="作者自我介紹第一段（第一人稱）">
            我是潘昱如（Yu-Ru
            Pan）。我喜歡把學到的東西做成可以動手玩的樣子，會計樂園就是這樣開始的：上課聽到一家小店的帳怎麼從頭記到尾，就想把它做成一關一關的遊戲。
          </Trans>
        </p>
        <p>
          <Trans id="credits.author.p2" comment="作者自我介紹第二段">
            平常寫的東西放在個人網站和 GitHub。這個網站的原始碼也在那裡，看到哪裡怪怪的歡迎告訴我。
          </Trans>
        </p>
        {mapMod !== undefined && <MascotEgg mod={mapMod} found={foundHas('mascot')} onFound={() => mark('mascot')} />}
      </div>
      <NavList
        tone="neutral"
        title={t({ id: 'credits.links.title', message: '找得到我的地方', comment: '作者連結那組選單列的標題' })}
        data-testid="credits-links"
      >
        <NavRow
          icon={<CompassIcon />}
          title={t({ id: 'credits.links.site', message: '個人網站', comment: '作者個人網站那一列的標題' })}
          description={<Phrased text={t({ id: 'credits.links.site.desc', message: 'swift.moe', comment: '作者個人網站那一列的說明（網址）' })} />}
          href={AUTHOR_SITE}
          external
        />
        <NavRow
          icon={<CodeIcon />}
          title={t({ id: 'credits.links.github', message: 'GitHub', comment: '作者 GitHub 那一列的標題' })}
          description={<Phrased text={t({ id: 'credits.links.github.desc', message: 'swiftruru，原始碼也在這裡', comment: '作者 GitHub 那一列的說明' })} />}
          href={AUTHOR_GITHUB}
          external
        />
      </NavList>
      <div className="ll-prose">
        <h2>
          <Trans id="credits.teacher.title" comment="幕後頁老師那一節的標題">
            教我會計的老師
          </Trans>
        </h2>
        <p>
          <Trans id="credits.teacher.p1" comment="老師那一節第一段（課堂師生的口吻，只致謝不背書）">
            會計是跟陳彥宏老師（Yen-Hung
            Chen）學的。老師在課堂上把一家小店的帳從頭講到尾：開店、進貨、賣東西、借錢、發薪水，每一筆怎麼記、三張報表怎麼長出來。課程和專業都是老師的；我是台下那個邊聽邊想「這可以做成遊戲」的學生。
          </Trans>
        </p>
        <p>
          <Trans id="credits.teacher.p2" comment="老師那一節第二段：內容責任歸屬">
            網站裡的題目、解說與名詞卡都是我自己寫的，寫錯是我的責任，不代表老師的觀點。故事的情境與金額經老師授權使用，細節寫在「關於與授權」。
          </Trans>
        </p>
        <p>
          <Trans id="credits.teacher.p3" comment="老師那一節第三段：致謝">
            謝謝老師同意我把名字寫在這裡。
          </Trans>
        </p>
        <h2>
          <Trans id="credits.stack.title" comment="技術棧那一節的標題">
            這個網站是用什麼做的
          </Trans>
        </h2>
        <p>
          <Trans id="credits.stack.intro" comment="技術棧那一節的引言">
            下面每個方塊都是真的在用的東西，點一個就知道它負責什麼、和誰搭配。版本號是建置時從套件清單抄來的，不會過期。
          </Trans>
        </p>
        <p className="ll-credits-eggs" data-testid="eggs-progress">
          <Badge kind="star">
            {t({ id: 'eggs.progress', message: `彩蛋 ${foundText}／${totalText}`, comment: '彩蛋進度膠囊；foundText、totalText 已格式化' })}
          </Badge>
          <span className="ll-small ll-muted">
            {complete
              ? t({ id: 'eggs.progress.done', message: '全部找到了，特別徽章放在徽章頁。', comment: '彩蛋找齊之後的說明' })
              : t({ id: 'eggs.progress.hint', message: '這一頁藏了幾個彩蛋，找齊會有一枚特別徽章。', comment: '彩蛋還沒找齊時的說明' })}
          </span>
        </p>
      </div>
      <Disclosure
        variant="plain"
        className="ll-credits-hints"
        icon={<StarIcon />}
        summary={t({ id: 'eggs.hints.title', message: '彩蛋藏在哪裡？給點提示', comment: '彩蛋提示摺疊列的標題' })}
        data-testid="eggs-hints"
      >
        <ul className="ll-list ll-credits-hints__list">
          {EGG_IDS.map((id) => (
            <li key={id} data-egg={id} data-found={foundHas(id) ? 'true' : 'false'}>
              <Badge kind={foundHas(id) ? 'success' : 'neutral'}>
                {foundHas(id)
                  ? t({ id: 'eggs.hints.found', message: '找到了', comment: '彩蛋提示清單：這一個已經找到' })
                  : t({ id: 'eggs.hints.notYet', message: '還沒', comment: '彩蛋提示清單：這一個還沒找到' })}
              </Badge>{' '}
              <Phrased text={hintText[id]} />
            </li>
          ))}
        </ul>
      </Disclosure>
      <StackExplorer onEgg={mark} />
      <div className="ll-prose">
        <p className="ll-credits-version">
          <Button
            variant="quiet"
            size="sm"
            onClick={() => {
              setVersionOpen(true);
              mark('version');
            }}
            data-testid="egg-version"
          >
            <span className="ll-num">{__LL_APP_VERSION__}</span>
            <span className="ll-sr-only">
              {t({ id: 'eggs.version.name', message: '，按一下看版本號的祕密', comment: '版本號按鈕給螢幕閱讀器唸的後綴（彩蛋）' })}
            </span>
          </Button>
        </p>
        {versionOpen && (
          <p className="ll-small ll-muted" role="status" data-testid="egg-version-text">
            <Phrased
              text={t({
                id: 'eggs.version.text',
                message: `版本號後面那一小段是 git commit 的代號，每次建置都不一樣。這一版是 ${builtAt} 建的。`,
                comment: '按了版本號之後的說明；builtAt 是建置時間',
              })}
            />
          </p>
        )}
        <h2>
          <Trans id="credits.values.title" comment="設計堅持那一節的標題">
            幾個不肯讓步的地方
          </Trans>
        </h2>
        <ul className="ll-list">
          <li>
            <Trans id="credits.values.noAccount">不用帳號、不用伺服器：進度存在你自己的裝置裡，誰都看不到。</Trans>
          </li>
          <li>
            <Trans id="credits.values.offline">離線也能整章作答：裝好之後搭捷運也能玩。</Trans>
          </li>
          <li>
            <Trans id="credits.values.integer">金額一律整數：報表不會出現一塊錢的差。</Trans>
          </li>
          <li>
            <Trans id="credits.values.oneKit">全站只有一套可以點的東西：按鈕、連結、選單列長得都一樣，看一眼就知道哪裡可以按。</Trans>
          </li>
        </ul>
        <p>
          <Trans id="credits.values.more" comment="設計堅持那一節最後一句；<0> 是連到「關於系統設計」的連結">
            更完整的設計筆記在<TextLink href={localePath(locale, '/design/')}>關於系統設計</TextLink>。
          </Trans>
        </p>
      </div>
      <NavList
        tone="neutral"
        title={t({ id: 'credits.more', message: '更多', comment: '幕後頁最後一組選單列的標題' })}
        className="ll-info-nav"
        data-testid="credits-more"
      >
        <NavRow
          icon={<InfoIcon />}
          title={t({ id: 'me.about', message: '關於與授權', comment: '「我的」連到關於與授權' })}
          description={<Phrased text={t({ id: 'me.about.desc', message: '授權、原始碼與版本', comment: '「我的」關於與授權列的說明' })} />}
          href={localePath(locale, '/about/')}
        />
        <NavRow
          icon={<CompassIcon />}
          title={t({ id: 'me.design', message: '關於系統設計', comment: '「我的」連到關於系統設計' })}
          description={<Phrased text={t({ id: 'me.design.desc', message: '這個網站怎麼設計出來的', comment: '「我的」關於系統設計列的說明' })} />}
          href={localePath(locale, '/design/')}
        />
      </NavList>
      <Disclosure
        variant="plain"
        className="ll-credits-dedication"
        icon={<HeartIcon />}
        summary={t({ id: 'eggs.dedication.name', message: '寫給一路幫忙的人', comment: '頁底摺疊列的標題（彩蛋）' })}
        onToggle={(open) => open && mark('dedication')}
        data-testid="egg-dedication"
      >
        <p>
          <Trans id="eggs.dedication.text" comment="頁底摺疊列展開後的話">
            謝謝老師把會計講成一個聽得懂的故事；謝謝課堂上每一個舉手發問的人，你們的問題變成了很多題目；也謝謝看到這裡的你。
          </Trans>
        </p>
      </Disclosure>
      <ToastRegion className="ll-credits-toasts" data-testid="credits-toasts">
        {celebrating && (
          <Toast
            kind="collect"
            media={mapMod ? <mapMod.SpecialBadge state="done" size={34} /> : undefined}
            title={t({ id: 'eggs.badge.title', message: '取得特別徽章', comment: '找齊彩蛋時的提示標題；第二行是徽章名稱' })}
            onDismiss={dismissCelebration}
          >
            {t({ id: 'eggs.badge.name', message: '幕後偵探', comment: '找齊彩蛋解鎖的特別徽章名稱（徽章頁同名）' })}
          </Toast>
        )}
      </ToastRegion>
    </>
  );
}
