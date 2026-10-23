// 闖關地圖的座標樣板（17 第 5.2 節）：決定性、值域、樣板輪流、節點數依比例取點、固定高度、路線段數
import { describe, expect, it } from 'vitest';
import {
  BANNER_HEIGHT,
  END_HEIGHT,
  EXTENSION_GAP_HEIGHT,
  JITTER,
  NODE_GAP,
  TEMPLATES,
  X_MAX,
  X_MIN,
  cubicPoint,
  hashSeed,
  layoutChapter,
  layoutMap,
  nodeMapPoint,
  routeSegments,
  sampleCubic,
  seededRandom,
  templateFor,
  templateX,
} from '../src/features/quest-map/layout.ts';
import { normalizeLevelCode } from '../src/features/quest-map/level-code.ts';

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `lv_${prefix}${String(i).padStart(4, '0')}`);

describe('座標樣板', () => {
  it('相同輸入每次都得到相同座標', () => {
    const input = { id: 'ch_c5f8w2', levelIds: ids('a', 5) };
    const a = layoutChapter(input, 0);
    const b = layoutChapter(input, 0);
    expect(a).toEqual(b);
    expect(seededRandom(hashSeed('ch_c5f8w2'))()).toBe(seededRandom(hashSeed('ch_c5f8w2'))());
  });

  it('不同章節 ID 的偏移不同，但都在 ±4% 之內', () => {
    const a = layoutChapter({ id: 'ch_aaaaaa', levelIds: ids('a', 5) }, 0);
    const b = layoutChapter({ id: 'ch_bbbbbb', levelIds: ids('b', 5) }, 0);
    expect(a.nodes.map((n) => n.x)).not.toEqual(b.nodes.map((n) => n.x));
    a.nodes.forEach((n, i) => {
      const base = templateX('s', i / 4);
      expect(Math.abs(n.x - base)).toBeLessThanOrEqual(JITTER + 1e-9);
    });
  });

  it('三種樣板依章序輪流', () => {
    expect([0, 1, 2, 3, 4, 5].map(templateFor)).toEqual(['s', 'zigzag', 'arc', 's', 'zigzag', 'arc']);
    for (const t of TEMPLATES) {
      for (let i = 0; i <= 20; i++) {
        const x = templateX(t, i / 20);
        expect(x).toBeGreaterThanOrEqual(X_MIN - 1e-9);
        expect(x).toBeLessThanOrEqual(X_MAX + 1e-9);
      }
    }
  });

  it('節點數 3 到 8 都依比例取點：x 在 0.15 到 0.85、相鄰垂直距離固定', () => {
    for (let n = 3; n <= 8; n++) {
      for (let idx = 0; idx < 3; idx++) {
        const c = layoutChapter({ id: `ch_n${n}x${idx}`, levelIds: ids('l', n) }, idx);
        expect(c.nodes).toHaveLength(n);
        for (const node of c.nodes) {
          expect(node.x).toBeGreaterThanOrEqual(X_MIN);
          expect(node.x).toBeLessThanOrEqual(X_MAX);
        }
        for (let i = 1; i < n; i++) expect(c.nodes[i]!.y - c.nodes[i - 1]!.y).toBe(NODE_GAP);
        expect(NODE_GAP).toBeGreaterThanOrEqual(96);
        expect(NODE_GAP).toBeLessThanOrEqual(128);
        expect(c.height).toBe(BANNER_HEIGHT + c.nodesHeight + END_HEIGHT);
      }
    }
    expect(layoutChapter({ id: 'ch_single', levelIds: ids('s', 1) }, 0).nodes[0]!.x).toBeCloseTo(0.5, 1);
    expect(layoutChapter({ id: 'ch_empty', levelIds: [] }, 0).height).toBe(BANNER_HEIGHT + END_HEIGHT);
  });

  it('整張地圖：章節由下往上累加、延伸區前插入分隔、進出 x 接到相鄰章', () => {
    const map = layoutMap([
      { id: 'ch_one', levelIds: ids('a', 4) },
      { id: 'ch_two', levelIds: ids('b', 3) },
      { id: 'ch_ext', levelIds: ids('e', 5), extension: true },
    ]);
    const [c1, c2, c3] = map.chapters;
    expect(c1!.offset).toBe(0);
    expect(c2!.offset).toBe(c1!.height);
    expect(map.extensionGap).toEqual({ offset: c1!.height + c2!.height, height: EXTENSION_GAP_HEIGHT });
    expect(c3!.offset).toBe(c1!.height + c2!.height + EXTENSION_GAP_HEIGHT);
    expect(map.totalHeight).toBe(c3!.offset + c3!.height);
    expect(c1!.entryX).toBeNull();
    expect(c1!.exitX).toBe(c2!.nodes[0]!.x);
    expect(c2!.entryX).toBe(c1!.nodes[3]!.x);
    expect(c3!.exitX).toBeNull();
    expect(layoutMap([]).totalHeight).toBe(0);
  });

  it('路線段：進入段加節點之間加離開段；地圖座標找得到節點', () => {
    const map = layoutMap([
      { id: 'ch_one', levelIds: ids('a', 4) },
      { id: 'ch_two', levelIds: ids('b', 3) },
    ]);
    const s1 = routeSegments(map.chapters[0]!, 400);
    const s2 = routeSegments(map.chapters[1]!, 400);
    expect(s1).toHaveLength(3 + 1);
    expect(s2).toHaveLength(1 + 2);
    expect(s1[s1.length - 1]!.toLevelId).toBeNull();
    expect(s2[0]!.toLevelId).toBe('lv_b0000');
    expect(s1[0]!.d).toMatch(/^M[\d.]+ [\d.]+ C/);
    const p = nodeMapPoint(map, 'lv_b0000', 400)!;
    expect(p.y).toBe(map.chapters[1]!.offset + BANNER_HEIGHT + map.chapters[1]!.nodes[0]!.y);
    expect(nodeMapPoint(map, 'lv_none', 400)).toBeNull();
  });

  it('貝茲曲線的起點與終點正確，取樣點數固定', () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 100, y: 200 };
    expect(cubicPoint(p0, { x: 0, y: 100 }, { x: 100, y: 100 }, p1, 0)).toEqual(p0);
    expect(cubicPoint(p0, { x: 0, y: 100 }, { x: 100, y: 100 }, p1, 1)).toEqual(p1);
    const pts = sampleCubic(p0, p1, 10);
    expect(pts).toHaveLength(11);
    expect(pts[0]).toEqual(p0);
    expect(pts[10]).toEqual(p1);
    expect(pts[5]!.y).toBeCloseTo(100);
  });
});

