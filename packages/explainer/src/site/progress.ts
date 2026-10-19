/**
 * 动画画面里常用的进度换算：Timeline 交给画面的 progress 是本章内 0–1 的进度，画面再把它切成几段、放慢开头结尾。
 */

/** 夹到 0–1 */
export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** 进度 p 在 [from, to] 里走到了哪儿，0–1 */
export const ramp = (p: number, from: number, to: number): number => clamp01((p - from) / (to - from));

/** 开头和结尾慢、中间快 */
export const ease = (value: number): number => value * value * (3 - 2 * value);
