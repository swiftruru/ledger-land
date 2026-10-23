// 過帳、餘額快照、effects、T 字帳與視窗內的推導值（04 第 6.3 到 6.5 節）
export { buildEffects, defaultEffectPhrases, renderEffectPhrase } from './effects.ts';
export { applyEntry, balanceOf, checkBalanceRules, costOf, createLedger, noNegativeZero, normalBalance, normalBalanceOf } from './ledger.ts';
export { postStep, toStepError } from './post.ts';
export type { PostStepResult } from './post.ts';
export { buildTAccounts, stepIndexOf } from './taccounts.ts';
export { activityOf, balanceAfterStep, balanceAtWindowStart, cashByTag, debitCreditTotals, inventoryTagTotals, stepsInWindow } from './activity.ts';
export type { CashByTag } from './activity.ts';
export type {
  Balances,
  CoreContext,
  Effect,
  EffectDirection,
  EffectPhrases,
  LedgerState,
  PostableEvent,
  PostableStep,
  PostedRun,
  PostedStep,
  StepError,
  TAccount,
  TAccountLine,
} from './types.ts';
