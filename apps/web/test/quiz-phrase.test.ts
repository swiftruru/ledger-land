// 作答頁中文的依詞換行（features/quiz-phrase/quiz-phrase.ts，M3 驗收第 8 輪）：題幹、選項、回饋與解說切成不再拆開的段，段與段之間才換行。
// 第 8 輪審查看到的拆詞：題幹「店裡有一台義式咖／啡機」「這三／樣東西」（320 加 200% 是「台義式咖啡／機」「咖啡／豆」）、選項「之後能帶／來好處的資源」、
// 解說「這是店裡擁／有」「咖啡／機」「混在一／起了。」、選項說明「也是店裡擁／有」「資產不／只現金」「一／樣是資產」。
// 另外對全部已發布題目檢查：段串回原字不變、沒有一段以閉標點或「的」「地」「得」開頭、沒有一段以開括號結尾。
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canBreak, phraseRuns, questionWords } from '../src/features/quiz-phrase/quiz-phrase.ts';

const ROOT = fileURLToPath(new URL('../../../content/', import.meta.url));
const json = (path: string) => JSON.parse(readFileSync(`${ROOT}${path}`, 'utf8')) as Record<string, unknown>;

/** 名詞資料的中文名稱（TermsProvider 的 keep 清單同一種取法） */
const NAMES = (() => {
  const out = new Set<string>();
  for (const f of readdirSync(`${ROOT}terms`)) {
    const t = json(`terms/${f}`) as { label: Record<string, string>; teacherLabel?: string; currentTwLabel?: string; aliases?: Record<string, string[]> };
    for (const n of [t.label['zh-TW'], t.teacherLabel, t.currentTwLabel, ...(t.aliases?.['zh-TW'] ?? [])])
      if (n && n.length > 1 && /\p{Script=Han}/u.test(n)) out.add(n);
  }
  return [...out];
})();

/** 題目原始檔取中文（作答頁拿到的快照是單一語系的字串） */
function zh(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(zh);
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('zh-TW' in o && 'en' in o) return o['zh-TW'];
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, zh(x)]));
  }
  return v;
}

const COFFEE = zh(json('questions/ch_c5f8w2/q_g1ze90s7.json')) as {
  prompt: string;
  explanation: string;
  options: { id: string; text: string; feedback: string }[];
};
const WORDS = questionWords(COFFEE);
const keep = (text: string) => [...NAMES, ...WORDS].filter((n) => text.includes(n));
const runs = (text: string, fit: number, tail = true) => phraseRuns(text, keep(text), fit, tail)!;
const SEG = new Intl.Segmenter('zh-Hant', { granularity: 'word' });
/** 不該落在行首的段：閉標點開頭，或單獨成詞的「的」「地」「得」開頭（「的確」「得到」「地方」是詞，不算） */
const badLead = (r: string) => /^[、，。：；？！）」』]/u.test(r) || (/^[的地得]/u.test(r) && [...SEG.segment(r)][0]!.segment.length === 1);
/** 段與段的接縫：[前一段的最後一個字, 後一段的第一個字] */
const seams = (rs: readonly string[]) => rs.slice(1).map((r, i) => `${rs[i]!.at(-1)}|${r[0]}`);

describe('phraseRuns：第 8 輪審查的小山咖啡題', () => {
  it('題幹：沒有一段以「咖」或「三」結尾，「咖啡機」「三樣」「店裡」不拆開（題幹的 fit 6、選項的 fit 5 都一樣）', () => {
    for (const fit of [6, 5]) {
      const rs = runs(COFFEE.prompt, fit);
      expect(rs.join('')).toBe(COFFEE.prompt);
      expect(rs.filter((r) => /[咖三]$/.test(r))).toEqual([]);
      expect(['咖啡機', '咖啡豆', '三樣', '店裡', '義式', '戶頭'].filter((word) => !rs.some((r) => r.includes(word)))).toEqual([]);
    }
  });

  it('這一題自己的詞：解說裡整塊的「咖啡機」也讓題幹整塊不斷', () => {
    expect(WORDS).toContain('咖啡機');
  });

  it('選項與選項說明的標題：「帶來」「擁有」「店裡」不拆開', () => {
    const text = COFFEE.options.find((o) => o.id === 'o_80gh')!.text;
    for (const fit of [6, 5]) {
      const s = seams(runs(text, fit));
      expect(s.filter((seam) => ['帶|來', '擁|有', '店|裡'].includes(seam))).toEqual([]);
    }
  });

  it('解說與選項說明：「擁有」「一起」「不只」「一樣」不拆開，「不」不留在段尾', () => {
    const texts = [COFFEE.explanation, ...COFFEE.options.map((o) => o.feedback)];
    for (const text of texts)
      for (const part of text.split(/\{\{[^}]*\}\}/).filter((p) => /\p{Script=Han}/u.test(p))) {
        const rs = runs(part, 6);
        expect(rs.join('')).toBe(part);
        const s = seams(rs);
        expect(s.filter((seam) => ['擁|有', '一|起', '不|只', '一|樣', '咖|啡', '啡|機'].includes(seam))).toEqual([]);
        expect(rs.filter((r) => /[不沒未]$/.test(r))).toEqual([]);
      }
  });
});

