// 章末區（圖規第 4.5 節、站規 1.20 與 0.4 第 5 列）：拱門跨在出口走廊上，紙籤在走廊的另一側，兩者都立在地景上。
// 拱門：兩個台座、兩根柱子、半圓拱、拱心石與地面陰影，內部透明（道路從開口穿過）。完成時多一條強調色彩帶與兩面三角旗，
// 精通時彩帶換成星星色、拱心石換成星形；最後一章的拱心石換成終點旗（路線停在拱門中心）。
// 紙籤：左欄 40px 徽章（未取得是灰階外框），右欄「第 N 章終點」或「第 N 章完成」、徽章文字，有實驗室步驟時加一顆 quiet sm 按鈕；
// 紙籤窄到文字欄放不下（文字放大）時，徽章縮成 32px 自成一列（CSS container query）。
// 徽章文字只看徽章狀態（finding map-4）：內容新增關卡後 completed 可能是 false，但已取得的徽章仍是已取得；第一行的「完成」與拱門彩帶看 completed。
// 剛完成時（?from 跨章、角色在拱門下停頓）紙籤第一行與拱心石一起彈出；減少動態時不播。位置由頁面以 style 指定（幾何在 apps/web 的 layout.ts）。
import { Trans, useLingui } from '@lingui/react/macro';
import type { CSSProperties } from 'react';
import { Button } from './Button.tsx';
import { ChapterBadge, starPath, type ChapterBadgeState } from './ChapterBadge.tsx';
import { useChapterLabels } from './ChapterBanner.tsx';
import { FlaskIcon } from './icons.tsx';

export interface ChapterEndProps {
  chapterNo: number;
  extension?: boolean;
  completed: boolean;
  badgeTitle?: string;
  /** 徽章外觀；省略時依 completed 推（完成或未取得） */
  badgeState?: ChapterBadgeState;
  /** 地圖的最後一章：拱心石換成終點旗 */
  last?: boolean;
  /** 剛完成時的慶祝狀態（?from 跨章時由頁面短暫設為 true） */
  celebrating?: boolean;
  /** 相關實驗室步驟的連結（已經由 localePath 產生、帶結尾斜線）；空的或省略就不顯示按鈕 */
  labLinks?: readonly { href: string }[];
  /** 外層（章末區）的位置 */
  style?: CSSProperties;
  /** 拱門（96 × 104）與紙籤在章末區裡的位置 */
  archStyle?: CSSProperties;
  plaqueStyle?: CSSProperties;
  /**
   * 文字放大時紙籤貼齊章末區上緣（和下一章的章節牌成對），下面接一根立在地上的長柱子（取代 16px 的木樁）：柱子的位置與高度。
   * 柱子畫在紙籤後面，看得到的是紙籤下緣到地面那一段
   */
  postStyle?: CSSProperties;
  className?: string;
}

/**
 * 拱門 96 × 104（圖規第 4.5 節）：台座 24 × 10、柱子 14 寬、拱外半徑 41 內半徑 27（開口 54）。
 * 拱門整個畫在路線之上（拱門 z 3、路線 z 2），只有地面陰影（ll-chend__floor，另一個元素）在路的下面（第 2 輪看圖驗收）。
 * 讀起來要是「跨在路上」的石門：拱心石 20 × 16 往上提（y −6 到 10），拱頂的石帶（y 10 到 17）與完成時的彩帶在拱心石下方整條橫過路面，
 * 路面只從開口裡露出來；拱體外緣多一條 2px 較淺的頂面線，看得出是石頭。完成時兩根柱頂（拱肩）各立一支 2 × 12 的旗桿，10 × 8 的三角旗朝外飄。
 * 第 3 輪看圖驗收（未完成的拱門是唯一沒有實物感的地標）：石材用專用的深石色、兩根柱身各兩道 1px 石縫（y 60、76）；
 * 未完成時拱心石上一個 10px 的淡色徽章外框（還沒取得的徽章放在這裡），讀得出是「終點門」而不是裝飾。
 * 第 4 輪看圖驗收（拱門讀成「被緞帶串穿的馬蹄形磁鐵」：拱門其實畫在路線之上，但 20px 寬的拱心石和 20px 寬的路面同寬、
 * 正好疊在路的中線上，路面在拱心石上下各露一截，眼睛把三段接成一條穿過拱頂的路）：
 * 拱心石改成上寬 26、下寬 16 的楔形，大半疊在拱頂外緣之上（拱頂在路面上方露出 10px 石材，完成時彩帶也整條橫過路面）；開口裡拱頂下方畫一道 7px 的拱腹陰影（彎月形），
 * 整個門洞再鋪一層由上往下漸淡的陰影（.ll-chend__arch::before，CSS 漸層裁成門洞的形狀），蓋在路面上：路是走進門洞、從拱頂底下穿過去的。
 */
