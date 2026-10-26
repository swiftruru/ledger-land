// 角色標記（17 第 3.6 節）：金幣少女「鈴／Rin」的 M3 定稿，站在目前關卡的節點上。純裝飾（aria-hidden），狀態由節點的可讀名稱表達。
// 造型依 2026-10-21 的決定：金色幣面有外圈、內圈與一道斜斜的高光；大而圓的眼睛加兩層高光與兩根小睫毛、腮紅、小小的微笑；纖細的手臂與小鞋子；
// 頭上歪戴一頂迷你高禮帽，帽帶上有蝴蝶結。姿勢：托腮（招牌）、雙手交握、小小揮手；表情：微笑、答對時的笑眼加星光（星光的閃爍在減少動態時停止，styles.css）。
// 顏色全用 tokens：幣身 --ll-star 系（較深一階與高光用 color-mix 推導）、帽子與鞋子主題強調色、臉部墨色在 styles.css 依主題換成深色 token。
import type { CSSProperties, Ref } from 'react';

export type MarkerPose = 'cheek' | 'clasp' | 'wave';
export type MarkerExpression = 'smile' | 'joy';

export interface MapMarkerProps {
  pose?: MarkerPose;
  expression?: MarkerExpression;
  size?: number;
  style?: CSSProperties;
  className?: string;
  /** 地圖移動角色時要直接拿到 svg 元素（Web Animations） */
  ref?: Ref<SVGSVGElement>;
  /**
   * 站在地圖節點上（地圖頁用）：畫面往下移 15.5 個單位，鞋底貼齊外框底邊（離目前關卡的外圈 4px）（原本下緣留了約 5px 空白，鈴看起來飄在節點上方），
   * 腳下的影子移到外框底邊之下、碰到目前關卡外圈的上緣，讀起來是踩在圓盤上（第 1 輪看圖驗收）。外框大小與位置不變。
   */
  grounded?: boolean;
}

const CX = 80;
const CY = 92;
const R = 44;
const ARM = { fill: 'none', stroke: 'var(--ll-mk-gold-2)', strokeWidth: 5, strokeLinecap: 'round' as const };
const HAND = { fill: 'var(--ll-mk-gold)', stroke: 'var(--ll-mk-gold-2)', strokeWidth: 1.5 };

function Arms({ pose }: { pose: MarkerPose }) {
  const leftDown = (
    <>
      <path d={`M${CX - R + 4} ${CY + 10} q-6 18 4 26`} {...ARM} />
      <circle cx={CX - R + 9} cy={CY + 38} r="5.5" {...HAND} />
    </>
  );
  if (pose === 'clasp')
    return (
      <>
        <path d={`M${CX - R + 4} ${CY + 10} q2 26 32 28`} {...ARM} />
        <path d={`M${CX + R - 4} ${CY + 10} q-2 26 -32 28`} {...ARM} />
        <circle cx={CX - 5} cy={CY + 39} r="5.5" {...HAND} />
        <circle cx={CX + 5} cy={CY + 39} r="5.5" {...HAND} />
      </>
    );
  if (pose === 'wave')
    return (
      <>
        {leftDown}
        <path d={`M${CX + R - 4} ${CY + 8} q16 -8 12 -28`} {...ARM} />
        <circle cx={CX + R + 8} cy={CY - 22} r="5.5" {...HAND} />
        <path
          d={`M${CX + R + 18} ${CY - 30} a10 10 0 0 1 2 10 M${CX + R + 24} ${CY - 36} a16 16 0 0 1 3 16`}
          fill="none"
          stroke="var(--ll-mk-ink)"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.6"
        />
      </>
    );
  // 托腮：左手垂下，右手托著右臉頰
  return (
    <>
      {leftDown}
      <path d={`M${CX + R - 3} ${CY + 14} q6 12 -14 2`} {...ARM} />
      <circle cx={CX + 27} cy={CY + 16} r="5.5" {...HAND} />
    </>
  );
}

