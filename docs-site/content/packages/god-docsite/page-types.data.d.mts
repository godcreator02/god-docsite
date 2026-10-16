/** page-types.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export interface ChainCard {
  /** 这张卡的环节名（卡片标题） */
  title: string;
  /** 标题栏图标 */
  icon: 'file' | 'folder' | 'terminal' | 'server' | 'user' | 'git';
  /** 角色色：三种情况的第二张卡都是 violet（同一个 loader） */
  role: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'slate';
  /** 这个环节手里的真实东西 */
  lines: string[];
}

export interface PageTypeCase {
  id: string;
  label: string;
  text: string;
  chain: ChainCard[];
}

export declare const footer: string;

export declare const cases: PageTypeCase[];
