/**
 * 轨迹卡的类型契约。卡身份 = 文件名主干（`<YYYY-MM-DD>-<slug>`，文件是 `.mdx` 或 `.md`），frontmatter 装语义：
 * `type: root` 认根卡，一个卡目录只有一张根卡、只画一张盘；非根卡的 `parent` 写那张根卡的身份
 * （`domain` 只是泳道分组）；
 * `born-at` 是时间轴（分钟级 `YYYY-MM-DDTHH:mm`，日级 `YYYY-MM-DD` 兼容）；
 * `supersedes:: [文字](卡身份.md)` / `pivots-from:: [文字](卡身份.md)` 是正文里的关系边，
 * 标准 md link 与 wikilink 两种写法都认。
 * 逻辑出自老仓 `god-flow-panels` 的 `node/star/`（只读参考，本仓不 import 它，只搬逻辑）。
 */

/** 关系两种：取代走主干，转向算支线。 */
export type EdgeKind = "supersede" | "pivot";

/** 一张项目内卡——frontmatter 装身份与语义，文件名主干即身份。
 * 「被取代」靠 supersedes 链（取代出边）表达，不落字段。 */
export interface Card {
  /** 卡身份，即文件名主干，也是连边反查主键 */
  id: string;
  /** 身份去掉前置日期段后的那一截（即 slug），label 读不到时的兜底显示名 */
  title: string;
  /** 泳道名；无 domain 的卡归「未分道」隐式组（model.ts 的 NO_DOMAIN 哨兵值） */
  domain: string;
  /** born-at 原样字符串：分钟级 YYYY-MM-DDTHH:mm，存量日级 YYYY-MM-DD；字典序即时间序 */
  bornAt: string;
  /** 图上短名；label 必填，读不到时建模层已回退标题兜底 */
  label: string;
  /** 相对扫描目录的文件路径 */
  path: string;
}

/** 项目根卡：盘的主人。盘上不设节点——盘心圆盘就是它。 */
export interface ProjectRoot {
  /** 项目 id 铁律 = 文件名主干，不再靠字段自指互证 */
  id: string;
  title: string;
  /** 项目短名：盘心与盘选择器显示它 */
  label: string;
  bornAt: string;
  path: string;
}

/** 关系边：from 是源头（被取代的旧卡 / 转向起点），to 是本卡。 */
export interface Edge {
  from: string;
  to: string;
  kind: EdgeKind;
}

/** 正文里写着的一条关系边，尚未对卡集合求解：target 是链接目标剥掉 `.md`、
 * 百分号编码、锚点与别名之后的卡身份。 */
export interface Relation {
  kind: EdgeKind;
  target: string;
}

/** 坏关系示众：关系指向了盘上卡集合外的目标。 */
export interface BrokenRel {
  id: string;
  key: string;
  target: string;
}

/** 一条病：形状校验（坏 born-at 格式）
 * + 存在性校验（缺 born-at / label，非根卡缺 parent）
 * + 一致性校验（跨文件，在 scanCards 里查：卡目录里根卡多于一张、根卡写了 parent、
 *   非根卡的 parent 不是那张根卡的身份）
 * + 正文关系行写歪（行头对但行形不合，不静默吞行）
 * + docfirst 引用记号（卡正文里出现 docfirst 草稿或正式记号；这一条由 `@godcreator/docfirst-workflow`
 *   读卡目录时查，这个包只留字段名）。
 * 病卡列名示众；born-at 坏的卡同时被挡在盘外（半径标度一路 NaN）。 */
export interface Problem {
  field: "born-at" | "parent" | "type" | "label" | "relation" | "docfirst";
  value: string;
  /** 人话说明，示众用 */
  reason: string;
}

/** 一个文件的报病：按文件归拢，面板照这个粒度列清单。 */
export interface SickFile {
  path: string;
  problems: Problem[];
}

/** 一棵关系树：同一摊事占同一块地。主干只沿取代链走，转向长出来的算支线。 */
export interface Tree {
  /** 本分量全部成员身份 */
  ids: string[];
  /** 主干链：择优规则是比终点（更晚），不比长度 */
  spine: string[];
  /** 支线，各自按 born-at 排序 */
  sublines: string[][];
  /** 最早成员的 born-at，树的诞生时刻 */
  birth: string;
}

/** 人工钉的时间锚，从项目根卡正文「## 里程碑」固定区块解析（日期日级，不动）。 */
export interface Milestone {
  date: string;
  name: string;
  desc: string;
}

/** 扫盘产物里的一张卡：frontmatter 已解析、正文关系边与里程碑已提取，
 * 关系尚未对卡集合求解。 */
export interface RawCard {
  /** 卡身份 = 文件名主干 */
  id: string;
  /** 身份去掉前置日期段后的那一截，label 兜底用 */
  title: string;
  /** 相对扫描目录的文件路径 */
  path: string;
  mtime: number;
  /** frontmatter 原样取值（缺省为 null），`root` 是唯一被读出布尔语义的取值 */
  type: string | null;
  parent: string[];
  domain: string | null;
  /** 生效短名：frontmatter 的 label，缺了回退 title */
  label: string;
  /** 自由槽位：不读不校验，原样透出给消费方 */
  status: string | null;
  bornAt: string;
  /** 正文关系边（未对卡集合求解） */
  relations: Relation[];
  /** 里程碑：仅根卡有，非根卡恒 null */
  milestones: Milestone[] | null;
}

/** 一个卡目录的建模产物——一张盘，布局引擎的唯一输入。 */
export interface TrajectoryModel {
  /** 卡目录里唯一那张根卡；根卡不是恰好一张时为 null（问题已报进 sick，盘照出，盘心无主） */
  root: ProjectRoot | null;
  cards: Card[];
  edges: Edge[];
  broken: BrokenRel[];
  /** 被取代的卡：有取代出边（别的卡 supersedes 它）——淡出形态由它驱动 */
  supersededIds: ReadonlySet<string>;
  /** 领域序按卡的 born-at 序首次出现累积，扇区分配靠它；有未分道卡时哨兵值压尾 */
  domains: string[];
  byId: Record<string, Card>;
  trees: Tree[];
  /** 孤星：两种关系一条都没结的卡 */
  isolated: Card[];
  /** 卡身份到所属分量代表的映射，没结关系的卡不在表里 */
  compOf: Record<string, string>;
  /** 天序数，不是日期字符串——半径标度全下游吃它；day0 含根卡诞生时刻 */
  day0: number;
  dayMax: number;
}