function Face({ expression }: { expression: MarkerExpression }) {
  const ink = 'var(--ll-mk-ink)';
  return (
    <g transform={`translate(${CX} ${CY + 3})`}>
      <ellipse cx="-25" cy="9" rx="7.5" ry="4.5" fill="var(--ll-highlight-ring)" opacity="0.75" />
      <ellipse cx="25" cy="9" rx="7.5" ry="4.5" fill="var(--ll-highlight-ring)" opacity="0.75" />
      {expression === 'joy' ? (
        <>
          <path d="M-21 0 q7 -11 14 0 M7 0 q7 -11 14 0" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d="M-7 8 q7 11 14 0Z" fill={ink} />
        </>
      ) : (
        <>
          <ellipse cx="-14" cy="-2" rx="7.5" ry="9.5" fill={ink} />
          <ellipse cx="14" cy="-2" rx="7.5" ry="9.5" fill={ink} />
          <circle cx="-11" cy="-6" r="3" fill="var(--ll-mk-white)" />
          <circle cx="17" cy="-6" r="3" fill="var(--ll-mk-white)" />
          <circle cx="-16.5" cy="2" r="1.5" fill="var(--ll-mk-white)" />
          <circle cx="11.5" cy="2" r="1.5" fill="var(--ll-mk-white)" />
          <path d="M-5 11 q5 6 10 0" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}
      <path d="M-21 -9 l-4 -3 M-19 -12 l-2.5 -4 M21 -9 l4 -3 M19 -12 l2.5 -4" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
}

const SPARK = 'M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2Z';

export function MapMarker({ pose = 'cheek', expression = 'smile', size = 76, style, className, ref, grounded = false }: MapMarkerProps) {
  return (
    <svg
      ref={ref}
      className={`ll-marker ll-marker--${pose} ll-marker--${expression}${grounded ? ' ll-marker--grounded' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      width={size}
      height={size}
      viewBox={grounded ? '0 -15.5 160 160' : '0 0 160 160'}
      aria-hidden="true"
      focusable="false"
      data-testid="map-marker"
      data-pose={pose}
      data-expression={expression}
    >
      {/* 影子與鞋子（鞋子與帽子同色） */}
      {grounded ? (
        <ellipse cx={CX} cy={CY + R + 16} rx="26" ry="7" fill="var(--ll-mk-ink)" opacity="0.16" />
      ) : (
        <ellipse cx={CX} cy={CY + R + 7} rx="22" ry="3.5" fill="var(--ll-mk-ink)" opacity="0.12" />
      )}
      <ellipse cx={CX - 13} cy={CY + R + 4} rx="7.5" ry="4.5" fill="var(--ll-accent)" />
      <ellipse cx={CX + 13} cy={CY + R + 4} rx="7.5" ry="4.5" fill="var(--ll-accent)" />
      <ellipse cx={CX - 15} cy={CY + R + 2.5} rx="3" ry="1.3" fill="var(--ll-mk-white)" opacity="0.5" />
      <ellipse cx={CX + 11} cy={CY + R + 2.5} rx="3" ry="1.3" fill="var(--ll-mk-white)" opacity="0.5" />
      {/* 幣身：外圈、幣面、內環、斜斜的高光 */}
      <circle cx={CX} cy={CY} r={R} fill="var(--ll-mk-gold-2)" />
      <circle cx={CX} cy={CY - 2} r={R - 3.5} fill="var(--ll-mk-gold)" />
      <circle cx={CX} cy={CY - 2} r={R - 12} fill="none" stroke="var(--ll-mk-gold-2)" strokeWidth="2.5" opacity="0.6" />
      <path d={`M${CX - 26} ${CY - 24} q10 -13 24 -14`} fill="none" stroke="var(--ll-mk-gold-3)" strokeWidth="6" strokeLinecap="round" />
      <Face expression={expression} />
      <Arms pose={pose} />
      {/* 迷你高禮帽：歪戴、帽帶加蝴蝶結 */}
      <g transform={`translate(${CX + 13} ${CY - R + 3}) rotate(10)`}>
        <rect x="-22" y="-30" width="44" height="30" rx="6" fill="var(--ll-accent)" />
        <rect x="-22" y="-10" width="44" height="7" fill="var(--ll-mk-white)" opacity="0.9" />
        <rect x="-32" y="-3" width="64" height="7" rx="3.5" fill="var(--ll-accent-pressed)" />
        <path d="M-16 -27 q10 -4 22 0" fill="none" stroke="var(--ll-mk-white)" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
        <g transform="translate(13 -6.5)">
          <path d="M0 0 q-8 -7 -9 -1 q-1 7 9 1Z M0 0 q8 -7 9 -1 q1 7 -9 1Z" fill="var(--ll-highlight-ring)" />
          <circle cx="0" cy="0" r="2.2" fill="var(--ll-accent-pressed)" />
        </g>
      </g>
      {/* 答對時的星光 */}
      {expression === 'joy' && (
        <g className="ll-marker__sparks" fill="var(--ll-star)" stroke="var(--ll-mk-gold-2)" strokeWidth="1">
          <path className="ll-marker__spark" d={SPARK} transform="translate(22 48)" />
          <path className="ll-marker__spark" d={SPARK} transform="translate(142 34) scale(0.8)" />
          <path className="ll-marker__spark" d={SPARK} transform="translate(134 78) scale(0.6)" />
        </g>
      )}
    </svg>
  );
}
