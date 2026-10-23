// effects（04 第 6.5 節）：每一步依科目合併、依科目表 order 排序，文字由片語樣板代入名詞卡 ID；核心不寫死語言。
import phrasesJson from '../../data/effect-phrases.json' with { type: 'json' };
import { normalSign } from '../accounts/chart.ts';
import type { Chart, LocalizedText } from '../accounts/types.ts';
import type { JournalEntry } from '../journal/types.ts';
import type { Money } from '../money.ts';
import { stableSortBy } from '../util/canonical.ts';
import type { Effect, EffectDirection, EffectPhrases } from './types.ts';

/** packages/core/data/effect-phrases.json 的中英片語樣板 */
export const defaultEffectPhrases: EffectPhrases = phrasesJson as EffectPhrases;

const TERM_PLACEHOLDER = '{{term:account}}';

/** 把片語樣板的 {{term:account}} 換成該科目的名詞卡 ID；{{money:amount}} 保留給 UI */
export function renderEffectPhrase(phrase: LocalizedText, termRef: string): LocalizedText {
  const term = `{{term:${termRef}}}`;
  return { 'zh-TW': phrase['zh-TW'].split(TERM_PLACEHOLDER).join(term), en: phrase.en.split(TERM_PLACEHOLDER).join(term) };
}

/** 由這一步的分錄算 effects：正常餘額表示的變動、方向、分錄行與文字 */
export function buildEffects(entries: readonly JournalEntry[], chart: Chart, phrases: EffectPhrases): Effect[] {
  const deltas = new Map<string, { delta: Money; lineRefs: string[] }>();
  for (const entry of entries) {
    for (const l of entry.lines) {
      const account = chart.byId.get(l.account);
      if (account === undefined) throw new TypeError(`buildEffects：科目不存在 ${l.account}`);
      const signed = l.amount === 0 ? 0 : (l.side === 'debit' ? l.amount : -l.amount) * normalSign(account);
      const cur = deltas.get(l.account);
      if (cur === undefined) deltas.set(l.account, { delta: signed, lineRefs: [l.ref] });
      else {
        cur.delta += signed;
        cur.lineRefs.push(l.ref);
      }
    }
  }
  const effects: Effect[] = [];
  for (const [id, { delta, lineRefs }] of deltas) {
    const account = chart.byId.get(id);
    if (account === undefined) continue;
    const direction: EffectDirection = delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'unchanged';
    effects.push({
      account: id,
      element: account.element,
      delta,
      amount: Math.abs(delta),
      direction,
      lineRefs,
      text: renderEffectPhrase(phrases[direction], account.termRef),
    });
  }
  return stableSortBy(effects, (e) => {
    const account = chart.byId.get(e.account);
    return [account === undefined ? Number.MAX_SAFE_INTEGER : account.order, e.account];
  });
}
