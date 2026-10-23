// 固定種子的選項打散（03 第 2.8 節）：種子是（題目 ID、rev、作答 ID），同一次作答重新渲染或切換語言順序不變；重玩是新的作答 ID。
// 字串雜湊用 xmur3、亂數用 mulberry32，兩者都只用 32 位元整數運算，在任何執行環境結果相同。pin 為 last 的選項固定在最後，彼此保持原順序。

export interface ShuffleSeed {
  readonly questionId: string;
  readonly rev: number;
  readonly attemptId: string;
}

export interface ShuffleOptions {
  /** 固定在最後的選項 ID（選項的 pin: "last"；content-schema 的 ChoiceOption 還沒有這個欄位，先由呼叫端傳入） */
  readonly pinned?: readonly string[];
}

export function shuffleSeedString(seed: ShuffleSeed): string {
  if (!Number.isInteger(seed.rev) || seed.rev < 0) throw new RangeError(`shuffleSeedString：rev 必須是非負整數，收到 ${String(seed.rev)}`);
  return `${seed.questionId}\u0000${seed.rev}\u0000${seed.attemptId}`;
}

/** xmur3：字串到 32 位元種子 */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32：32 位元種子到 [0, 1) 的決定性亂數 */
function mulberry32(a: number): () => number {
  let state = a | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 以字串種子建立決定性亂數產生器；只給打散與測試用，不是密碼學用途 */
export function seededRandom(seedString: string): () => number {
  return mulberry32(xmur3(seedString)());
}

/** 回傳 ids 的一個排列：未固定的選項以 Fisher-Yates 打散，固定在最後的依原順序接在後面。ids 重複是程式錯誤 */
export function shuffleOptions<T extends string>(ids: readonly T[], seed: ShuffleSeed, options: ShuffleOptions = {}): T[] {
  if (new Set(ids).size !== ids.length) throw new TypeError('shuffleOptions：選項 ID 重複');
  const pinned = new Set(options.pinned ?? []);
  const movable = ids.filter((id) => !pinned.has(id));
  const tail = ids.filter((id) => pinned.has(id));
  const random = seededRandom(shuffleSeedString(seed));
  for (let i = movable.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = movable[i] as T;
    movable[i] = movable[j] as T;
    movable[j] = a;
  }
  return [...movable, ...tail];
}

/** 直接打散題目的選項物件：pin 為 last 的固定在最後（content-schema 的 ChoiceOption.pin） */
export function shuffleChoiceOptions<O extends { readonly id: string; readonly pin?: 'last' }>(options: readonly O[], seed: ShuffleSeed): O[] {
  const byId = new Map(options.map((o) => [o.id, o] as const));
  if (byId.size !== options.length) throw new TypeError('shuffleChoiceOptions：選項 ID 重複');
  const pinned = options.filter((o) => o.pin === 'last').map((o) => o.id);
  return shuffleOptions(
    options.map((o) => o.id),
    seed,
    { pinned },
  ).map((id) => byId.get(id) as O);
}
