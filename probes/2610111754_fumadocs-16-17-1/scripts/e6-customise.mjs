// E-6：伪终端跑 @fumadocs/cli customise，逐个记录它问的问题并回车选默认项
import { appendFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

// node-pty 装在 tools/ 下，从它的 package.json 处解析
const toolsRequire = createRequire(fileURLToPath(new URL("../tools/package.json", import.meta.url)));
const pty = toolsRequire("node-pty");

const siteDir = fileURLToPath(new URL("../site/", import.meta.url));
const logPath = fileURLToPath(new URL("../runs/22-e6-customise.log", import.meta.url));
writeFileSync(logPath, "");

// node-pty 在 Windows 下不走 PATHEXT，要给 .cmd 的完整路径
const proc = pty.spawn("C:\\Users\\godamericatb14\\bin\\pnpm.CMD", ["dlx", "@fumadocs/cli@1.7.5", "customise"], {
  name: "xterm-256color",
  cols: 100,
  rows: 40,
  cwd: siteDir,
  env: process.env,
});

const plain = (chunk) => chunk.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "").replace(/\r/g, "");
let buffer = "";
const questions = [];

proc.onData((chunk) => {
  appendFileSync(logPath, chunk);
  buffer += plain(chunk);
  // 选择（↑/↓ to navigate）、Yes/No 切换、覆盖确认：等输出稳定半秒再回车选默认
  if (/to navigate|Yes \/ ○ No|y\/n|confirm|overwrite/i.test(buffer)) {
    const text = buffer;
    buffer = "";
    setTimeout(() => {
      const q =
        text.split("\n").find((l) => l.includes("◆") || l.includes("?")) ??
        text.split("\n").find((l) => l.trim().length > 0) ??
        text.slice(0, 120);
      if (q && !questions.includes(q)) questions.push(q);
      console.log(`[customise] ${q.trim()} -> Enter`);
      proc.write("\r");
    }, 500);
  }
});

proc.onExit(({ exitCode }) => {
  console.log(`[customise] exit ${exitCode}`);
  console.log("[customise] 问过的问题：");
  for (const q of questions) console.log("  - " + q.trim());
  process.exit(exitCode ?? 0);
});