/** 楔形拱心石：上緣 x 35 到 61（y −9）、下緣 x 40 到 56（y 7），大半在拱頂外緣之上；拱頂在路面上方露出 10px 石材（y 7 到 17），轉角由 1.5px 描邊的圓角接合收圓 */
const KEY = 'M35-9H61L56 7H40Z';

function Arch({ state, completed, last }: { state: ChapterBadgeState; completed: boolean; last: boolean }) {
  const ribbon = completed || state !== 'locked';
  const mastery = state === 'mastery';
  return (
    <svg className="ll-chend__arch-svg" width="96" height="104" viewBox="0 0 96 104" aria-hidden="true" focusable="false" overflow="visible">
      <path className="ll-chend__stone" d="M7 94V44a41 41 0 0 1 82 0v50H75V44a27 27 0 0 0-54 0v50Z" />
      {/* 拱腹陰影：內弧與它往下平移 7px 的弧之間（中央 7px、兩端收成 0），蓋在開口裡的路面上 */}
      <path className="ll-chend__soffit" d="M21 44a27 27 0 0 1 54 0v7a27 27 0 0 0-54 0Z" />
      <path className="ll-chend__crest" d="M9.6 92V44a38.4 38.4 0 0 1 76.8 0v48" />
      <path className="ll-chend__joint" d="M7.75 60h12.5M7.75 76h12.5M75.75 60h12.5M75.75 76h12.5" />
      <rect className="ll-chend__stone" x="2" y="92" width="24" height="10" rx="3" />
      <rect className="ll-chend__stone" x="70" y="92" width="24" height="10" rx="3" />
      {ribbon && <path className={`ll-chend__ribbon${mastery ? ' is-mastery' : ''}`} d="M14 44a34 34 0 0 1 68 0" />}
      {ribbon && (
        <g className={`ll-chend__pennants${mastery ? ' is-mastery' : ''}`}>
          <path className="ll-chend__pole" d="M14 21.5V8M82 21.5V8" />
          <path className="ll-chend__pennant" d="M13 8.5 3 12.5l10 4Z" />
          <path className="ll-chend__pennant" d="M83 8.5l10 4-10 4Z" />
        </g>
      )}
      {last ? (
        <g className="ll-chend__flag">
          <path className="ll-chend__key" d={KEY} />
          <path className="ll-chend__pole" d="M48 -9V-30" />
          <path className={`ll-chend__flagcloth${ribbon ? ' is-done' : ''}`} d="M48.8-30h15l-4 5 4 5h-15Z" />
        </g>
      ) : mastery ? (
        // 精通：拱心石照樣在，石面上嵌一顆星
        <g className="ll-chend__keymark">
          <path className="ll-chend__key is-done" d={KEY} />
          <path className="ll-chend__keystar" d={starPath(48, -0.6, 6.5)} />
        </g>
      ) : ribbon ? (
        <path className="ll-chend__key is-done" d={KEY} />
      ) : (
        <g className="ll-chend__keymark">
          <path className="ll-chend__key" d={KEY} />
          <circle className="ll-chend__slot" cx="48" cy="-1" r="4" />
        </g>
      )}
    </svg>
  );
}

