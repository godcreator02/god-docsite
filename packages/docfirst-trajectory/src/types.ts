/**
 * 轨迹卡的类型契约。卡身份 = 文件名主干（`<YYYY-MM-DD>-<slug>`，文件是 `.mdx` 或 `.md`），frontmatter 装语义：
 * `type: root` 认根卡，`parent` 决定聚盘（含盘即上盘，`domain` 只是泳道分组），
 * `merged-in`（⊆ parent，仅根卡）标注哪些父盘上子项目改平铺摊入而非虫洞投影；
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

/** 项目根卡：一张盘的主人。自己的盘上不设节点——盘心圆盘就是它；
 * 所属项目的盘上投影为虫洞（见 Wormhole）。 */
export interface ProjectRoot {
  /** 项目 id 铁律 = 文件名主干，不再靠字段自指互证 */
  id: string;
  title: string;
  /** 项目短名：盘心与盘选择器显示它 */
  label: string;
  bornAt: string;
  path: string;
}

/** 虫洞：子项目根卡（有 parent 的根卡）在所属项目盘上的投影节点，merged-in 未列出
 * 该父盘时的默认待遇——盘上的「通往另一张盘」入口，点击穿越到子项目的盘（id 即目标
 * 项目 id）。merged-in 列出该父盘的改走平铺投影，子项目根卡化成普通 Card 摊进 cards，
 * 不再出现在这里。不混进 cards：不进树 / 孤星 / 领域泳道体系，布局单列、染色走专属通道。 */
export interface Wormhole {
  /** 子项目根卡身份，即目标项目 id */
  id: string;
  title: string;
  /** 子项目短名（根卡 label）：盘上显示名 */
  label: string;
  bornAt: string;
  path: string;
}

/** 盘清单条目：一张盘的 rootId 与成员卡身份列表。 */
export interface DiskInfo {
  rootId: string;
  memberIds: string[];
}

/** 日期范围（天序数闭区间）：时间窗聚焦——范围外的卡不上盘，buildModel 裁剪用。 */
export interface DayRange {
  d0: number;
  d1: number;
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

/** 坏关系示众：关系指向了本盘卡集合外的目标（按盘算，同一张卡在别的盘上可能是好的）。 */
export interface BrokenRel {
  id: string;
  key: string;
  target: string;
}

/** 一条病：形状校验（坏 born-at 格式 / parent、merged-in 元素不是合法卡身份）
 * + 存在性校验（缺 born-at / label，内卡缺 parent）
 * + 一致性校验（parent 含自身、merged-in ⊄ parent、内卡写 merged-in）
 * + 正文关系行写歪（行头对但行形不合，不静默吞行）
 * + docfirst 引用记号（卡正文里出现 docfirst 草稿或正式记号，见 validate.ts）。
 * 病卡列名示众；born-at 坏的卡同时被挡在盘外（半径标度一路 NaN）。 */
export interface Problem {
  field: "born-at" | "parent" | "merged-in" | "label" | "relation" | "docfirst";
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
 * 但尚未归盘、尚未按盘求解关系。 */
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
  mergedIn: string[];
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

/** 一个项目的建模产物——一张盘，布局引擎的唯一输入。 */
export interface TrajectoryModel {
  /** 本盘的根卡；根卡不存在时为 null（盘照出，盘心无主） */
  root: ProjectRoot | null;
  cards: Card[];
  /** 虫洞：子项目根卡在本盘的投影节点（按 born-at 升序） */
  wormholes: Wormhole[];
  edges: Edge[];
  broken: BrokenRel[];
  /** 身份撞车的卡：同一张卡经多条 parent 路径重复摊进本盘时报出来 */
  dupes: string[];
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
