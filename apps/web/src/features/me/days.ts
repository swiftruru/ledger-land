// 「我的」備份列右側的「幾天前備份」：本地日期相減（時間帶本地時區位移，跨午夜就算一天）；未來的時間或讀不懂的字串當作今天。
export function daysSinceLocal(iso: string, now: Date = new Date()): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