export function ChapterEnd({
  chapterNo,
  extension,
  completed,
  badgeTitle,
  badgeState,
  last = false,
  celebrating,
  labLinks,
  style,
  archStyle,
  plaqueStyle,
  postStyle,
  className,
}: ChapterEndProps) {
  const { t } = useLingui();
  const labels = useChapterLabels();
  const chapter = extension ? labels.extChapter(chapterNo) : labels.chapter(chapterNo);
  const state: ChapterBadgeState = badgeState ?? (completed ? 'done' : 'locked');
  const text = completed
    ? t({ id: 'map.end.completed', message: `${chapter}完成`, comment: '章末紙籤：本章已完成；chapter 是「第 N 章」' })
    : t({ id: 'map.end.goal', message: `${chapter}終點`, comment: '章末紙籤：本章尚未完成；chapter 是「第 N 章」，英文寫成 End of Chapter N' });
  // 徽章名稱（含引號）包成一個 inline-block：整組一起換行，不會斷成「開店/了」（第 1 輪看圖驗收）；前面的「可獲得徽章」「精通徽章」
  // 照全站規則逐字換行（2026-10-27 起）。名稱比一行長時在內容放的 U+200B（「看懂」「股東權益」「與融資」之間）或任何字之間斷，
  // 名稱加全站的 .ll-phrased（overflow-wrap: anywhere），不撐破紙籤。
  // inline-block 和地圖標題的子句共用 .ll-phrased__clause（第 8 輪，CSS 預算）。ll-chend__name 沒有自己的規則，但不能拿掉：class 名稱含 name，
  // 全站換行規則（03-core-utils.css 的 [class*='name']）靠它讓英文徽章名在窄紙籤裡不斷字（「Book-／keeper」）；單元測試也用它找名稱
  const badgeText = badgeTitle ? (
    state === 'mastery' ? (
      <Trans id="map.end.badgeMastery" comment="章末區已達精通的徽章；badgeTitle 是徽章名稱，<0> 包住名稱（整組一起換行）">
        精通徽章：<span className="ll-chend__name ll-phrased__clause ll-phrased">{badgeTitle}</span>
      </Trans>
    ) : state === 'done' ? (
      <Trans id="map.end.badgeGot" comment="章末區已取得的徽章；badgeTitle 是徽章名稱，<0> 包住名稱（整組一起換行）">
        徽章：<span className="ll-chend__name ll-phrased__clause ll-phrased">{badgeTitle}</span>
      </Trans>
    ) : (
      <Trans id="map.end.badgeAhead" comment="章末區尚未取得的徽章；badgeTitle 是徽章名稱，<0> 包住引號與名稱（整組一起換行）；英文用英式彎引號">
        可獲得徽章<span className="ll-chend__name ll-phrased__clause ll-phrased">「{badgeTitle}」</span>
      </Trans>
    )
  ) : null;
  return (
    <div
      className={`ll-chend${completed ? ' is-done' : ''}${celebrating ? ' is-celebrating' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      data-testid="chapter-end"
      data-badge-state={state}
    >
      {/* 拱門的地面陰影：另一個元素，地圖頁把它放在路線下面（拱門本體在路線上面） */}
      <div className="ll-chend__floor" style={archStyle} aria-hidden="true">
        <svg width="96" height="104" viewBox="0 0 96 104" focusable="false" overflow="visible">
          <ellipse className="ll-chend__ground" cx="48" cy="103" rx="52" ry="5" />
        </svg>
      </div>
      <div className="ll-chend__arch" style={archStyle}>
        <Arch state={state} completed={completed} last={last} />
      </div>
      {postStyle && <div className="ll-chend__post" style={postStyle} aria-hidden="true" />}
      {/* 紙籤：外層是卡片（container），內層 body 才是格線，窄的時候（文字放大）徽章自成一列、文字拿到整張卡寬 */}
      <div className={`ll-chend__plaque${badgeTitle ? '' : ' ll-chend__plaque--plain'}${postStyle ? ' ll-chend__plaque--post' : ''}`} style={plaqueStyle}>
        <div className="ll-chend__body">
          {badgeTitle && <ChapterBadge className="ll-chend__medal" state={state} size={40} />}
          <div className="ll-chend__lines">
            <p className="ll-chend__text">{text}</p>
            {badgeText && <p className="ll-chend__badge">{badgeText}</p>}
            {labLinks && labLinks.length > 0 && (
              <div className="ll-chend__lab" data-testid="chapter-end-lab">
                {labLinks.map((l) => (
                  <Button key={l.href} variant="quiet" size="sm" icon={<FlaskIcon />} href={l.href} className="ll-chend__labbtn">
                    {t({ id: 'map.end.labLink', message: '到實驗室看這一章的故事步驟', comment: '章末紙籤連到實驗室故事步驟的按鈕' })}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
