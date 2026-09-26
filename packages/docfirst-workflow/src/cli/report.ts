/**
 * `docfirst check --json` 的机读形态。形状是契约：读它的是别的程序（门禁、编辑器、想自己列
 * 「待重写页与漂移的钉」的 agent）。整份一行 JSON 打到 stdout，退出码跟人读模式一样（有红退 1）。
 *
 *   {
 *     "ok": false,                 // red === 0
 *     "red": 3,                    // 红的总数：缺失 + 拦提交的黄 + 名册外组件 + 生成物不新鲜 + 病卡
 *     "docs": [                    // 每篇被扫到的文档一条，按文档身份排序
 *       {
 *         "doc": "content/docs/a.mdx",
 *         "red": 1,
 *         "items": [               // 每处引用一条，按在文档里的先后
 *           { "target": "../src/a.ts:2-3", "kind": "span", "status": "changed",
 *             "line": 12,          // 记号在文档里的第几行（1 起）
 *             "lines": [2, 3],     // 行段今天在文件里的位置（跟过 hunk 或滑窗）；别的种类是 [1, 项数]
 *             "draft": false,      // 还是草稿记号（没 confirm 过）
 *             "reason": "changed", // 状态的细分理由，没有就不带（同钉码核心 `@godcreator/docfirst-pin` 的 Reason）
 *             "diff": "- a\n+ b",  // 有变动且取得到旧内容时的 - / + 文本，没有就不带
 *             "blocking": true }   // 只出现在黄灯上：被钉文件在文档所在的仓里有未提交的改动，这个黄算红
 *         ],
 *         "components": [{ "name": "Callout", "line": 7 }], // 名册外组件
 *         "outputs": [             // 挂了 outputs 映射的才有；形状归 project 的摆放模块定
 *           { "to": "../README.md", "status": "fresh", "fresh": true },   // 状态：fresh / missing（生成物还不在）/
 *           { "to": "../x/SKILL.md", "status": "no-frontmatter", "fresh": false, "missing": ["description"] }
 *         ]                       // stale（跟源不一致）/ no-frontmatter（源头部缺点名的字段）/
 *                                 // unrenderable（源渲染不了，原因在 reason）；fresh 是判定结果
 *       }
 *     ],
 *     "trajectory": [              // 轨迹卡校验的病，每条一病
 *       { "path": "content/trajectory/2026-01-01-x.mdx", "field": "born-at", "value": "一月一号", "reason": "…" }
 *     ]
 *   }
 *
 * 「待重写页」= items 里有 changed / missing 的、或 outputs 里 `fresh` 为假的文档；「漂移的钉」= 那些 item。
 */
import type { Reason, Status, Target } from "@godcreator/docfirst-pin";
import type { PlacedCheck } from "../project/index.ts";

/** 一个摆放落点的新鲜度。**形状由 project 的摆放模块定**，这儿只借个名字给报告用——
 *  各状态怎么算出来的不归命令行解释，读报告的人照 `fresh` 决定要不要重摆 */
export type OutputReport = PlacedCheck;

/** 一处引用核对完的样子 */
export interface RefReport {
  /** 目标的文本形态，同人读报告里的那一截（`file:a-b`、`tree dir depth=1`……） */
  target: string;
  kind: Target["kind"];
  status: Status;
  /** 记号在文档里的第几行，1 起 */
  line: number;
  /** 行段今天在文件里的位置；别的种类是 [1, 项数] */
  lines: [number, number];
  /** 还是草稿记号 */
  draft: boolean;
  reason?: Reason;
  diff?: string;
  /** 这处黄是本仓未提交的改动引起的，算红：同一个提交里复核并 `--accept` */
  blocking?: true;
}

export interface ComponentReport {
  name: string;
  line: number;
}

export interface DocReport {
  doc: string;
  /** 这篇贡献的红：缺失 + 拦提交的黄 + 名册外组件 + 不新鲜的摆放落点 */
  red: number;
  items: RefReport[];
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
  trajectory: CardProblemReport[];
}