describe('phraseRuns：規則', () => {
  it('「的」「地」「得」不落在段首（第 8 輪定案）；閉標點不在段首、開括號不在段尾', () => {
    const rs = runs('一批還沒用完的咖啡豆，慢慢地賣掉，賣得很好（不是「欠別人錢」）。', 6);
    expect(rs.slice(1).filter(badLead)).toEqual([]);
    expect(rs.filter((r) => /[（「]$/.test(r))).toEqual([]);
  });

  it('不換行空白與 U+2060 的前後不斷', () => {
    expect(canBreak('今天要複習 1\u00A0', '題')).toBe(false);
    expect(canBreak('會計', '\u2060入門')).toBe(false);
    expect(canBreak('資產', '負債')).toBe(true);
    expect(canBreak('「', '資產')).toBe(false);
    expect(canBreak('資產', '。')).toBe(false);
    // 名詞卡後面緊接「的」：不斷（第 9 輪）；「的確」照常
    expect(canBreak('稅前利益佔實收資本比率', '的分母都是股本。')).toBe(false);
    expect(canBreak('比率', '的確如此')).toBe(true);
  });

  it('一段不超過 fit 個字寬（標點也算一個字）：「資產負債表上，」「「今年一整年，」在題幹分開，行尾硬斷不會把「，」斷到行首', () => {
    expect(runs('阿凱的「海風衝浪店」年底的資產負債表上，資產總計是 ', 6)).toEqual(expect.arrayContaining(['資產負債表', '上，']));
    const rs = runs('他想知道「今年一整年，車行到底賺了多少」。', 6);
    expect(rs.filter((r) => [...r].length > 6)).toEqual([]);
    expect(rs).toContain('一整年，');
    // 四個字以上的詞加上助詞放不下時從第 2 個字後切開
    expect(runs('看資產負債表的哪一列', 5)).toEqual(expect.arrayContaining(['資產', '負債表的']));
  });

  it('不是中文時回 null（英文介面照原字）', () => {
    expect(phraseRuns('Which class do all three belong to?', [], 6)).toBeNull();
  });
});

describe('phraseRuns：全部已發布題目', () => {
  it('段串回原字不變；沒有段以閉標點或「的」「地」「得」開頭，沒有段以開括號結尾；比 fit 寬的段幾乎都是拉丁字母或括號引號整塊', () => {
    const problems: string[] = [];
    const wide: string[] = [];
    let count = 0;
    for (const dir of readdirSync(`${ROOT}questions`))
      for (const f of readdirSync(`${ROOT}questions/${dir}`)) {
        const q = zh(json(`questions/${dir}/${f}`));
        const words = questionWords(q as object);
        const walk = (v: unknown): void => {
          if (typeof v === 'string') {
            for (const part of v.split(/\{\{[^}]*\}\}/).filter((p) => /\p{Script=Han}/u.test(p))) {
              const rs = phraseRuns(
                part,
                [...NAMES, ...words].filter((n) => part.includes(n)),
                5,
              );
              if (!rs) continue;
              count++;
              if (rs.join('') !== part) problems.push(`${f} 串回不同：${part}`);
              for (const [i, r] of rs.entries()) {
                if ([...r].reduce((w, ch) => w + (ch.codePointAt(0)! >= 0x2e80 ? 1 : 0.55), 0) > 5) wide.push(r);
                if (i > 0 && badLead(r)) problems.push(`${f} 段首「${r}」：${part}`);
                if (i < rs.length - 1 && /[（「『]$/u.test(r)) problems.push(`${f} 段尾「${r}」：${part}`);
              }
            }
          } else if (Array.isArray(v)) v.forEach(walk);
          else if (v !== null && typeof v === 'object') Object.values(v).forEach(walk);
        };
        walk(q);
      }
    expect(count).toBeGreaterThan(1000);
    expect(problems.slice(0, 20)).toEqual([]);
    // 2026-10-26：選項的 fit 5 時約 2 萬 8 千段裡只有 9 段比 5 個字寬（「（流動比率）。」「intensity：」這類）
    expect(wide.slice(20)).toEqual([]);
  });
});
