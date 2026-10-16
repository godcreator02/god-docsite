/** meta-pages.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

/** 侧栏里的一类节点：页面、文件夹、分隔线、链接 */
export type SideKind = 'page' | 'folder' | 'separator' | 'link';

export interface SideItem {
  kind: SideKind;
  name: string;
  /** kind 为 link 时的目标地址 */
  url?: string;
  /** kind 为 folder 时展开的子项名字 */
  children?: string[];
}

export interface MetaCase {
  id: string;
  label: string;
  /** meta.json 的内容（CodeLines 的行） */
  metaLines: string[];
  /** 主树里排出来的侧栏 */
  sidebar: SideItem[];
  /** root.fallback 子树里的项；null 表示这一种写法没有 fallback 树 */
  fallback: SideItem[] | null;
  /** 画面下方（外壳说明行）的讲解 */
  text: string;
}

export declare const folderNote: string;

export declare const cases: MetaCase[];
