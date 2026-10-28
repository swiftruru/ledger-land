// 殼層的啟動畫面標記（src/shell/shellHtml.ts 的 buildLaunchScreen，06 第 2.4 節）：用假的讀檔餵三個 SVG，檢查輸出的規則
import { describe, expect, it } from 'vitest';
import { buildLaunchScreen } from '../src/shell/shellHtml.ts';

const FIXTURES: Record<string, string> = {
  'launch-illustration.svg':
    '<?xml version="1.0"?>\n<!-- 註解 -->\n<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 1024 1024"><title>t</title><path fill="#FCDCB0" d="M0 0l1 0z"/></svg>\n',
  'launch-mark.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 300"><metadata>x</metadata><path fill="#8E3D2F" d="M0 0l1 0z"/></svg>',
  'launch-wordmark.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 420"><desc>d</desc><path fill="currentColor" d="M0 0L1 0Z"/></svg>',
};
const read = (file: string) => {
  const s = FIXTURES[file];
  if (s === undefined) throw new Error(file);
  return s;
};

describe('buildLaunchScreen', () => {
  it('輸出 #ll-launch、aria-hidden、三個 svg；去掉 xml 宣告、註解、title、desc、metadata 與根元素的 width、height', () => {
    const html = buildLaunchScreen(read);
    expect(html.startsWith('<div id="ll-launch" aria-hidden="true">')).toBe(true);
    expect((html.match(/<svg\b/g) ?? []).length).toBe(3);
    expect((html.match(/aria-hidden="true"/g) ?? []).length).toBe(4);
    expect(html).not.toMatch(/\sstyle=/);
    expect(html).not.toContain('<?xml');
    expect(html).not.toContain('<!--');
    expect(html).not.toContain('<title');
    expect(html).not.toContain('<desc');
    expect(html).not.toContain('<metadata');
    expect(html).not.toMatch(/<svg[^>]*\swidth=/);
    expect(html).toContain('class="ll-launch__girl" viewBox="0 0 1024 1024"');
    expect(html).toContain('class="ll-launch__mark" viewBox="0 0 256 300" fill="currentColor"');
    expect(html).toContain('class="ll-launch__word" viewBox="0 0 1600 420" fill="currentColor"');
    expect(html).toContain('<div class="ll-launch__art">');
    expect(html).toContain('<div class="ll-launch__brand">');
    expect(html).toContain('focusable="false"');
  });

  it('含 style 屬性、<style>、<script>、外部資源或沒有 viewBox 時讓建置失敗', () => {
    const variants: [string, string][] = [
      ['style 屬性', '<svg viewBox="0 0 1 1"><path style="fill:red" d="M0 0z"/></svg>'],
      ['style 元素', '<svg viewBox="0 0 1 1"><style>p{}</style></svg>'],
      ['script', '<svg viewBox="0 0 1 1"><script>1</script></svg>'],
      ['image', '<svg viewBox="0 0 1 1"><image href="x.png"/></svg>'],
      ['外部 href', '<svg viewBox="0 0 1 1"><use href="https://example.com/a.svg#x"/></svg>'],
      ['沒有 viewBox', '<svg width="1" height="1"><path d="M0 0z"/></svg>'],
    ];
    for (const [, svg] of variants) {
      expect(() => buildLaunchScreen((file) => (file === 'launch-mark.svg' ? svg : read(file)))).toThrow('buildLaunchScreen');
    }
  });
});
