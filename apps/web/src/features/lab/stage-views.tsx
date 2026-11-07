// 步驟頁階段 2 到 10 的畫面元件（預測面板、揭曉卡、科目變動、天平、三表、燈號、指標清單）與它們用到的 web-ui 元件（Segmented、Switch）：
// 只由 lazy-stages.ts 動態載入（06 第 8.2 節、14 的 V24）。階段 1 只要交易卡，這些元件和核心一樣在畫面掀開之後才載，不在步驟頁的第一波；
// 它們在 vite.config.ts 自成 lab-stages chunk（lab-ui 群組排除這些檔）。
export { Segmented, Switch } from '@ledgerland/web-ui';
export { BalanceScale } from './BalanceScale.tsx';
export { CheckLights, ProfitLevels } from './CheckLights.tsx';
export { EffectsList } from './EffectsList.tsx';
export { PolicyToggle } from './PolicyToggle.tsx';
export { PredictPanel } from './PredictPanel.tsx';
export { PredictReveal } from './PredictReveal.tsx';
export { RatioList } from './RatioList.tsx';
export { StatementTable, changeSummary } from './StatementTable.tsx';
