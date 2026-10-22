import { Trans } from '@lingui/react/macro';
import { useMatches } from 'react-router';

// 闖關地圖（M2）與報表實驗室（M4a）的占位頁：只用來測試 Tab bar 切換與捲動收合
export function Placeholder() {
  const matches = useMatches();
  const kind = (matches[matches.length - 1]?.handle as { kind?: string } | undefined)?.kind;
  return (
    <>
      <h1>{kind === 'lab' ? <Trans id="lab.title">報表實驗室</Trans> : <Trans id="play.title">闖關區</Trans>}</h1>
      <p className="ll-muted">
        {kind === 'lab' ? (
          <Trans id="lab.placeholder">報表實驗室會在之後的里程碑加入。</Trans>
        ) : (
          <Trans id="play.placeholder">闖關地圖與關卡會在之後的里程碑加入。</Trans>
        )}
      </p>
    </>
  );
}
