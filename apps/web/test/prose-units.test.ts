// 中文的不斷開單位（components/prose-units.ts，M3 驗收第 7 輪）：兩字以上的詞、被切成單字的實詞與引號裡的短介面名稱整塊不斷，
// 虛詞與標點前後可以斷。首次載入的橫幅訊息事先插入 U+2060（banner-joined-ids.ts），zh-TW catalog 要和 joinWords 的結果一致。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BANNER_JOINED_IDS } from '../src/components/banner-joined-ids.ts';
import { WORD_JOINER, joinWords, proseUnits } from '../src/components/prose-units.ts';

/** 整塊不斷的單位 */
const kept = (text: string) => (proseUnits(text) ?? []).filter(([, keep]) => keep).map(([t]) => t);
/** 單位串回原字 */
const joined = (text: string) => (proseUnits(text) ?? []).map(([t]) => t).join('');

describe('proseUnits', () => {
  it('兩字以上的詞整塊：「進度消／失」不再出現', () => {
    expect(kept('都可能讓進度消失。')).toEqual(expect.arrayContaining(['可能', '進度', '消失']));
  });

  it('被切成單字的實詞黏到相鄰的詞：主畫面、備份碼、錯題本', () => {
    expect(kept('加入主畫面後第一次打開')).toContain('加入主畫面');
    expect(kept('複製備份碼')).toEqual(expect.arrayContaining([expect.stringContaining('備份碼')]));
    expect(kept('星星、錯題本、徽章')).toContain('錯題本');
  });

  it('虛詞前後可以斷：不黏成長串', () => {
    // 「讓」「都」是虛詞，自己不在任何整塊的單位裡
    for (const unit of kept('都可能讓進度消失。')) expect(unit).not.toMatch(/[讓都]/);
    // 前面的虛詞不黏到後面的單字上：「的」後面可以斷
    for (const unit of kept('收集的內容是瀏覽的頁面路徑')) expect(unit.startsWith('的')).toBe(false);
  });

  it('助詞黏到前面的詞、後面可以斷：行首不是「的」「了」「時」（第 9 輪）', () => {
    const text = '收集的內容是瀏覽的頁面路徑，走錯了可以回頭，離線或被擋下時略過。';
    expect(kept(text)).toEqual(expect.arrayContaining(['收集的', '瀏覽的', '走錯了', '擋下時']));
    // 可以換行的地方（單位的開頭）不會是助詞
    for (const [t] of proseUnits(text) ?? []) expect(t).not.toMatch(/^[的地得了著過嗎呢吧啊時]/);
    // 前面是英文、閉引號或閉括號時一起黏上
    expect(kept('例如 Safari 的規則')).toContain('Safari 的');
    expect(kept('先在那裡「匯出到 App」的按鈕')).toContain('「匯出到 App」的');
    expect(kept('按下「開始掃描」時才要求')).toContain('「開始掃描」時');
    // Segmenter 切成一個詞、但其實是助詞加下一個字的（「的是」「了一」「時會」）拆開
    expect(kept('唯一直接沿用的是故事')).toContain('沿用的');
    expect(kept('有關卡用到時會自動移除')).toEqual(expect.arrayContaining([expect.stringMatching(/用到時$/)]));
    // 「地圖」「時候」這類以助詞開頭的詞不受影響
    expect(kept('回到闖關地圖')).toContain('地圖');
    expect(kept('切換語言的時候')).toEqual(expect.arrayContaining(['語言的', '時候']));
  });

  it('「也」黏到後面的詞、前面可以斷：行尾不停在「也」（第 9 輪，聲明卡 1280 的「章節也／一樣」）', () => {
    const units = kept('涉及本益比、融資、估價的章節也一樣，只用來練習');
    expect(units).toContain('也一樣');
    expect(units).toContain('章節');
    expect(kept('進度也比較不容易被清除')).toContain('也比較');
    for (const [t] of proseUnits('後來覺得這樣太細了，也太打擾。') ?? []) expect(t).not.toMatch(/也$/);
  });

  it('「每」「最」黏到後面的詞；單字的動詞接「不」開頭的詞拆回去也黏著；Segmenter 切開的會計用語先併起來（第 9 輪 handoff）', () => {
    expect(kept('並說出每一層在算什麼')).toContain('每一層');
    expect(kept('最底下是本期淨利')).toContain('最底下');
    for (const [t] of proseUnits('並說出每一層，最底下是淨利') ?? []) expect(t).not.toMatch(/[每最]$/);
    expect(kept('本益比算不出來')).toContain('算不出來');
    expect(kept('如果為了衝營收放寬賒銷條件')).toEqual(expect.arrayContaining([expect.stringContaining('營收'), '賒銷']));
    expect(kept('改採沖減法處理').some((u) => u.includes('沖減'))).toBe(true);
    expect(kept('籌資活動的現金流量')).toContain('籌資');
  });

  it('黏起來超過 6 個字就拆回原本的詞，詞本身仍整塊', () => {
    const units = kept('我列一長串大問題給老師。');
    for (const unit of units) expect(unit.length).toBeLessThanOrEqual(6);
    expect(units).toContain('問題');
    // 結尾的助詞不算在 6 個字裡；拆回時助詞仍黏著前面的詞
    expect(kept('授權說明裡寫清楚了。')).toContain('說明裡寫清楚了');
    expect(kept('我列一長串大問題了')).toContain('問題了');
  });

  it('引號裡的短介面名稱整個不斷，太長的照一般規則', () => {
    expect(kept('先在那裡「匯出到 App」，再回到這裡')).toContain('「匯出到 App」');
    expect(kept('按下「掃描課堂 QR」裡的「開始掃描」')).toEqual(expect.arrayContaining(['「掃描課堂 QR」', '「開始掃描」']));
    expect(kept('看到「這是一個非常非常長的介面名稱」時')).not.toContain('「這是一個非常非常長的介面名稱」');
    // 全形括號與圈號數字算一個字寬（第 8 輪）：「步驟③（勾稽點 C）」畫面上約 9 個字寬，不整塊
    expect(kept('先看「步驟③（勾稽點 C）」那一列')).not.toContain('「步驟③（勾稽點 C）」');
    expect(kept('先看「步驟③」那一列')).toContain('「步驟③」');
  });

  it('否定詞黏到後面的詞，前面可以換行：「只有／不收集」，行尾不停在「不」（第 8 輪）', () => {
    const text = '網站沒有帳號、不用 cookie，只有不收集個資的匿名流量統計。';
    const units = kept(text);
    expect(units).toContain('只有');
    expect(units.some((u) => u.startsWith('不收集'))).toBe(true);
    // 單位切開的地方（可以換行的地方）前面不會是否定詞
    for (const [t] of proseUnits(text) ?? []) expect(t).not.toMatch(/[不沒未別]$/);
    for (const [t] of proseUnits('不登入、不收集姓名或學號、不把作答資料送出裝置；不載入任何第三方腳本。') ?? []) expect(t).not.toMatch(/[不沒未別]$/);
    expect(kept('或長時間未使用時')).toEqual(expect.arrayContaining([expect.stringMatching(/^未使用/)]));
    // 前面是單字的動詞時也黏上
    expect(kept('進度可能存不進去')).toEqual(expect.arrayContaining([expect.stringContaining('存不進去')]));
    // Segmenter 切成一個詞、結尾是否定詞的副詞（「也不」「還沒」）也黏到後面：「也不／影響」不再出現
    expect(kept('載入失敗也不影響學習。')).toContain('也不影響');
    expect(kept('還沒加入就看圖解。')).toEqual(expect.arrayContaining([expect.stringContaining('還沒加入')]));
    for (const [t] of proseUnits('離線時不送出，載入失敗也不影響學習。') ?? []) expect(t).not.toMatch(/[不沒未]$/);
  });

  it('說明直接提到的按鈕名稱整塊不斷：「選擇／備份檔」不再出現（第 8 輪）', () => {
    const units = kept('再回到這裡，貼上備份碼或選擇備份檔；匯入會和這裡的紀錄合併。');
    expect(units).toEqual(expect.arrayContaining(['貼上備份碼', '選擇備份檔']));
    expect(joinWords('貼上備份碼或選擇備份檔')).toBe('貼⁠上⁠備⁠份⁠碼或選⁠擇⁠備⁠份⁠檔');
  });

  it('標點不在整塊的詞裡，單位串起來等於原字', () => {
    const text = '清除瀏覽器資料，或長時間未使用時瀏覽器主動清除（例如 Safari 的規則），都可能讓進度消失。';
    expect(joined(text)).toBe(text);
    for (const unit of kept(text)) expect(unit).not.toMatch(/[，。、（）]/);
  });

  it('英文或沒有中文時照原字', () => {
    expect(proseUnits('Scroll down to “Add to Home Screen”.')).toBeNull();
    expect(joinWords('Scroll down to “Add to Home Screen”.')).toBe('Scroll down to “Add to Home Screen”.');
  });
});

