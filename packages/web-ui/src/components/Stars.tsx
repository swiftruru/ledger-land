// 星星（07 第 9 節）：0 到 3 顆，可讀名稱「3 顆星中的 2 顆」
import { useLingui } from '@lingui/react/macro';
import { StarIcon } from './icons.tsx';

export interface StarsProps {
  value: 0 | 1 | 2 | 3;
  max?: 3;
  size?: number;
  className?: string;
}

export function Stars({ value, max = 3, size = 20, className }: StarsProps) {
  const { t } = useLingui();
  const n = value;
  return (
    <span
      className={`ll-stars${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={t({ id: 'stars.label', message: `${max} 顆星中的 ${n} 顆`, comment: '星星的可讀名稱；n 是得到的顆數、max 是滿星數' })}
    >
      {Array.from({ length: max }, (_, i) => (
        <StarIcon key={i} size={size} filled={i < n} className={i < n ? 'is-on' : 'is-off'} />
      ))}
    </span>
  );
}
