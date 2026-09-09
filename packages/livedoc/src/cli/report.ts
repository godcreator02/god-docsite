/**
 * `livedoc check --json` 的机读形态。形状是契约：gwb-live-doc 件的 `live-doc.stale` 靠它列
 * 「待重写页与漂移的钉」，加字段可以、改名删字段不可以。整份一行 JSON 打到 stdout，退出码跟
 * 人读模式一样（有红退 1）。
 *
 *   {
 *     "ok": false,                 // red === 0
 *     "red": 3,                    // 红的总数：缺失 + 孤儿 + 名册外组件 + 生成物不新鲜 + 失踪文档 + 病卡
 *     "docs": [                    // 每篇被扫到的文档一条，按文档身份排序
 *       {
 *         "doc": "content/docs/a.mdx",
 *         "red": 1,
 *         "items": [               // 每处引用一条，按在文档里的先后
 *           { "target": "../src/a.ts:2-3", "kind": "span", "status": "changed",
 *             "line": 12,          // 记号在文档里的第几行（1 起）
 *             "lines": [2, 3],     // 行段今天在文件里的位置（比较器跟过 diff）；别的种类是 [1, 项数]
 *             "draft": false,      // 还是草稿记号（没 confirm 过）
 *             "reason": "vanished",// 状态的细分理由，没有就不带（同 core 的 Item.reason）
 *             "diff": "- a\n+ b" } // 有变动时的 - / + 文本，没有就不带
 *         ],
 *         "orphans": ["../src/gone.ts:1-2"],           // 记录簿里有、文档里没了的引用
 *         "components": [{ "name": "Callout", "line": 7 }], // 名册外组件
 *         "outputs": [             // 挂了 outputs 映射的才有；形状归 project 的摆放模块定
 *           { "to": "../README.md", "status": "fresh", "fresh": true },   // 四态：fresh / missing（生成物还不在）/
 *           { "to": "../x/SKILL.md", "status": "no-frontmatter", "fresh": false, "missing": ["description"] }
 *         ]                       // stale（跟源不一致）/ no-frontmatter（源头部缺点名的字段）；fresh 是判定结果
 *       }
 *     ],
 *     "strays": ["docs/old.md"],   // 记录簿里还留着、文档本身已经不在的
 *     "trajectory": [              // 轨迹卡校验的病，每条一病；没配 trajectory 目录就是空数组
 *       { "path": "content/trajectory/2026-01-01-x.mdx", "field": "born-at", "value": "一月一号", "reason": "…" }
 *     ]
 *   }
 *
 * 「待重写页」= items 里有 changed / missing 的、或 outputs 里 `fresh` 为假的文档；「漂移的钉」= 那些 item。
 */
import type { Status, Target } from "../engine/index.ts";
import type { PlacedCheck } from "../host/index.ts";

/** 一个摆放落点的新鲜度。**形状由 project 的摆放模块定**，这儿只借个名字给报告用——
 *  四态怎么算出来的不归命令行解释，读报告的人照 `fresh` 决定要不要重摆 */
export type OutputReport = PlacedCheck;

/** 一处引用核对完的样子 */
export interface RefReport {
  /** 目标的文本形态，同记录簿的键与人读报告里的那一截（`file:a-b`、`tree dir depth=1`……） */
  target: string;
  kind: Target["kind"];
  status: Status;
  /** 记号在文档里的第几行，1 起 */
  line: number;
  /** 行段今天在文件里的位置；别的种类是 [1, 项数] */
  lines: [number, number];
  /** 还是草稿记号 */
  draft: boolean;
  reason?: string;
  diff?: string;
}

export interface ComponentReport {
  name: string;
  line: number;
}

export interface DocReport {
  doc: string;
  /** 这篇贡献的红：缺失 + 孤儿 + 名册外组件 + 不新鲜的摆放落点 */
  red: number;
  items: RefReport[];
  orphans: string[];
  components: ComponentReport[];
  outputs: OutputReport[];
}

/** 轨迹卡的一条病，path 相对项目根 */
export interface CardProblemReport {
  path: string;
  field: string;
  value: string;
  reason: string;
}

export interface CheckReport {
  ok: boolean;
  red: number;
  docs: DocReport[];
  strays: string[];
  trajectory: CardProblemReport[];
}
