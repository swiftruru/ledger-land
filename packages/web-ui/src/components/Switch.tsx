// 設定開關（07 第 9 節）：role="switch"、aria-checked，旁邊有狀態文字「開」「關」
import { useLingui } from '@lingui/react/macro';
import { useId, type ReactNode } from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onChange, label, description, disabled, className }: SwitchProps) {
  const { t } = useLingui();
  const labelId = useId();
  const descId = `${labelId}-desc`;
  return (
    <div className={`ll-switch-row${className ? ` ${className}` : ''}`}>
      <span className="ll-switch-row__text">
        <span id={labelId} className="ll-switch-row__label">
          {label}
        </span>
        {description && (
          <span id={descId} className="ll-switch-row__desc">
            {description}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descId : undefined}
        disabled={disabled}
        className={`ll-switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="ll-switch__knob" aria-hidden="true" />
        <span className="ll-switch__state">
          {checked ? t({ id: 'switch.on', message: '開', comment: '開關的狀態文字' }) : t({ id: 'switch.off', message: '關', comment: '開關的狀態文字' })}
        </span>
      </button>
    </div>
  );
}
