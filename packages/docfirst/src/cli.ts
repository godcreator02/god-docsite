/**
 * 命令行的 main：认命令与开关、读配置、装配项目、交给 commands/ 里的命令，交回退出码。
 * 项目根是传进来的目录（可执行文件传 cwd），那里有 docfirst.config.mjs。main 不调 process.exit，测试与别的程序直接调它。
 */
import { loadConfig } from "./config.ts";
import { assembleProject } from "./project.ts";
import { checkCommand } from "./commands/check.ts";
import { confirmCommand } from "./commands/confirm.ts";
import { renderCommand } from "./commands/render.ts";
import { trajectoryCommand } from "./commands/trajectory.ts";

/**
 * 各命令认的开关。不在表里的一律拒绝：confirm 把 `-` 开头的参数从页名里筛掉，开关若被静默忽略，
 * `confirm --dry-run` 就成了不带页名的全部页确认，而且没有任何提示。
 */
const FLAGS: Record<string, readonly string[]> = {
  check: ["--json"],
  confirm: ["--accept"],
  render: [],
  trajectory: ["--json"],
};

/** 求助的写法：命令位上三种都认，命令后面只认两种开关（`help` 在 confirm 后面可能是页名） */
const HELP_COMMANDS = new Set(["--help", "-h", "help"]);
const HELP_FLAGS = new Set(["--help", "-h"]);

export const USAGE = `docfirst——文档钉代码的核对与确认。在有 docfirst.config.mjs 的项目根运行。

  docfirst check [--json]                核对，只读。红退 1；被钉文件在本仓有未提交改动的黄灯也算红，
                                         在同一个提交里复核并 --accept。--json 出整份机读报告，退出码不变
  docfirst confirm [文档路径…]            机械写回：未确认的标记写上记录，挪了位置的写回新行号，
                                         再重新生成挂了 outputs 映射的生成物（内容变了才写）。
                                         黄灯不动、逐条列出；红的那几处不动、别的照写，有红退 1。
                                         不带路径 = 全部页；带路径 = 按页限定，只动点名的那几篇
                                         （例：docfirst confirm content/docs/a.mdx）
  docfirst confirm <文档路径…> --accept   另外把点名页里的黄灯按今天的内容重新记。复核过才用，必须点名页
  docfirst render                        把挂了 outputs 映射的生成正本生成到落点（内容变了才写）
  docfirst trajectory [--json]           列轨迹卡那张盘的树与主干
  docfirst --help                        打这份用法，什么都不动

不认识的开关一律报错退 2，不会被当作没写。`;

/** 命令行参数里挑出的东西；有错时是要打印的报错 */
type ParsedArgs = { help: true } | { error: string } | { command: string; flags: string[]; paths: string[] };

function parseArgs(argv: readonly string[]): ParsedArgs {
  const [command = "check", ...rest] = argv;
  // 求助开关最先处理：带着它什么都不做，哪怕同时写了别的参数
  if (HELP_COMMANDS.has(command) || rest.some((arg) => HELP_FLAGS.has(arg))) return { help: true };
  const allowed = FLAGS[command];
  if (allowed === undefined) return { error: `不认识的命令：${command}——有 ${Object.keys(FLAGS).join(" / ")}，用法看 docfirst --help` };
  const flags = rest.filter((arg) => arg.startsWith("-"));
  const unknown = flags.filter((flag) => !allowed.includes(flag));
  if (unknown.length > 0) {
    const said = allowed.length === 0 ? "不收任何开关" : `只认 ${allowed.join(" / ")}`;
    return { error: `${command} 不认识开关 ${unknown.join(" ")}（${command} ${said}），什么都没动。用法看 docfirst --help` };
  }
  const paths = rest.filter((arg) => !arg.startsWith("-"));
  if (command !== "confirm" && paths.length > 0) {
    return { error: `${command} 不收文档路径（${paths.join(" ")}）——只有 confirm 能点名页，什么都没动。用法看 docfirst --help` };
  }
  return { command, flags, paths };
}

export async function main(argv: readonly string[], root: string = process.cwd()): Promise<number> {
  const parsed = parseArgs(argv);
  if ("help" in parsed) {
    console.log(USAGE);
    return 0;
  }
  if ("error" in parsed) {
    console.error(parsed.error);
    return 2;
  }
  const { command, flags, paths } = parsed;
  const config = await loadConfig(root);
  if (command === "trajectory") return trajectoryCommand(root, config, flags.includes("--json"));
  const project = assembleProject(root, config);
  if (command === "check") return checkCommand(project, flags.includes("--json"));
  if (command === "confirm") return confirmCommand(project, paths, flags.includes("--accept"));
  return renderCommand(project);
}
