// 報表口徑的切換（03 第 3.13 節、05 第 12.3 節）：分段控制「教材／IFRS 對照」，群組名稱「報表口徑」。切換時自己的 live region 播報一句
// （切到 IFRS：「已切換到 IFRS 對照，不計分。和教材口徑不同的列已加上標記。」；切回教材另一句）。放在步驟頁的報表控制列、自由實驗報表區的標題旁、
// 指標實驗室的版本切換旁；勾稽練習不放。和 Segmented 一起在 lab-stages chunk（步驟頁第一波用不到）。
import { useLingui } from '@lingui/react/macro';
import { Segmented } from '@ledgerland/web-ui';
import { useState } from 'react';
import { IFRS_POLICY, TEACHER_POLICY, type LabPolicyId } from './lab-policy.ts';

export function usePolicyLabels(): Record<LabPolicyId, string> {
  const { t } = useLingui();
  return {
    'teacher@1': t({ id: 'lab.policy.teacher', message: '教材', comment: '報表口徑的選項：課程教材的版面與處理' }),
    'ifrs@1': t({ id: 'lab.policy.ifrs', message: 'IFRS 對照', comment: '報表口徑的選項：依 IFRS 重算的對照版' }),
  };
}

export function PolicyToggle({ value, onChange, className }: { value: LabPolicyId; onChange: (policy: LabPolicyId) => void; className?: string }) {
  const { t } = useLingui();
  const labels = usePolicyLabels();
  const [announce, setAnnounce] = useState('');
  return (
    <div className={`ll-lab-policy${className ? ` ${className}` : ''}`} data-testid="lab-policy">
      <Segmented
        value={value}
        options={[
          { value: TEACHER_POLICY, label: labels[TEACHER_POLICY] },
          { value: IFRS_POLICY, label: labels[IFRS_POLICY] },
        ]}
        onChange={(next) => {
          if (next === value) return;
          onChange(next);
          setAnnounce(
            next === IFRS_POLICY
              ? t({
                  id: 'lab.policy.switchedIfrs',
                  message: '已切換到 IFRS 對照，不計分。和教材口徑不同的列已加上標記。',
                  comment: '切到 IFRS 對照時的播報',
                })
              : t({ id: 'lab.policy.switchedTeacher', message: '已切換回教材口徑。', comment: '切回教材時的播報' }),
          );
        }}
        label={t({ id: 'lab.policy.toggleLabel', message: '報表口徑', comment: '口徑切換（分段控制）的群組名稱' })}
        size="sm"
      />
      <p className="ll-sr-only" aria-live="polite" data-testid="lab-policy-live">
        {announce}
      </p>
    </div>
  );
}
