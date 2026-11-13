// 錯題複習的階段說明（2026-11-13）：確認答案後，回饋面板的正解行下面多一行，說這一題現在在哪個階段、離熟練還差什麼。
// 只有答錯過的題才有（沒答錯過的題答對了不必多說）；內容由這一題最新的累計算出來（features/exam/stats.ts）。
import { useLingui } from '@lingui/react/macro';
import { formatNumber } from '@ledgerland/i18n';
import { useLocale } from '../../lib/useLocale.ts';
import type { QuestionState } from './db.ts';
import { deviceClock } from './day.ts';
import { nextStepOf } from './stats.ts';

export interface StageNoteProps {
  /** 這一題確認之後的累計 */
  state: QuestionState | undefined;
  /** 這一次答對了沒 */
  correct: boolean;
}

export function StageNote({ state, correct }: StageNoteProps) {
  const { t } = useLingui();
  const locale = useLocale();
  if (!state || state.wrong === 0) return null;
  const n = (x: number) => formatNumber(x, locale);
  let text: string;
  if (!correct) {
    text =
      state.wrong === 1
        ? t({ id: 'exam.stage.firstWrong', message: '放進錯題複習了，之後會再安排你練這一題。', comment: '確認答案後的階段說明：第一次答錯' })
        : t({
            id: 'exam.stage.repeatWrong',
            message: `這一題第 ${n(state.wrong)} 次答錯，會多安排幾次練習。`,
            comment: '確認答案後的階段說明：再次答錯；count 是累計答錯次數（已格式化）',
          });
  } else {
    const step = nextStepOf(state, deviceClock());
    if (step === null) {
      text = t({ id: 'exam.stage.mastered', message: '熟練了，這一題從錯題複習畢業。', comment: '確認答案後的階段說明：答錯過的題達到熟練' });
    } else if (step.tomorrow) {
      text = t({
        id: 'exam.stage.tomorrow',
        message: '今天先到這裡，明天再答對一次就熟練。',
        comment: '確認答案後的階段說明：反覆答錯的題當天已經連對，剩下要隔天再答對一次',
      });
    } else if (state.streak === 1) {
      text = t({
        id: 'exam.stage.fixed',
        message: `訂正成功，再連對 ${n(step.more)} 次就熟練。`,
        comment: '確認答案後的階段說明：答錯之後第一次答對；more 是還要連對幾次（已格式化）',
      });
    } else {
      text = t({
        id: 'exam.stage.more',
        message: `再連對 ${n(step.more)} 次就熟練。`,
        comment: '確認答案後的階段說明：複習中又答對一次；more 是還要連對幾次（已格式化）',
      });
    }
  }
  return (
    <p className="ll-exam-stage-note" data-testid="exam-stage-note">
      {text}
    </p>
  );
}
