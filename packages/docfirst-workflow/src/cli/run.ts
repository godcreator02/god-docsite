/**
 * 命令行的 main：认命令与开关、装配项目、交给 commands.ts 里的各条命令。可执行文件在 cli.ts——测试直接调用 main，不用启动子进程。
 * cwd 就是项目根（那里有 docfirst.config.mjs）。核对与确认的对象是现状区的文件（分区见 project/load.ts）：
 * mdx 页面与 src/components/ 下讲解组件的源码逐个处理；名册检查与生成物摆放只对 mdx 页面。
 *   docfirst check [--json]                 核对：只读，有红时退出码 1；被钉文件在文档所在的仓里有未提交改动的黄也算红
 *                                          （这次改动引起的，同一个提交里处理）；有 outputs 映射的文档同时检查生成物是否新鲜；
 *                                          同时校验内容根下 trajectory/ 的轨迹卡，病卡也算红。--json 输出整份
 *                                          机读报告（形状见 report.ts），退出码不变
 *   docfirst confirm [文档路径…]            机械写回：未确认的写上记录、挪了位置的写回新行号，再把有 outputs
 *                                          映射的文档重新摆放一遍（内容变了才写）。黄灯不动、逐条列出；红的那几处
 *                                          不动、别的照写，有红时退出码 1。带路径就是**按页限定**：只动点名的那几篇
 *   docfirst confirm <文档路径…> --accept   另外把点名页里的黄灯按今天的内容重新记；没点名页就报错、退出码 2
 *   docfirst render                         渲染：有 outputs 映射的生成正本摆放到指定落点；别的文档不渲染
 *   docfirst trajectory [--json]            列出轨迹卡星轨盘的树与主干；--json 输出星轨盘的输入（盘心、卡、病卡）与树
 *   docfirst --help | -h | help             打印用法，退出码 0，什么都不改；任一命令后面带 --help / -h 也是
 * 每条命令只接受表里认的开关（`FLAGS`），别的开关一律报错、退出码 2，什么都不改。
 * 给新建的站生成各分区初始文件那件事不在这儿——它只由 agent 做一次、生成的是模板不是判定，归工作台插件
 * `@godcreator/gwb-docfirst-workflow` 的 `docfirst.create`。这儿留的全是要在**仓**里发生的：
 * 各仓的 `pnpm doc` 与 CI 跑的就是这几条。
 * 新引用不用命令：在文档里写一行不带记录的正式记号 {/* ref file="src/greet.ts" lines="2-3" *\/}
 * （组件源码里去掉花括号；写法由 `../marker/` 定），check 认它、报未确认，confirm 在这一行写上记录。
 */

import { loadProject } from "../project/index.ts";
import { FLAGS, HELP_COMMANDS, HELP_FLAGS, USAGE } from "./args.ts";
import { checkCommand, confirmCommand, renderCommand, trajectoryCommand } from "./commands.ts";

export type { CardProblemReport, CheckReport, ComponentReport, DocReport, OutputReport, RefReport } from "./report.ts";

export async function main(argv: string[]): Promise<number> {
  const [command = "check", ...rest] = argv;
  // 求助开关最先处理：带着它什么都不做，哪怕同时写了别的参数
  if (HELP_COMMANDS.has(command) || rest.some((arg) => HELP_FLAGS.has(arg))) {
    console.log(USAGE);
    return 0;
  }
  const flags = FLAGS[command];
  if (flags === undefined) {
    console.error(`不认识的命令：${command}——有 ${Object.keys(FLAGS).join(" / ")}，用法看 docfirst --help`);
    return 2;
  }
  const unknown = rest.filter((arg) => arg.startsWith("-") && !flags.includes(arg));
  if (unknown.length > 0) {
    const allowed = flags.length === 0 ? "不收任何开关" : `只认 ${flags.join(" / ")}`;
    console.error(`${command} 不认识开关 ${unknown.join(" ")}（${command} ${allowed}），什么都没动。用法看 docfirst --help`);
    return 2;
  }
  const positional = rest.filter((arg) => !arg.startsWith("-"));
  if (command !== "confirm" && positional.length > 0) {
    console.error(`${command} 不收文档路径（${positional.join(" ")}）——只有 confirm 能点名页，什么都没动。用法看 docfirst --help`);
    return 2;
  }
  // trajectory 跟 check / confirm / render 不是一类：它不遍历文档，所以在装配项目之前就单独处理
  if (command === "trajectory") return trajectoryCommand(rest);

  const project = await loadProject(process.cwd());
  const docs = project.docs();
  if (command === "check") return checkCommand(project, docs, rest.includes("--json"));
  if (command === "confirm") return confirmCommand(project, docs, rest);

  return renderCommand(project, docs);
}
