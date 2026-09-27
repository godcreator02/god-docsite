/**
 * 星轨盘的类型契约：下游送进来的中性输入（DiskInput），与建模交出去的一张盘（TrajectoryModel）。
 * 输入只有盘要画的东西——身份、时刻、短名、分组、种类、关系；卡文件怎么写、怎么校验归下游。
 */

/** 关系两种：取代走主干，转向算支线。 */
export type EdgeKind = "supersede" | "pivot";

/** 一张卡写着的一条关系：target 是另一张卡的身份，还没对卡集合求解。 */
export interface Relation {
  kind: EdgeKind;
  target: string;
}

/** 里程碑：画成盘上一道金黄的环，名字沿环写在 12 点方向。 */
export interface Milestone {
  /** YYYY-MM-DD */
  date: string;
  name: string;
  desc: string;
}

/** 下游送进来的一张卡。 */
export interface DiskCard {
  /** 卡身份，关系的 target 指的就是它 */
  id: string;
  /** 时刻：YYYY-MM-DD 或 YYYY-MM-DDTHH:mm，字典序即时间序 */
  bornAt: string;
  /** 盘上显示的短名 */
  label: string;
  /** 分组：同组同色、占同一片扇区；null 或空白归「未分道」 */
  domain: string | null;
  /** 节点种类：choice / evidence / derivation / reference / snapshot 各有形状，其余与 null 画缺省形状 */
  kind: string | null;
  relations: Relation[];
}

/** 盘心：整张盘的主人，不占盘位，画在正中。 */
export interface DiskCenter {
  id: string;
  label: string;
  /** 诞生时刻，参与定盘的时间范围；null = 不知道 */
  bornAt: string | null;
  /** 侧栏信息行里显示的种类 */
  kind: string | null;
  milestones: Milestone[];
}

/** 下游送进来的一张盘：盘心加一组卡。盘心为 null 时盘照画、盘心无主。 */
export interface DiskInput {
  center: DiskCenter | null;
  cards: DiskCard[];
}

/** 盘上的一张卡：输入的卡去掉关系，分组补上「未分道」。 */
export interface Card {
  id: string;
  /** 分组；输入里没有分组的卡归 NO_DOMAIN */
  domain: string;
  bornAt: string;
  label: string;
  kind: string | null;
}

/** 关系边：from 是源头（被取代的旧卡 / 转向起点），to 是写着这条关系的卡。 */
export interface Edge {
  from: string;
  to: string;
  kind: EdgeKind;
}

/** 指向卡集合之外的关系：盘上不画这条边。 */
export interface BrokenRel {
  id: string;
  key: "supersedes" | "pivots-from";
  target: string;
}

/** 一棵关系树：同一摊事占同一块地。主干只沿取代链走，转向长出来的算支线。 */
export interface Tree {
  /** 本分量全部成员身份 */
  ids: string[];
  /** 主干链：择优规则是比终点（更晚），不比长度 */
  spine: string[];
  /** 支线，各自按 bornAt 排序 */
  sublines: string[][];
  /** 最早成员的 bornAt，树的诞生时刻 */
  birth: string;
}

/** 建模交出去的一张盘，布局引擎的唯一输入。 */
export interface TrajectoryModel {
  center: DiskCenter | null;
  /** 盘心的里程碑里落在盘时间范围内的那些 */
  milestones: Milestone[];
  cards: Card[];
  edges: Edge[];
  broken: BrokenRel[];
  /** 被取代的卡：有取代出边（别的卡取代了它）——淡出形态由它驱动 */
  supersededIds: ReadonlySet<string>;
  /** 领域序按卡的 bornAt 序首次出现累积，扇区分配靠它；有未分道卡时哨兵值压尾 */
  domains: string[];
  byId: Record<string, Card>;
  trees: Tree[];
  /** 孤星：两种关系一条都没结的卡 */
  isolated: Card[];
  /** 卡身份到所属分量代表的映射，没结关系的卡不在表里 */
  compOf: Record<string, string>;
  /** 天序数，不是日期字符串——半径标度全下游吃它；day0 含盘心诞生时刻 */
  day0: number;
  dayMax: number;
}