describe('joinWords', () => {
  it('詞裡的字之間放 U+2060，詞與詞之間不放；引號名稱的空格換成不斷行空格', () => {
    // 「這」「的」「被」是虛詞，前後可以斷；「台」黏到「裝置」
    // 「的」黏到前面的詞（第 9 輪）
    expect(joinWords('這台裝置的進度可能被清除。')).toBe(['這', '台\u2060裝\u2060置\u2060的', '進\u2060度', '可\u2060能', '被', '清\u2060除', '。'].join(''));
    // 英文後面的助詞：空格換成不斷行空格；閉括號直接接漢字時插 U+2060
    expect(joinWords('主畫面 App 的紀錄')).toContain('App\u00a0的');
    expect(joinWords('（例如 Safari）的相機')).toContain('）\u2060的');
    expect(joinWords('先在那裡「匯出到 App」，')).toContain('「\u2060匯\u2060出\u2060到\u00a0App」');
  });

  it('重算一次結果不變', () => {
    const once = joinWords('如果你之前在 Safari 分頁練習過，先在那裡「匯出到 App」，再回到這裡。');
    expect(joinWords(once)).toBe(once);
  });
});

/** zh-TW catalog 的訊息（msgid 是明確 ID） */
function zhCatalog(): Map<string, string> {
  const po = readFileSync(new URL('../src/locales/zh-TW/messages.po', import.meta.url), 'utf8');
  const map = new Map<string, string>();
  for (const m of po.matchAll(/^msgid "(.+)"\nmsgstr "(.*)"$/gm)) map.set(m[1]!, JSON.parse(`"${m[2]!}"`) as string);
  return map;
}

describe('首次載入橫幅的中文訊息（banner-joined-ids.ts）', () => {
  const catalog = zhCatalog();
  it.each(BANNER_JOINED_IDS)('%s 已經插入 U+2060，和 joinWords 的結果一致', (id) => {
    const msg = catalog.get(id);
    expect(msg, `zh-TW catalog 沒有 ${id}`).toBeDefined();
    expect(msg!.includes(WORD_JOINER), `${id} 沒有 U+2060：中文改過後要用 joinWords 重算`).toBe(true);
    const expected = joinWords(msg!);
    expect(msg, `${id} 和 joinWords 的結果不同，請把原始碼裡的中文換成：${JSON.stringify(expected)}`).toBe(expected);
  });
});
