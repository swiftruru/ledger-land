// 載入中的骨架（07 第 9 節）：純裝飾（aria-hidden），減少動態時不閃動（樣式在 styles.css 的 prefers-reduced-motion）
export interface SkeletonProps {
  variant?: 'text' | 'card' | 'table' | 'circle';
  /** text 變體的行數 */
  lines?: number;
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ variant = 'text', lines = 1, width, height, className }: SkeletonProps) {
  const style = { width, height };
  if (variant === 'text') {
    return (
      <div className={`ll-skeleton-lines${className ? ` ${className}` : ''}`} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="ll-skeleton ll-skeleton--text" style={i === lines - 1 && lines > 1 ? { ...style, width: width ?? '60%' } : style} />
        ))}
      </div>
    );
  }
  return <div className={`ll-skeleton ll-skeleton--${variant}${className ? ` ${className}` : ''}`} style={style} aria-hidden="true" />;
}
