// CoreContext 的建立：以內建資料（科目表、範本、政策、版面、片語樣板）組成；內建範本編譯失敗是程式錯誤。
import { buildChart } from '../accounts/chart.ts';
import type { Account, Chart } from '../accounts/types.ts';
import { defaultAccounts, defaultPolicies, defaultTemplates, teacherLayout } from '../data/index.ts';
import type { TransactionTemplate } from '../data/types.ts';
import type { Layout } from '../layout/types.ts';
import { defaultEffectPhrases } from '../ledger/effects.ts';
import type { CoreContext, EffectPhrases } from '../ledger/types.ts';
import { DEFAULT_POLICY_ID, getPolicy } from '../policy/policies.ts';
import type { PolicyDefinition } from '../policy/types.ts';
import { compileTemplates } from '../templates/compile.ts';
import type { CompiledTemplate } from '../templates/types.ts';

export interface CreateCoreContextOptions {
  /** 政策 ID（teacher@1、ifrs@1）或政策定義；預設 teacher@1 */
  readonly policy?: string | PolicyDefinition;
  /** 可查詢的政策清單，預設內建政策 */
  readonly policies?: readonly PolicyDefinition[];
  readonly accounts?: readonly Account[];
  readonly chart?: Chart;
  /** 原始範本（會在這裡編譯）或已編譯的 Map */
  readonly templates?: readonly TransactionTemplate[] | ReadonlyMap<string, CompiledTemplate>;
  readonly layout?: Layout;
  readonly effectPhrases?: EffectPhrases;
  readonly enabledExtensions?: readonly string[];
}

export function createCoreContext(options: CreateCoreContextOptions = {}): CoreContext {
  const chart = options.chart ?? buildChart(options.accounts ?? defaultAccounts);
  const policies = options.policies ?? defaultPolicies;
  const policyOption = options.policy ?? DEFAULT_POLICY_ID;
  const policy = typeof policyOption === 'string' ? getPolicy(policyOption, policies) : policyOption;
  if (policy === undefined) throw new RangeError(`createCoreContext：找不到政策 ${String(policyOption)}`);
  let templates: ReadonlyMap<string, CompiledTemplate>;
  if (options.templates instanceof Map) templates = options.templates;
  else {
    const compiled = compileTemplates((options.templates as readonly TransactionTemplate[] | undefined) ?? defaultTemplates, chart);
    if (!compiled.ok) throw new Error(`createCoreContext：範本編譯失敗 ${JSON.stringify(compiled.error)}`);
    templates = compiled.value;
  }
  return {
    chart,
    templates,
    policy,
    layout: options.layout ?? teacherLayout,
    effectPhrases: options.effectPhrases ?? defaultEffectPhrases,
    ...(options.enabledExtensions === undefined ? {} : { enabledExtensions: options.enabledExtensions }),
  };
}
