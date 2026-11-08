// calc-lime-leaf.mjs 的型別（給 golden-calc.test.ts 與 tools/check-golden.mjs 的呼叫端）
export type GoldenPolicy = 'teacher@1' | 'ifrs@1';
export interface GoldenRatio {
  readonly status: 'ok' | 'zero' | 'na' | 'not_meaningful';
  readonly displayValue: number | null;
}
export interface GoldenStep {
  readonly stepId: string;
  readonly order: number;
  readonly lines: Readonly<Record<string, number>>;
  readonly ratios: Readonly<Record<string, GoldenRatio>>;
  readonly fiveStep: {
    readonly step1: Readonly<Record<string, number | null>>;
    readonly checks: readonly { readonly step: number; readonly left: number; readonly right: number; readonly diff: number }[];
  };
}
export interface GoldenData {
  readonly story: string;
  readonly policy: string;
  readonly layout: string;
  readonly steps: readonly GoldenStep[];
}
export const STORY_ID: string;
export const STEP_IDS: readonly string[];
export const AMOUNTS: Readonly<Record<string, number>>;
export function compute(policy: GoldenPolicy): GoldenData;
export function diffAgainst(golden: GoldenData, computed: GoldenData): string[];
export function goldenPath(policy: GoldenPolicy): string;
