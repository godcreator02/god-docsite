/** feature-index-steps.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export type CellRole = 'blue' | 'violet' | 'emerald' | 'amber' | 'cyan';

/** 六份汇总文件一份的状态：写出空的与改了的展开画代码行，这一步没变与重写内容没变只画标题栏 */
export type IndexStatus = 'empty' | 'changed' | 'same' | 'rewritten';

export interface IndexFileState {
  status: IndexStatus;
  /** 展开画的那几行（随功能变的行），行号从 1 数 */
  lines?: string[];
  /** 新出现的行号 */
  added?: number[];
  /** 改了的行号 */
  changed?: number[];
}

export interface StepDir {
  name: string;
  /** 这一步新出现的目录：整行左边加一道竖线、行尾写「这一步补进」 */
  isNew: boolean;
  /** 目录里的全部文件 */
  files: string[];
  /** 其中建站器认的（五种文件之一） */
  recognized: string[];
  /** 集合名单（功能包 package.json 的 godDocsite.collections） */
  collections: string[];
  /** 不被认的文件的一句说明（灰色小字），没有是 null */
  unrecognizedNote: string | null;
  /** 重复运行时行尾的胶囊（第 6 步的 trajectory），没有是 null */
  keptNote: string | null;
}

export interface FeatureIndexStep {
  id: string;
  title: string;
  text: string;
  /** 这一步的调用（画面上方玫瑰色胶囊的原文） */
  call: string;
  /** 调用交回的东西（画面上方的灰色小字） */
  returns: string;
  /** 到这一步为止的全部功能目录，按目录名排序 */
  dirs: StepDir[];
  generated: Record<'routes' | 'runtime' | 'mdx' | 'collections' | 'styles' | 'server', IndexFileState>;
}

/** 建站器认的五种文件，顺序固定 */
export declare const featureFiles: string[];
/** 五种文件各自的颜色 */
export declare const fileRoles: Record<string, CellRole>;
/** 六份汇总文件（key 与 generated 的键一致） */
export declare const indexFiles: Array<{ key: 'routes' | 'runtime' | 'mdx' | 'collections' | 'styles' | 'server'; file: string; role: CellRole }>;
export declare const steps: FeatureIndexStep[];
