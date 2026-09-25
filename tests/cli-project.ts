/**
 * 命令行测试的公共台子：临时真 git 项目、跑命令、收打印。
 *
 * 项目的 docfirst.config.mjs 按绝对 file: 地址引 `fake-format.ts`——临时目录里解析不到包名，
 * 而命令行这一层要验的是它自己（报什么状态、退什么码、写回了什么），不是某个真格式长什么样。
 * 假格式的两个形态正好覆盖两条分支：`.md` 有 renderAi，`.html` 是终态产物。
 * 直接调 main，不起子进程：退出码和打印都当场看得见。
 *
 * 台子要 `process.chdir` 到临时目录，那是进程全局的，所以同一个文件里的用例只能串着跑。
 * 命令行这摊按主题分成几个 `.test.ts`，`node --test` 每个文件一个进程，文件之间才并发得起来。
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { main } from "@godcreator/docfirst-workflow";
import { CODE, run, SETTINGS } from "./repo.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
/** 假格式的绝对 file: 地址。Node 直接吃 .ts，配置文件 import 得动 */
const FAKE = pathToFileURL(join(HERE, "fake-format.ts")).href;

export const CONFIG = `import { fakeFormat } from ${JSON.stringify(FAKE)};

const md = fakeFormat("fake-md", ".md", { render: true });
const html = fakeFormat("fake-html", ".html", { final: true });

export default { formats: [md, html], content: "docs", out: "out" };
`;

export const DOC_MD = "# md\n\n@@docfirst ref src/greet.ts:2-3 @@\n\n尾巴\n";
export const DOC_HTML = '<h1>html</h1>\n<figure>\n  @@docfirst ref src/greet.ts:2-3 @@\n</figure>\n';

/** 起一个能被 loadProject 装配的临时项目，跑几条命令，收集打印 */
export function setupProject(config: string = CONFIG) {
  const root = mkdtempSync(join(tmpdir(), "god-live-doc-cli-"));
  run(root, ["init", "-q", "-b", "main"]);
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "src", "greet.ts"), CODE);
  writeFileSync(join(root, "docs", "a.md"), DOC_MD);
  writeFileSync(join(root, "docs", "b.html"), DOC_HTML);
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
  return CONFIG.replace(`content: "docs", out: "out" };`, `content: "docs", out: "out", ${extra} };`);
}

/** 把 CONFIG 尾巴换成带 outputs 的：docs/a.md 摆到项目根的 README.md */
export function withOutputs(extra: string): string {
  return withKeys(`outputs: ${extra}`);
}
