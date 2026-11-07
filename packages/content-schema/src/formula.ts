// 會計公式（08 第 3.11 節；維護者 2026-11-07 的決定，14 第 5.2 節）：一條公式的原創說明，給「會計公式」查找區用。
// 名稱、別名與類別都從名詞（termRef）與指標登錄檔（ratioRef，packages/core/data/ratios.json）取，這裡只寫各項數值的意思、原創的數字範例與怎麼看。
// 講義出處與相關題目不在這裡：那是講義題庫那一側的 content/handout/formula-links.json（08 第 1.4 節：原創內容不記錄教材頁碼）。
import { z } from 'zod';
import { LocalizedText, Managed, Markup, SemanticId, idSchema } from './common.ts';
import { RatioCategory, RatioVersionName } from './ratio.ts';

/** ratio：指標登錄檔有的比率；relation：報表關係（會計恆等式、五層利益這類計算關係），登錄檔沒有 */
export const FormulaKind = z.enum(['ratio', 'relation']);
export type FormulaKind = z.infer<typeof FormulaKind>;

/** 報表關係類的分類：和指標的分類同一組，另加 statement（報表關係本身）；指標類的分類由登錄檔決定 */
export const FormulaCategory = z.enum([...RatioCategory.options, 'statement']);
export type FormulaCategory = z.infer<typeof FormulaCategory>;

/** 公式裡的一項：有名詞就用名詞的名稱（學習端可以開名詞卡），沒有名詞的項目（例如股價、員工人數）自己給名稱 */
export const FormulaComponent = z
  .object({
    term: idSchema('term').optional(),
    label: LocalizedText.optional(),
    meaning: Markup,
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.term === undefined && c.label === undefined) ctx.addIssue({ code: 'custom', path: ['label'], message: '沒有 term 的項目要有 label' });
  });

export const Formula = Managed.extend({
  id: idSchema('formula'),
  kind: FormulaKind,
  /** 名稱、別名與定義都從這個名詞取 */
  termRef: idSchema('term'),
  /** 報表關係類的名稱和名詞不同時（例如名詞是「損益表」、公式是「損益表的五層利益」）才寫；指標類一律用名詞的名稱 */
  label: LocalizedText.optional(),
  /** 指標登錄檔的 id（例如 roe）；kind 是 ratio 時必填，relation 不得有 */
  ratioRef: SemanticId.optional(),
  /** kind 是 relation 時必填；ratio 的分類由登錄檔決定，不得在這裡寫 */
  category: FormulaCategory.optional(),
  /** 公式一行，用名詞的中文名稱寫，例如「本期淨利 ÷ 股東權益」 */
  formula: LocalizedText,
  /**
   * 各版本的寫法（指標登錄檔的版本名：excel、slides01 到 slides03、dupont）：講義的寫法和主公式不同時才列，建置時依版本名對到講義編號顯示「講義 0-2 的寫法」。
   * 只記版本名，不記頁碼
   */
  versions: z.array(z.object({ version: RatioVersionName, formula: LocalizedText, note: Markup.optional() }).strict()).optional(),
  components: z.array(FormulaComponent).min(1),
  /** 原創的數字範例：數字一律用佔位符（{{money:…}}、{{percent:…}}、{{number:…}}） */
  example: Markup,
  /** 怎麼看：高低代表什麼、要和誰比、常見誤讀 */
  reading: Markup,
  related: z.array(idSchema('formula')).optional(),
})
  .strict()
  .superRefine((f, ctx) => {
    if (f.kind === 'ratio' && f.ratioRef === undefined) ctx.addIssue({ code: 'custom', path: ['ratioRef'], message: 'kind 是 ratio 時要有 ratioRef' });
    if (f.kind === 'relation' && f.ratioRef !== undefined) ctx.addIssue({ code: 'custom', path: ['ratioRef'], message: 'kind 是 relation 時不得有 ratioRef' });
    if (f.kind === 'relation' && f.category === undefined) ctx.addIssue({ code: 'custom', path: ['category'], message: 'kind 是 relation 時要有 category' });
    if (f.kind === 'ratio' && f.label !== undefined) ctx.addIssue({ code: 'custom', path: ['label'], message: 'kind 是 ratio 時名稱用名詞的，不要寫 label' });
    if (f.kind === 'ratio' && f.category !== undefined)
      ctx.addIssue({ code: 'custom', path: ['category'], message: 'kind 是 ratio 時分類由指標登錄檔決定，不要寫 category' });
    if (f.versions && new Set(f.versions.map((v) => v.version)).size !== f.versions.length)
      ctx.addIssue({ code: 'custom', path: ['versions'], message: '同一個版本只能列一次' });
    if (f.related && new Set(f.related).size !== f.related.length) ctx.addIssue({ code: 'custom', path: ['related'], message: 'related 不得重複' });
    if (f.related?.includes(f.id)) ctx.addIssue({ code: 'custom', path: ['related'], message: 'related 不能是自己' });
  });
export type Formula = z.infer<typeof Formula>;
