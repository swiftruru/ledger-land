// 佔位符的最小渲染（05 第 10 節）：M0b 只處理題目 vars 的 money；完整的佔位符渲染（term chip、option、ratio 等）在 M1 隨內容管線加入
import { formatMoney, type Locale } from '@ledgerland/i18n';

export function renderText(text: string, locale: Locale, vars: Record<string, number> = {}): string {
  return text.replace(/\{\{money:vars\.([a-zA-Z_]+)\}\}/g, (_, name: string) => {
    const v = vars[name];
    return v === undefined ? '' : formatMoney(v, locale);
  });
}
