/** feed-steps.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */
import type { Tone } from '@godcreator/explainer/site';

export interface FeedActor {
  id: string;
  name: string;
  /** 名字下面的小字（如「频道表」） */
  sub?: string;
}

/** 当前这一步点亮的一条箭头：from 与 to 是 actors 的 id，label 写这一步传的东西 */
export interface FeedFlow {
  from: string;
  to: string;
  label: string;
}

export interface StepLine {
  tone: Tone | 'none';
  text: string;
}

export interface FeedStep {
  title: string;
  text: string;
  /** 这一步经手的方块（actors 的 id） */
  active: string[];
  /** 这一步点亮的箭头 */
  flows: FeedFlow[];
  cardTitle: string;
  lines: StepLine[];
}

export declare const actors: FeedActor[];

export declare const steps: FeedStep[];
