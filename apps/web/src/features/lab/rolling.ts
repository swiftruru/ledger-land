// 數字滾動（07 第 4.5 節的 --ll-dur-lab）：變動格的金額從交易前滾到交易後，時長和 tokens 的 motion.duration.lab 相同（450ms；
// 減少動態時不滾，直接是交易後）。這裡不 import tokens，免得把整包 tokens 帶進實驗室的 chunk；lab-rolling.test.ts 會對帳。
export const LAB_ROLL_MS = 450;

/** 標準曲線的近似（ease-out cubic），只用在數字滾動；CSS 的動畫用 --ll-ease-standard */
export function easeOut(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

/** 滾到 elapsed 毫秒時顯示的值：整數金額四捨五入，到時間一定等於 to */
export function rollingValue(from: number, to: number, elapsedMs: number, durationMs: number = LAB_ROLL_MS): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) return to;
  if (elapsedMs <= 0) return from;
  return Math.round(from + (to - from) * easeOut(elapsedMs / durationMs));
}
