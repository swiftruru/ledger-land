// 進度條（站規 1.13）：只有兩種尺寸，sm 6px（列與卡片內）、md 10px（hero 與作答頁）。軌道 --ll-surface-2、填色 --ll-star-fill
// （進度、收集、獎勵一律用星星色，accent 只給動作；紙質的填色外加 1px --ll-star-edge）。
// 條本身 aria-hidden：旁邊一定有文字（「已收進 12／99」「第 2 題，共 6 題」），螢幕閱讀器只唸文字。
// 寬度變化用 transform（填色條整條往左移出軌道，右端維持圓頭；比 scaleX 不會把圓頭壓扁），--ll-dur-base；減少動態時直接到位。
import type { CSSProperties } from 'react';

export interface ProgressBarProps {
  /** 目前的值（0 到 max） */
  value: number;
  /** 預設 1（value 是比例）；計數時傳總數 */
  max?: number;
  size?: 'sm' | 'md';
  /** 只給版面用 */
  className?: string;
  'data-testid'?: string;
}

export function ProgressBar({ value, max = 1, size = 'md', className, 'data-testid': testId }: ProgressBarProps) {
  const ratio = max > 0 && Number.isFinite(value) ? Math.min(1, Math.max(0, value / max)) : 0;
  const style = { '--ll-progress-ratio': ratio } as CSSProperties;
  return (
    <div
      className={`ll-progress ll-progress--${size}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      data-testid={testId}
      data-ratio={ratio.toFixed(3)}
    >
      <div className={`ll-progress__fill${ratio === 0 ? ' is-empty' : ''}`} style={style} />
    </div>
  );
}
