// 指標登錄檔與計算（04 第 12 節）
export { RATIO_REASON_KEYS, computeAllRatios, computeRatio, ratFromNumber } from './compute.ts';
export type { RatioReasonKey } from './compute.ts';
export { compileRatioRegistry, defaultRatioRegistry, getRatioVersion, isRatioVersionId, layoutLineIds, parseRatioRef, ratioRefString } from './registry.ts';
export { RATIO_STATUSES } from './types.ts';
export type {
  CompiledRatioFormula,
  CompiledRatioVersion,
  ComputeRatioOptions,
  MeasureMap,
  RatioInputs,
  RatioRegistry,
  RatioResult,
  RatioStatus,
} from './types.ts';
