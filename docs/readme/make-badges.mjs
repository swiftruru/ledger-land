// README 的小徽章：小綠綠配色（薄荷綠、粉紅、奶油黃、帳本紅，深褐描邊）的 SVG，放在 repo 裡，不連外部的徽章服務。
// 改了文字或數字後手動重產：node docs/readme/make-badges.mjs（輸出到 docs/readme/badges/）。CI 狀態那一顆仍用 GitHub Actions 自己的徽章。
// 文字寬度用估的（widthOf），再用 textLength 釘住，各平台的字型不同也不會跑出框。
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'badges');
const INK = '#5A3A2A';
const PAPER = '#FFFBF2';
const THEMES = {
  mint: { fill: '#BFEFD6', text: '#1F6E52' },
  pink: { fill: '#FBD3D6', text: '#A8463A' },
  cream: { fill: '#FBE7A8', text: '#7A5A12' },
  ledger: { fill: '#B4533F', text: '#FFF7EC' },
  blonde: { fill: '#F6DDB0', text: '#7A4E1E' },
};
// 12x12 的小圖示，原點在左上
const ICONS = {
  heart: (c) => `<path d="M6 10.6 1.9 6.6a2.6 2.6 0 0 1 3.7-3.7L6 3.3l.4-.4a2.6 2.6 0 0 1 3.7 3.7Z" fill="${c}"/>`,
  sparkle: (c) => `<path d="M6 .6 7.4 4.6 11.4 6 7.4 7.4 6 11.4 4.6 7.4.6 6 4.6 4.6Z" fill="${c}"/>`,
  coin: (c) => `<circle cx="6" cy="6" r="5" fill="#F5C842" stroke="${c}" stroke-width="1.2"/><circle cx="6" cy="6" r="2.4" fill="none" stroke="${c}" stroke-width="1"/>`,
  sprout: (c) => `<path d="M6 11V6.2M6 6.4C6 3.8 4.2 2.4 1.6 2.6 1.6 5 3.4 6.6 6 6.4ZM6 5.2c0-2 1.6-3.4 4.4-3.2 0 2.2-1.8 3.6-4.4 3.2Z" fill="none" stroke="${c}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`,
  book: (c) => `<path d="M2 2.2h6.6a1.4 1.4 0 0 1 1.4 1.4V10H3.4A1.4 1.4 0 0 1 2 8.6Z" fill="none" stroke="${c}" stroke-width="1.3" stroke-linejoin="round"/><circle cx="6" cy="5.6" r="1.2" fill="${c}"/>`,
};

/** 估字寬：中日韓字與全形符號 12px；拉丁字母與數字一般約 6.8px、大寫約 7.8px，粗體（標籤）各加 0.9px */
const CJK = /[\u2E80-\u9FFF\uFF00-\uFFEF]/;
const widthOf = (s, bold = false) =>
  [...s].reduce((w, ch) => {
    if (CJK.test(ch)) return w + 12;
    if (ch === ' ') return w + 3.8;
    return w + (/[A-Z]/.test(ch) ? 7.8 : 6.8) + (bold ? 0.9 : 0);
  }, 0);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function badge({ icon, theme, label, value }) {
  const t = THEMES[theme];
  const lw = Math.round(widthOf(label, true));
  const vw = Math.round(widthOf(value));
  const left = 10 + 12 + 5 + lw + 8;
  const W = left + 9 + vw + 12;
  const H = 26;
  const font = `font-family="Verdana,'PingFang TC','Noto Sans TC','Microsoft JhengHei',sans-serif" font-size="12"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}：${esc(value)}"><title>${esc(label)}：${esc(value)}</title><clipPath id="p"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="12"/></clipPath><g clip-path="url(#p)"><rect width="${W}" height="${H}" fill="${PAPER}"/><rect width="${left}" height="${H}" fill="${t.fill}"/></g><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="12" fill="none" stroke="${INK}" stroke-width="1.4"/><g transform="translate(10 7)">${ICONS[icon](t.text)}</g><text x="27" y="17.2" ${font} font-weight="700" fill="${t.text}" textLength="${lw}" lengthAdjust="spacingAndGlyphs">${esc(label)}</text><text x="${left + 9}" y="17.2" ${font} fill="${INK}" textLength="${vw}" lengthAdjust="spacingAndGlyphs">${esc(value)}</text></svg>\n`;
}

// 檔名相同的一組中文、一組英文（README.md 用 zh-*，README.en.md 用 en-*）
const BADGES = [
  ['site', 'sprout', 'mint', ['會計樂園', '開放中'], ['LedgerLand', 'open']],
  ['pwa', 'coin', 'cream', ['PWA', '可離線'], ['PWA', 'works offline']],
  ['bilingual', 'heart', 'pink', ['雙語', '中文 + English'], ['Bilingual', '中文 + English']],
  ['levels', 'book', 'ledger', ['闖關', '14 章 47 關'], ['Quest', '14 chapters, 47 levels']],
  ['questions', 'sparkle', 'mint', ['原創題目', '281 題'], ['Original questions', '281']],
  ['terms', 'heart', 'pink', ['名詞圖鑑', '163 個名詞'], ['Glossary', '163 terms']],
  ['lab', 'coin', 'cream', ['報表實驗室', '18 步故事'], ['Statement lab', '18 story steps']],
  ['drill', 'book', 'ledger', ['期中考苦練', '講義 300 題'], ['Midterm drill', '300 handout questions']],
  ['a11y', 'sparkle', 'mint', ['無障礙', 'axe 把關'], ['Accessibility', 'checked with axe']],
  ['code', 'coin', 'cream', ['程式碼', 'MIT'], ['Code', 'MIT']],
  ['content', 'heart', 'pink', ['內容', 'CC BY-SA 4.0'], ['Content', 'CC BY-SA 4.0']],
  ['react', 'sparkle', 'blonde', ['React', '19'], ['React', '19']],
  ['typescript', 'sparkle', 'blonde', ['TypeScript', '6'], ['TypeScript', '6']],
  ['vite', 'sparkle', 'blonde', ['Vite', '8'], ['Vite', '8']],
  ['lingui', 'sparkle', 'blonde', ['Lingui', '6'], ['Lingui', '6']],
  ['playwright', 'sparkle', 'blonde', ['Playwright', 'E2E'], ['Playwright', 'E2E']],
  ['workers', 'sparkle', 'blonde', ['Cloudflare', 'Workers'], ['Cloudflare', 'Workers']],
  ['love', 'heart', 'ledger', ['用心手作', '在台灣'], ['Made with care', 'in Taiwan']],
  ['author', 'sprout', 'mint', ['作者', '如如 · swift.moe'], ['Author', 'Yu-Ru Pan · swift.moe']],
];

mkdirSync(OUT, { recursive: true });
for (const [name, icon, theme, zh, en] of BADGES) {
  writeFileSync(join(OUT, `zh-${name}.svg`), badge({ icon, theme, label: zh[0], value: zh[1] }));
  writeFileSync(join(OUT, `en-${name}.svg`), badge({ icon, theme, label: en[0], value: en[1] }));
}
console.log(`${BADGES.length * 2} 個徽章寫到 ${OUT}`);
