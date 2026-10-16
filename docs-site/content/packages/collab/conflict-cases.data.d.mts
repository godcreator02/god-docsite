/** conflict-cases.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export interface FileChange {
  /** 改到的文件，相对协作仓仓根 */
  path: string;
  /** 新文件：没有旧行，只有新行 */
  created?: boolean;
  old?: string[];
  now?: string[];
}

export interface SideChange {
  /** 这一边改了什么（小注，摆在卡片标题栏右端） */
  note: string;
  files: FileChange[];
}

export interface ConflictCase {
  id: string;
  label: string;
  text: string;
  bob: SideChange;
  carol: SideChange;
  /** true：git 自动合上；false：git 报冲突 */
  merged: boolean;
  /** git 实跑输出的关键行，摆在终端窗口里 */
  gitLines: string[];
  /** 冲突时：网站解码这条记录报的那句（第几行是冲突标记） */
  decodeLine?: string;
}

export declare const repo: {
  taskFile: string;
  moduleFile: string;
  taskStatusTodo: string[];
  taskStatusDoing: string[];
  taskStatusDone: string[];
  taskTitle: string[];
  taskTitleChanged: string[];
  taskDue: string[];
  taskDueChanged: string[];
  moduleDue: string[];
  moduleDueChanged: string[];
};

export declare const gitOutputs: {
  autoMerge: string;
  merged: string;
  conflict: string;
  conflictHint: string;
  createdCarol: string;
};

export declare const cases: ConflictCase[];
