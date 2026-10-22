// 作答示範頁（M0b 範圍第 4 項）：作答狀態放在路由外的 store，在中文網址與 /en/ 網址之間切換時題目、已選選項、計時與捲動位置都保留。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Card, ChoiceGroup, FeedbackPanel } from '@ledgerland/web-ui';
import { LangSwitch } from '../components/LangSwitch.tsx';
import { DEMO_LEVEL_ID, DEMO_QUESTION } from '../content/sample.ts';
import { renderText } from '../lib/text.ts';
import { useLocale } from '../lib/useLocale.ts';
import { useQuiz } from '../store/quiz.ts';
import { NotFound } from './NotFound.tsx';

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function Level() {
  const { levelId } = useParams();
  const locale = useLocale();
  const { t } = useLingui();
  const quiz = useQuiz();
  const [, setTick] = useState(0);
  const valid = levelId === DEMO_LEVEL_ID;

  useEffect(() => {
    if (valid) useQuiz.getState().start(DEMO_LEVEL_ID, DEMO_QUESTION.id);
  }, [valid]);

  // 換語言時頁面元件重新掛載：從 store 還原捲動位置，之後持續記錄
  useLayoutEffect(() => {
    if (!valid) return;
    const y = useQuiz.getState().scrollY;
    if (y > 0) window.scrollTo(0, y);
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => useQuiz.getState().setScroll(window.scrollY));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [valid]);

  // 計時：每秒重新繪製；頁面隱藏時暫停
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    const onVis = () => (document.visibilityState === 'hidden' ? useQuiz.getState().pause() : useQuiz.getState().resume());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  if (!valid) return <NotFound />;
  const correct = quiz.selected === DEMO_QUESTION.correctOptionId;
  return (
    <>
      <h1>
        <Trans id="level.demo.title">作答示範：資產是什麼</Trans>
      </h1>
      <div className="ll-row">
        <LangSwitch />
        <span className="ll-muted ll-small ll-num" data-testid="elapsed">
          {t({ id: 'level.elapsed', message: '作答時間' })} {formatElapsed(quiz.elapsedNow())}
        </span>
      </div>
      <Card>
        <ChoiceGroup
          name="demo"
          prompt={DEMO_QUESTION.prompt[locale]}
          options={DEMO_QUESTION.options.map((o) => ({ id: o.id, text: renderText(o.text[locale], locale, DEMO_QUESTION.vars), feedback: o.feedback[locale] }))}
          correctOptionId={DEMO_QUESTION.correctOptionId}
          selected={quiz.selected}
          checked={quiz.checked}
          onSelect={(id) => quiz.select(id)}
          onCheck={() => quiz.check()}
          onRetry={() => quiz.reset()}
        />
        {quiz.checked && <FeedbackPanel correct={correct} />}
      </Card>
      <Card>
        <label>
          <span className="ll-muted ll-small">
            <Trans id="level.demo.inputHint">鍵盤測試：輸入一個金額（開啟鍵盤時導覽列應該隱藏）</Trans>
          </span>
          <br />
          <input
            inputMode="decimal"
            autoComplete="off"
            placeholder="50,000"
            className="ll-num"
            aria-label={t({ id: 'level.demo.inputLabel', message: '測試用的金額輸入框' })}
          />
        </label>
      </Card>
      <section aria-label="stress" className="ll-stress-area">
        <h2>
          <Trans id="level.demo.stressTitle">玻璃效果測試區</Trans>
        </h2>
        <p className="ll-muted ll-small">
          <Trans id="level.demo.stressHint">把這些色塊捲到下方的導覽列後面，檢查標籤與圖示是否仍然清楚。</Trans>
        </p>
        <div className="ll-stress ll-stress--black" />
        <div className="ll-stress ll-stress--white" />
        <div className="ll-stress ll-stress--stripes" />
      </section>
    </>
  );
}
