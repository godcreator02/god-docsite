/** turf-map.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

/** 胶囊的角色色，与这一页接缝图一致：docfirst 紫、code-pin 蓝、doc-export 绿、trajectory 青、没人管的灰 */
export type TreeRole = 'violet' | 'blue' | 'emerald' | 'cyan' | 'slate';

export interface TreeKind {
  id: string;
  role: TreeRole;
  /** 树行与图例里的胶囊文案 */
  label: string;
  /** 图例里胶囊后的一句话 */
  note: string;
}

export interface TreeNode {
  name: string;
  /** kinds 里的 id；目录行也可以有（app/components） */
  kind?: string;
  children?: TreeNode[];
}

export declare const kinds: TreeKind[];
export declare const tree: TreeNode;
export declare const note: string;
