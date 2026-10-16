/** export-steps.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

/** 行的语气：good 这一步通过的部分、bad 报错、warn 要人注意、none 中性摆东西 */
export type LineTone = 'good' | 'bad' | 'warn' | 'none';

/** 卡片旁状态点的颜色；none 表示还没有（画面不画点） */
export type DotTone = 'good' | 'warn' | 'bad' | 'info' | 'none';

export interface StepLine {
  tone: LineTone;
  text: string;
}

/** 右上角「锁」小卡片：phase 一句话加锁文件当前内容的展示行 */
export interface LockCard {
  phase: string;
  dot: DotTone;
  lines: string[];
}

/** 右上角「任务状态」小卡片 */
export interface JobCard {
  label: string;
  dot: DotTone;
}

export interface ExportStep {
  title: string;
  /** 左边卡片的标题 */
  cardTitle: string;
  /** 左边卡片里这一步手里的东西 */
  lines: StepLine[];
  lock: LockCard;
  job: JobCard;
  /** 画面下方（外壳说明行）的讲解 */
  text: string;
}

export declare const verifyWording: {
  status: string;
  mismatch: string;
};

export declare const lockWording: {
  writtenByNode: string[];
  orphaned: string;
};

export declare const snapshotWording: {
  changed: string;
};

export declare const executeWording: {
  engineChanged: string;
  command: string[];
};

export declare const pythonClaim: {
  lockLines: string[];
};

export declare const steps: ExportStep[];
