// 追蹤樹：公式、科目、來源步驟與分錄行（04 第 6.4 節，D10(c) A）與第 18.1 節的追蹤不變式
export { formulaRefsInOrder, traceAllLines, traceLine, traceRuleOf, windowKey } from './trace.ts';
export type { TraceLineOptions } from './trace.ts';
export { sumOfParts, verifyTraceTree } from './verify.ts';
export type { VerifyTraceTreeOptions } from './verify.ts';
export { TRACE_RULES } from './types.ts';
export type { TraceAccount, TraceInvariantFailure, TraceInvariantRule, TraceNode, TraceNote, TraceRule, TraceSourceRef, TraceVerification } from './types.ts';
