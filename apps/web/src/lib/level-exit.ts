// 作答頁中途離開的關卡（站規 2.4.1）：作答頁的返回圖示和結果頁的「回到地圖」都連到 /play/?from=<levelId>，
// 地圖要分辨「過關回來」（點亮星星、沿路線走）和「還沒做完就離開」（只把角色與捲動放在那一關，顯示「已暫存，可隨時回來繼續」）。
// 作答頁卸載時記下，地圖讀一次就清掉。只記在記憶體：站內換頁才需要；重新整理或直接開網址時沒有紀錄，地圖照一般的 ?from 流程。
let leftUnfinished: string | null = null;

/** 作答頁卸載而且離開了這一關時呼叫：還沒完成傳關卡 ID，已完成或沒有工作階段傳 null */
export function noteLevelExit(levelId: string | null): void {
  leftUnfinished = levelId;
}

/** 地圖處理 ?from 時呼叫：這一關是不是剛剛中途離開的；讀過就清掉，同一次離開只算一次 */
export function takeLeftUnfinished(levelId: string): boolean {
  const hit = leftUnfinished === levelId;
  leftUnfinished = null;
  return hit;
}
