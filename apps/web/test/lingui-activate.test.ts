// 語言切換的競態（core-5）：快速來回切換時，較晚到的 catalog 只載入、不把介面切到使用者已經不要的語言
import { describe, expect, it, vi } from 'vitest';

const gates = vi.hoisted(() => {
  const make = () => {
    let open!: () => void;
    const promise = new Promise<void>((resolve) => {
      open = resolve;
    });
    return { promise, open };
  };
  return { en: make(), zh: make() };
});

vi.mock('../src/i18n/catalog-en.ts', async () => {
  await gates.en.promise;
  return { ui: { 'test.ui': 'UI' }, app: { 'test.hello': 'Hello' } };
});
vi.mock('../src/i18n/catalog-zh-TW.ts', async () => {
  await gates.zh.promise;
  return { ui: { 'test.ui': '介面' }, app: { 'test.hello': '你好' } };
});

describe('activateLocale', () => {
  it('切到 en 還沒載完又切回 zh-TW：en 的 catalog 晚到時只載入，不切換；之後再切到 en 照常切換', async () => {
    const { activateLocale, i18n } = await import('../src/i18n/lingui.ts');
    gates.zh.open();
    await activateLocale('zh-TW');
    expect(i18n.locale).toBe('zh-TW');
    expect(i18n._('test.hello')).toBe('你好');

    const toEn = activateLocale('en'); // 不 await：chunk 還在下載
    await activateLocale('zh-TW'); // 使用者按返回
    expect(i18n.locale).toBe('zh-TW');
    gates.en.open();
    await toEn;
    expect(i18n.locale).toBe('zh-TW');
    expect(i18n._('test.hello')).toBe('你好');

    // 沒有中途改變時照常切換；web-ui 與 app 兩份 catalog 都載入
    await activateLocale('en');
    expect(i18n.locale).toBe('en');
    expect(i18n._('test.hello')).toBe('Hello');
    expect(i18n._('test.ui')).toBe('UI');
  });
});
