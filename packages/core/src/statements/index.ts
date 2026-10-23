// 教材版面三表（04 第 5.2、11 節）：累計與本筆變動視窗、每種列的推導、直接法與不變式、給指標與追蹤樹的查值介面
export { compileLayout, compiledLayoutOf, lineDependencies } from './compile.ts';
export type { CompiledLayout, CompiledLayoutLine } from './compile.ts';
export { buildStatements, evaluateLines, finaliseLines, isDerivedKind, lineValue, measureMap, overageLineApplies, recomputeWithInputs } from './build.ts';
export { lastStepId, measuresAt, previousStepId } from './measure.ts';
export type { CumulativeMeasures, EquityTag } from './measure.ts';
export { checkStatementInvariants, statementInvariantsHold, windowMeasures } from './invariants.ts';
export type { WindowMeasures } from './invariants.ts';
export { lineAccountTraces } from './trace.ts';
export type { AccountTrace, LineTrace, SourceRef, TraceMeasure } from './trace.ts';
export type {
  InvariantResult,
  InvariantRule,
  LineId,
  LineNote,
  LineValue,
  StatementNote,
  StatementRow,
  StatementSource,
  StatementWindow,
  Statements,
} from './types.ts';
