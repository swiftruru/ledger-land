// 殼層入口不 import zod，只先放好 globalThis.__zod_globalConfig（src/lib/zod-config.ts）：確認目前釘的 Zod 版本讀的是同一個物件，
// 之後定義的 schema 不會再用 new Function 探測（CSP 沒有 unsafe-eval）
import { describe, expect, it } from 'vitest';

describe('zod-config', () => {
  it('先設好 __zod_globalConfig，Zod 載入後 config() 讀到 jitless: true，schema 照常解析', async () => {
    await import('../src/lib/zod-config.ts');
    const { config } = await import('zod/v4/core');
    expect(config().jitless).toBe(true);
    const { z } = await import('zod');
    expect(z.object({ a: z.number() }).parse({ a: 1 })).toEqual({ a: 1 });
  });
});
