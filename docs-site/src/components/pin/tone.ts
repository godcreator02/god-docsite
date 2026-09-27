/** 钉码的四种状态在讲解播放器里用哪种状态色；PinStory 与 PinJudge 共用，保证同一种状态两处颜色一致 */
import type { Tone } from '@godcreator/explainer-player';

export type PinStatus = 'fresh' | 'changed' | 'missing' | 'unconfirmed';

export const toneOfStatus: Record<PinStatus, Tone> = {
  fresh: 'good',
  changed: 'warn',
  missing: 'bad',
  unconfirmed: 'pending',
};
