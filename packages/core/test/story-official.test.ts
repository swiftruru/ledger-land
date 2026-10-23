// oxlint-disable vitest/no-conditional-expect, vitest/valid-expect -- 斷言依每一步的內容逐筆檢查；expect 的第二個引數是失敗時指出哪一步的訊息
// 正式故事（content/stories/，origin 為 teacher，D2）的性質測試（04 第 18 節、08 第 3.9 節）：
// 只檢查 schema、重播是否全部成功、文字規則與佔位符能否解析；不寫任何金額的期望值，老師的金額只存在資料檔。
import { Story as StorySchema, parsePlaceholders } from '@ledgerland/content-schema';
import { describe, expect, it } from 'vitest';
import { type CoreContext, type Story, createCoreContext, orderedSteps, replayStory, unwrap } from '../src/index.ts';
import { allStrings, expectBritish, expectNoDash } from './helpers.ts';
import officialStoryJson from '../../../content/stories/story_ywv2dy.json' with { type: 'json' };

const ctx: CoreContext = createCoreContext();
const story = officialStoryJson as Story;
const YEAR_END_ORDER = 17;

describe('正式故事 story_ywv2dy（origin 為 teacher）', () => {
  it('符合 content-schema 的 Story schema，狀態為草稿，沒有 checkpoints，每一步都標了 verification', () => {
    const parsed = StorySchema.safeParse(officialStoryJson);
    expect(parsed.success ? 'ok' : JSON.stringify(parsed.error.issues)).toBe('ok');
    expect(story.origin).toBe('teacher');
    expect(story.status).toBe('draft');
    expect(story.policy).toBe('teacher@1');
    expect(story.layout).toBe('teacher@1');
    expect(story.steps).toHaveLength(18);
    expect(orderedSteps(story).map((s) => s.order)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(new Set(story.steps.map((s) => s.id)).size).toBe(18);
    for (const s of story.steps) {
      expect(s.checkpoints, s.id).toBeUndefined();
      expect(s.verification, s.id).toBeDefined();
      for (const e of s.events) expect(ctx.templates.has(e.template), `${s.id} ${e.id} 的範本 ${e.template}`).toBe(true);
    }
  });

  const run = unwrap(replayStory(story, [], ctx));

  it('18 步全部重播成功，沒有一步被擋下或無影響，每個事件都有分錄', () => {
    expect(run.policy).toBe('teacher@1');
    expect(run.steps).toHaveLength(18);
    expect(run.steps.map((s) => s.stepId)).toEqual(orderedSteps(story).map((s) => s.id));
    for (const [i, step] of orderedSteps(story).entries()) {
      const posted = run.steps[i];
      expect(posted?.noEffect, step.id).toBe(false);
      expect(
        posted?.entries.map((e) => e.eventId),
        step.id,
      ).toEqual(step.events.map((e) => e.id));
      for (const entry of posted?.entries ?? []) expect(entry.lines.length, `${step.id} ${entry.eventId}`).toBeGreaterThan(0);
    }
    // 全部科目借方減貸方加總為 0
    expect(Object.values(run.finalState.balances).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('第 17 步的折舊與攤銷兩個事件都有分錄', () => {
    const yearEnd = orderedSteps(story).find((s) => s.order === YEAR_END_ORDER);
    const posted = run.steps.find((s) => s.stepId === yearEnd?.id);
    expect(yearEnd?.events.map((e) => e.template)).toEqual(['tpl.depreciation_straight_line', 'tpl.amortise_org_costs']);
    expect(posted?.entries).toHaveLength(2);
    for (const entry of posted?.entries ?? []) expect(entry.lines.length, entry.eventId).toBeGreaterThan(0);
  });

  it('敘述與標題不寫死金額：數字只透過佔位符引用，每個佔位符都能在重播結果裡找到值，中英佔位符相同', () => {
    for (const [i, step] of orderedSteps(story).entries()) {
      const posted = run.steps[i];
      for (const locale of ['zh-TW', 'en'] as const) {
        const text = step.narrative[locale] ?? '';
        expect(text.length, `${step.id} 缺 ${locale} 的敘述`).toBeGreaterThan(0);
        expect(/\d/.test(text.replace(/\{\{[^}]*\}\}/g, '')), `${step.id} 的 ${locale} 敘述寫死了數字`).toBe(false);
        expect(/\d/.test(step.title[locale] ?? ''), `${step.id} 的 ${locale} 標題寫死了數字`).toBe(false);
        for (const p of parsePlaceholders(text)) {
          expect(['money', 'number'], `${step.id} ${locale} 的佔位符 ${p.type}`).toContain(p.type);
          expect(typeof posted?.derivedValues[p.ref], `${step.id} ${locale} 的 ${p.ref}`).toBe('number');
        }
      }
      const keys = (locale: 'zh-TW' | 'en') =>
        parsePlaceholders(step.narrative[locale] ?? '')
          .map((p) => `${p.type}:${p.ref}`)
          .sort();
      expect(keys('zh-TW'), step.id).toEqual(keys('en'));
    }
  });

  it('文字規則：不用破折號、英式拼字；待確認編號是 T 加兩位數字', () => {
    for (const s of allStrings(story)) {
      expectNoDash(s);
      expectBritish(s);
    }
    for (const step of story.steps) for (const e of step.events) for (const ref of e.pendingRefs ?? []) expect(ref).toMatch(/^T\d{2}$/);
  });
});
