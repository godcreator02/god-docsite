/** site-states.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export type StateId = 'stopped' | 'running' | 'failed';
export type EdgeTone = 'info' | 'bad';

export interface StateBox {
  id: StateId;
  x: number;
  y: number;
  w: number;
  label: string;
}

export interface StateEdge {
  id: string;
  tone: EdgeTone;
  d: string;
  label: string;
  labelAt: [number, number];
  /** 弧线外加的小字标注（start 那条有） */
  note?: string;
  noteAt?: [number, number];
}

export interface StateDiagram {
  view: { w: number; h: number };
  boxes: StateBox[];
  edges: StateEdge[];
}

export interface ListRow {
  state: StateId;
  url: string | null;
  error: string | null;
}

export interface StateCase {
  id: string;
  label: string;
  /** 高亮的箭头 id；空数组表示没有状态转换，全部箭头淡下去 */
  lit: string[];
  /** to 是这次停在哪个状态（框加粗描边） */
  states: { to: StateId };
  /** docsite.site.list 里这个站的行 */
  list: ListRow;
  /** 这次操作抛出的报错（不进 list）；没有是 null */
  thrown: string | null;
  /** 画面下方（外壳说明行）的讲解 */
  text: string;
}

export declare const stopNotRunningMessage: string;
export declare const refusedMessage: string;
export declare const exitMessage: string;
export declare const diagram: StateDiagram;
export declare const cases: StateCase[];
