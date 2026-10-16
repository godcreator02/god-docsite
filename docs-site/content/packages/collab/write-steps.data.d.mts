/** write-steps.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

/** 行的语气：good 这一路通过、bad 那一路被拒、none 中性摆东西 */
export type LineTone = 'good' | 'bad' | 'none';

export interface StepLine {
  tone: LineTone;
  text: string;
}

export interface WriteStep {
  title: string;
  /** 画面右侧的一句说明 */
  note: string;
  /** 左边卡片的标题 */
  cardTitle: string;
  /** 左边卡片里这一步手里的东西 */
  lines: StepLine[];
  /** 画面下方（外壳说明行）的讲解 */
  text: string;
}

export declare const passCase: {
  person: string;
  field: string;
  value: string;
  result: { status: number; body: string };
};

export declare const rejectCase: {
  person: string;
  field: string;
  value: string;
  message: string;
  result: { status: number; body: string };
};

export declare const taskFieldsAnyoneMayChange: string;

export declare const steps: WriteStep[];
