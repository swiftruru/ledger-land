// 清單檢視切換（17 第 3.7 節）：工具列的圓形按鈕，aria-pressed 表示目前是清單；偏好由頁面存在 localStorage ll:map-view。
import { useLingui } from '@lingui/react/macro';
import { ListIcon, MapIcon } from './map-icons.tsx';

export interface MapListToggleProps {
  list: boolean;
  onToggle: (list: boolean) => void;
  className?: string;
}

export function MapListToggle({ list, onToggle, className }: MapListToggleProps) {
  const { t } = useLingui();
  return (
    <button
      type="button"
      className={`ll-maptool${className ? ` ${className}` : ''}`}
      aria-pressed={list}
      aria-label={t({ id: 'map.tool.list', message: '清單檢視', comment: '工具列：切換成清單檢視的按鈕' })}
      onClick={() => onToggle(!list)}
      data-testid="map-list-toggle"
    >
      {list ? <MapIcon size={22} /> : <ListIcon size={22} />}
    </button>
  );
}
