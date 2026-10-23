// 關卡星星（03 第 2.10 節）：正確率＝計分題得分總和 ÷ 計分題題數；★ 60%、★★ 80%、★★★ 100%。門檻是全站設定，不放在每一關。

export type Stars = 0 | 1 | 2 | 3;

/** 依序是一星、兩星、三星的正確率門檻 */
export const STAR_THRESHOLDS: readonly [number, number, number] = [0.6, 0.8, 1];

/** 比較正確率前先四捨五入到 9 位小數，避免 4.8 ÷ 8 這類浮點誤差讓剛好達標的關卡少一顆星 */
const RATIO_SCALE = 1e9;

export interface LevelItem {
  /** 是否計分；取捨題與 pendingRefs 非空的題目不計分，不進分母 */
  readonly scored: boolean;
  /** 0 到 1 */
  readonly score: number;
}

export interface LevelScore {
  /** 計分題的得分總和 */
  readonly total: number;
  readonly scoredCount: number;
  /** 正確率（0 到 1）；沒有計分題時為 0 */
  readonly ratio: number;
  readonly stars: Stars;
}

/** 由計分題得分總和與計分題題數算星等；沒有計分題時為 0 顆 */
export function starsFor(score: number, scoredCount: number): Stars {
  if (!Number.isInteger(scoredCount) || scoredCount < 0) throw new RangeError(`starsFor：scoredCount 必須是非負整數，收到 ${String(scoredCount)}`);
  if (!Number.isFinite(score) || score < 0 || score > scoredCount + 1e-9)
    throw new RangeError(`starsFor：score 必須在 0 到 ${scoredCount} 之間，收到 ${String(score)}`);
  if (scoredCount === 0) return 0;
  const ratio = Math.round((score / scoredCount) * RATIO_SCALE) / RATIO_SCALE;
  let stars: Stars = 0;
  for (const threshold of STAR_THRESHOLDS) if (ratio >= threshold) stars = (stars + 1) as Stars;
  return stars;
}

/** 整關的分數：只把 scored 的題目算進總和與分母 */
export function levelScore(items: readonly LevelItem[]): LevelScore {
  let total = 0;
  let scoredCount = 0;
  for (const item of items) {
    if (!item.scored) continue;
    if (!Number.isFinite(item.score) || item.score < 0 || item.score > 1)
      throw new RangeError(`levelScore：每題得分必須在 0 到 1 之間，收到 ${String(item.score)}`);
    total += item.score;
    scoredCount += 1;
  }
  const ratio = scoredCount === 0 ? 0 : Math.round((total / scoredCount) * RATIO_SCALE) / RATIO_SCALE;
  return { total, scoredCount, ratio, stars: starsFor(total, scoredCount) };
}
