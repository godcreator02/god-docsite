/** release-flow.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export type PlaceId = 'local' | 'github' | 'npmjs' | 'gitea';
export type FlowId = 'commit' | 'release' | 'packs' | 'packs-gitea';
export type PlaceColor = 'blue' | 'violet' | 'emerald' | 'slate';
/** 卡片标题栏的图标名（@godcreator/explainer 零件 Pane 收的那几个） */
export type CardIcon = 'terminal' | 'git' | 'server' | 'user';
/** 卡片在画面里的角色色，同时是 Pane 的 Role */
export type CardRole = 'blue' | 'violet' | 'emerald' | 'slate';

export interface Place {
  id: PlaceId;
  label: string;
  color: PlaceColor;
}

export interface Flow {
  id: FlowId;
  from: PlaceId;
  to: PlaceId;
  label: string;
}

export interface CheckTier {
  tier: string;
  /** 那一档 Pill 的语气 */
  tone: 'info' | 'warn';
  when: string;
  runs: readonly string[];
}

export interface PackTier {
  label: string;
  packs: readonly string[];
}

export type ReleaseCard =
  | { kind: 'checks'; title: string; icon: CardIcon; tiers: readonly CheckTier[]; note: string }
  | { kind: 'command'; title: string; icon: CardIcon; lines: readonly string[] }
  | { kind: 'yaml'; title: string; icon: CardIcon; lines: readonly string[]; note: string }
  | { kind: 'tiers'; title: string; icon: CardIcon; loopLines: readonly { kind: 'code' | 'note'; text: string }[]; tiers: readonly PackTier[] }
  | { kind: 'regression'; title: string; icon: CardIcon; packs: readonly string[]; note: string };

export interface ReleaseStep {
  title: string;
  /** 地图上高亮的方块（这一步所在的） */
  where: readonly PlaceId[];
  /** 亮着的箭头（这一步传出去的东西） */
  lit: readonly FlowId[];
  role: CardRole;
  card: ReleaseCard;
  /** 画面下方（外壳说明行）的讲解 */
  text: string;
}

export declare const places: readonly Place[];
export declare const flows: readonly Flow[];
export declare const triggerLines: readonly string[];
export declare const downloadLine: string;
export declare const loopFirstLine: string;
export declare const publishLine: string;
export declare const loopMiddleNote: string;
export declare const steps: readonly ReleaseStep[];
