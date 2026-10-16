/** layout-columns.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

/** 图里各区固定用的角色色名（@godcreator/explainer 的 Role） */
export type AreaRoleKey = 'sidebar' | 'header' | 'tocPopover' | 'main' | 'toc';

/** 页面框里可用的 grid 区名（side 是 sidebar、pop 是 toc-popover 的简写，只为模板短） */
export type CellArea = 'side' | 'header' | 'pop' | 'main' | 'toc';

/** 页面框里的一个区 */
export interface FrameCell {
  /** grid 区名（与 areas 里的名字一致） */
  area: CellArea;
  /** 区里写的名字（grid-area 的真名） */
  label: string;
  /** 名字后面的小注（宽度、正文上限） */
  sub?: string;
}

/** 底下一行「哪个部件带的哪个类」的一条 */
export interface WhoLine {
  /** 与哪个区同色；undefined 画空心点（部件不在了） */
  role?: AreaRoleKey;
  text: string;
}

export interface LayoutCase {
  id: string;
  label: string;
  /** 框上方一行：容器上此刻的变量值 */
  vars: { sidebar: string; toc: string };
  /** 缩小页面框的 grid 模板（内联 style 用） */
  columns: string;
  rows: string;
  areas: string[];
  cells: FrameCell[];
  who: WhoLine[];
  /** 画面下方（外壳说明行）的讲解 */
  text: string;
}

export declare const areaRoles: Record<AreaRoleKey, 'violet' | 'slate' | 'amber' | 'emerald' | 'cyan'>;

export declare const cases: LayoutCase[];
