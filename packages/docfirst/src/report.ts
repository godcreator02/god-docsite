/**
 * `docfirst check --json` 的机读报告。形状是契约：读它的是别的程序（门禁、编辑器、列「待重写页与漂移的钉」的 agent），
 * 加字段可以，改名、删字段只随破坏性版本发。整份一行 JSON 打印到 stdout，退出码跟人读模式一样（有红退 1）。
 *
 *   {
 *     "ok": false,                 // red === 0
 *     "red": 3,                    // 缺失 + 拦提交的黄 + 名册外组件 + 不新鲜的生成物 + 病卡
 *     "docs": [                    // 现状区每个文件一条，按文档身份排序
 *       {
 *         "doc": "content/docs/a.mdx",
 *         "red": 1,
 *         "items": [               // 每处钉一条，按在文件里的先后
 *           { "target": "../src/a.ts:2-3", "kind": "span", "status": "changed",
 *             "line": 12,          // 标记在文件里的第几行（1 起）
 *             "lines": [2, 3],     // 行段今天在文件里的位置；别的种类是 [1, 项数]
 *             "reason": "changed", // 状态的细分理由，没有就不带
 *             "diff": "- a\n+ b",  // 有变动且取得到旧内容时的逐行对比，没有就不带
 *             "blocking": true }   // 只在黄灯上：被钉文件在文档所在的仓里有未提交的改动，这个黄算红
 *         ],
 *         "components": [{ "name": "Callout", "line": 7 }], // 生成正本里的名册外组件
 *         "outputs": [             // 生成正本才有：fresh / missing / stale / no-frontmatter / unrenderable
 *           { "to": "../README.md", "status": "fresh", "fresh": true },
 *           { "to": "../x/SKILL.md", "status": "no-frontmatter", "fresh": false, "missing": ["description"] }
 *         ]
 *       }
 *     ],
 *     "trajectory": [              // 轨迹卡校验的病，一条一病，path 相对项目根
 *       { "path": "trajectory/2026-01-01-x.mdx", "field": "born-at", "value": "一月一号", "reason": "…" }
 *     ]
 *   }
 */
import type { Reason, Status, Target } from "@godcreator/code-pin";
import type { OutputCheck } from "@godcreator/doc-export/node";

/** 一个生成物落点的状态：doc-export 的核对结果，去掉报告里已经由外层给出的正本身份 */
export type OutputReport = Omit<OutputCheck, "doc">;

export interface RefReport {
  /** 目标的文本形态，同人读报告里的那一截（`file:a-b`、`tree dir depth=1`……） */
  target: string;
  kind: Target["kind"];
  status: Status;
  /** 标记在文件里的第几行，1 起 */
  line: number;
  lines: [number, number];
  reason?: Reason;
  diff?: string;
  blocking?: true;
}

export interface ComponentReport {
  name: string;
  line: number;
}

export interface DocReport {
  doc: string;
  red: number;
  items: RefReport[];
  components: ComponentReport[];
  outputs: OutputReport[];
}

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
