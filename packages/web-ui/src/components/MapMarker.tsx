// 角色標記（17 第 3.6 節）：金幣少女「鈴」的 M2 幾何簡化版，站在目前關卡的節點上。純裝飾（aria-hidden），狀態由節點的可讀名稱表達。
// 顏色全用 tokens：幣身 --ll-star 系（較深一階與高光用 color-mix 推導）、帽子與鞋子主題強調色、臉部墨色在 styles.css 依主題換成深色 token。
// 草圖來源：本機 prototypes 的金幣少女 coin3（三種姿勢：交握、揮手、托腮）；M2 用「托腮」姿勢，M3 定稿時只柔化線條與比例。
import type { CSSProperties } from 'react';

export type MarkerPose = 'cheek' | 'wave' | 'shy';

export interface MapMarkerProps {
  pose?: MarkerPose;
  size?: number;
  style?: CSSProperties;
  className?: string;
}

const CX = 80;
const CY = 92;
const R = 44;

function limbs(pose: MarkerPose) {
  const arm = { fill: 'none', stroke: 'var(--ll-mk-gold-2)', strokeWidth: 4.5, strokeLinecap: 'round' as const };
  const hand = { fill: 'var(--ll-mk-gold)', stroke: 'var(--ll-mk-gold-2)', strokeWidth: 1.5 };
  if (pose === 'shy')
    return (
      <>
        <path d={`M${CX - R + 2} ${CY + 12} q2 20 20 22`} {...arm} />
        <path d={`M${CX + R - 2} ${CY + 12} q-2 20 -20 22`} {...arm} />
        <circle cx={CX - 5} cy={CY + 35} r="5" {...hand} />
        <circle cx={CX + 5} cy={CY + 35} r="5" {...hand} />
      </>
    );
  if (pose === 'wave')
    return (
      <>
        <path d={`M${CX - R + 2} ${CY + 12} q-4 16 6 24`} {...arm} />
        <circle cx={CX - R + 9} cy={CY + 38} r="5" {...hand} />
        <path d={`M${CX + R - 2} ${CY + 10} q14 -6 12 -24`} {...arm} />
        <circle cx={CX + R + 9} cy={CY - 16} r="5" {...hand} />
      </>
    );
  return (
    <>
      <path d={`M${CX - R + 2} ${CY + 12} q-4 16 6 24`} {...arm} />
      <circle cx={CX - R + 9} cy={CY + 38} r="5" {...hand} />
      <path d={`M${CX + R - 2} ${CY + 14} q4 8 -8 2`} {...arm} />
      <circle cx={CX + R - 14} cy={CY + 14} r="5" {...hand} />
    </>
  );
}

export function MapMarker({ pose = 'cheek', size = 76, style, className }: MapMarkerProps) {
  return (
    <svg
      className={`ll-marker${className ? ` ${className}` : ''}`}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 160 160"
      aria-hidden="true"
      focusable="false"
      data-testid="map-marker"
    >
      {/* 鞋子（與帽子同色） */}
      <ellipse cx={CX - 13} cy={CY + R + 4} rx="7" ry="4" fill="var(--ll-accent)" />
      <ellipse cx={CX + 13} cy={CY + R + 4} rx="7" ry="4" fill="var(--ll-accent)" />
      {/* 幣身：外圈、內圈、內環、高光 */}
      <circle cx={CX} cy={CY} r={R} fill="var(--ll-mk-gold-2)" />
      <circle cx={CX} cy={CY - 2} r={R - 3} fill="var(--ll-mk-gold)" />
      <circle cx={CX} cy={CY - 2} r={R - 12} fill="none" stroke="var(--ll-mk-gold-2)" strokeWidth="3" opacity="0.7" />
      <path d={`M${CX - 25} ${CY - 25} q10 -12 23 -13`} fill="none" stroke="var(--ll-mk-gold-3)" strokeWidth="6" strokeLinecap="round" />
      {/* 臉：眼睛加高光與睫毛、腮紅、微笑 */}
      <g transform={`translate(${CX} ${CY + 3})`}>
        <ellipse cx="-14" cy="-2" rx="7.5" ry="9.5" fill="var(--ll-mk-ink)" />
        <ellipse cx="14" cy="-2" rx="7.5" ry="9.5" fill="var(--ll-mk-ink)" />
        <circle cx="-11" cy="-6" r="3" fill="var(--ll-mk-white)" />
        <circle cx="17" cy="-6" r="3" fill="var(--ll-mk-white)" />
        <path d="M-21 -9 l-4 -3 M-19 -12 l-2.5 -4 M21 -9 l4 -3 M19 -12 l2.5 -4" stroke="var(--ll-mk-ink)" strokeWidth="1.8" strokeLinecap="round" />
        <ellipse cx="-25" cy="8" rx="7" ry="4" fill="var(--ll-highlight-ring)" opacity="0.8" />
        <ellipse cx="25" cy="8" rx="7" ry="4" fill="var(--ll-highlight-ring)" opacity="0.8" />
        <path d="M-5 11 q5 6 10 0" fill="none" stroke="var(--ll-mk-ink)" strokeWidth="2.6" strokeLinecap="round" />
      </g>
      {limbs(pose)}
      {/* 迷你高禮帽，歪戴，帽帶加蝴蝶結 */}
      <g transform={`translate(${CX + 13} ${CY - R + 3}) rotate(10)`}>
        <rect x="-22" y="-28" width="44" height="28" rx="4" fill="var(--ll-accent)" />
        <rect x="-22" y="-9" width="44" height="7" fill="var(--ll-surface)" />
        <rect x="-31" y="-2" width="62" height="7" rx="3.5" fill="var(--ll-accent-pressed)" />
        <path transform="translate(12 -6)" d="M0 0 l-8 -5 l0 10 Z M0 0 l8 -5 l0 10 Z" fill="var(--ll-highlight-ring)" />
      </g>
    </svg>
  );
}
