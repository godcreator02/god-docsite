/**
 * 命令与开关：每条命令认哪些开关、求助的写法、用法说明，以及 confirm 点名页的解析。
 */
import type { Project } from "../project/index.ts";

/**
 * 各命令认的开关。**不在表里的一律拒绝**：confirm 把 `-` 开头的参数从页名里筛掉，开关若被静默忽略，
 * `confirm --help` 就成了不带页名的全部页确认，而且没有任何提示。
 */
export const FLAGS: Record<string, readonly string[]> = {
  check: ["--json"],
  confirm: ["--accept"],
  render: [],
  trajectory: ["--json"],
};

/** 求助的写法：命令位上三种都认，命令后面只认两种开关（`help` 在 confirm 后面可能是页名） */
export const HELP_COMMANDS = new Set(["--help", "-h", "help"]);
export const HELP_FLAGS = new Set(["--help", "-h"]);

export const USAGE = `docfirst——文档钉代码的核对与确认。在有 docfirst.config.mjs 的项目根跑。

  docfirst check [--json]                核对，只读。红退 1；被钉文件在本仓有未提交改动的黄灯也算红，
                                         在同一个提交里复核并 --accept。--json 出整份机读报告，退出码不变
  docfirst confirm [文档路径…]            机械写回：未确认的记号写上记录，挪了位置的写回新行号，
                                         再重新生成挂了 outputs 映射的生成物（内容变了才写）。
                                         黄灯不动、逐条列出；红的那几处不动、别的照写，有红退 1。
                                         不带路径 = 全部页；带路径 = 按页限定，只动点名的那几篇
                                         （例：docfirst confirm content/docs/a.mdx）
  docfirst confirm <文档路径…> --accept   另外把点名页里的黄灯按今天的内容重新记。复核过才用，必须点名页
  docfirst render                        把挂了 outputs 映射的生成正本渲染到落点（内容变了才写）
  docfirst trajectory [--json]           列轨迹卡那张盘的树与主干
  docfirst --help                        打这份用法，什么都不动

不认识的开关一律报错退 2，不会被当作没写。`;

/** 点名解析：三种路径写法都接受，对不上的当场报错，不静默跳过——少确认一页比报错难发现得多 */
export function pickDocs(project: Project, docs: string[], named: string[]): { docs: string[] } | { unknown: string[] } {
  const alive = new Set(docs);
  const picked: string[] = [];
  const unknown: string[] = [];
  for (const raw of named) {
    const doc = project.docIdOf(raw);
    if (alive.has(doc)) picked.push(doc);
    else unknown.push(raw);
  }
  return unknown.length > 0 ? { unknown } : { docs: [...new Set(picked)] };
}
