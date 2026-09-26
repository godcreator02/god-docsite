/**
 * 命令行测试的公共台子：临时真 git 项目、跑命令、收打印。
 *
 * 项目里两篇 mdx 文档，各钉同一段代码；配置只写内容根，要 outputs 的用例自己加。
 * 直接调 main，不起子进程：退出码和打印都当场看得见。
 *
 * 台子要 `process.chdir` 到临时目录，那是进程全局的，所以同一个文件里的用例只能串着跑。
 * 命令行这摊按主题分成几个 `.test.ts`，`node --test` 每个文件一个进程，文件之间才并发得起来。
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "@godcreator/docfirst-workflow";
import { CODE, run, SETTINGS } from "./repo.ts";

export const CONFIG = `export default { content: "docs" };
`;

/** 还没确认的那一行：不带记录的正式记号 */
export const UNCONFIRMED = '{/* ref file="src/greet.ts" lines="2-3" */}';
export const DOC_A = `# md\n\n${UNCONFIRMED}\n\n尾巴\n`;
export const DOC_B = `# b\n\n另一篇\n\n${UNCONFIRMED}\n`;

/** 起一个能被 loadProject 装配的临时项目，跑几条命令，收集打印 */
export function setupProject(config: string = CONFIG) {
  const root = mkdtempSync(join(tmpdir(), "god-live-doc-cli-"));
  run(root, ["init", "-q", "-b", "main"]);
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "src", "greet.ts"), CODE);
  writeFileSync(join(root, "docs", "a.mdx"), DOC_A);
  writeFileSync(join(root, "docs", "b.mdx"), DOC_B);
  writeFileSync(join(root, "docfirst.config.mjs"), config);
  run(root, [...SETTINGS, "add", "-A"]);
  run(root, [...SETTINGS, "commit", "-q", "-m", "起项目"]);

  const before = process.cwd();
  process.chdir(root);
  const said: string[] = [];
  const log = console.log;
  console.log = (...args: unknown[]) => void said.push(args.join(" "));

  return {
    root,
    said,
    read: (rel: string) => readFileSync(join(root, rel), "utf8"),
    async cli(...args: string[]) {
      said.length = 0;
      const code = await main(args);
      return { code, out: said.join("\n") };
    },
    teardown() {
      console.log = log;
      process.chdir(before);
      rmSync(root, { recursive: true, force: true, maxRetries: 5 });
    },
  };
}

/** 把 CONFIG 尾巴换成带别的键的（`outputs: {…}` 这种一截） */
export function withKeys(extra: string): string {
  return CONFIG.replace(`content: "docs" };`, `content: "docs", ${extra} };`);
}

/** 把 CONFIG 尾巴换成带 outputs 的：docs/a.mdx 摆到项目根的 README.md */
export function withOutputs(extra: string): string {
  return withKeys(`outputs: ${extra}`);
}