describe('關卡代號正規化（02 第 4.7 節）', () => {
  it('NFKC、小寫、去空白與連字號、去 lv_ 前綴、o 當 0、i 與 l 當 1', () => {
    expect(normalizeLevelCode('K7M2 Q9XD')).toEqual({ ok: true, code: 'k7m2q9xd' });
    expect(normalizeLevelCode('ｋ７ｍ２－ｑ９ｘｄ')).toEqual({ ok: true, code: 'k7m2q9xd' });
    expect(normalizeLevelCode('lv_k7m2q9xd')).toEqual({ ok: true, code: 'k7m2q9xd' });
    expect(normalizeLevelCode('LV_K7M2-Q9XD')).toEqual({ ok: true, code: 'k7m2q9xd' });
    expect(normalizeLevelCode('k7mO qlxi')).toEqual({ ok: true, code: 'k7m0q1x1' });
    expect(normalizeLevelCode('lv_lv1lv1lv')).toEqual({ ok: true, code: '1v11v11v' });
  });
  it('長度不是 8 或含 u 時格式錯誤', () => {
    expect(normalizeLevelCode('')).toEqual({ ok: false });
    expect(normalizeLevelCode('k7m2q9x')).toEqual({ ok: false });
    expect(normalizeLevelCode('k7m2q9xdd')).toEqual({ ok: false });
    expect(normalizeLevelCode('k7m2q9xu')).toEqual({ ok: false });
    expect(normalizeLevelCode('k7m2q9x!')).toEqual({ ok: false });
  });
});
