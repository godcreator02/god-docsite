// 用法：node compare-cli.mjs <旧 cli.mjs> <新 cli.mjs> <项目根>
// 新旧两份命令行在同一个项目根下各跑同一组命令，比较退出码、标准输出与标准错误。只读命令在前，render 在最后（内容没变不写文件）。
import { spawnSync } from "node:child_process";

const [oldCli, newCli, cwd] = process.argv.slice(2);
const COMMANDS = [["check"], ["check", "--json"], ["trajectory"], ["trajectory", "--json"], ["render"]];
/** 只留错误信息本身：去掉 Node 打印的产物文件位置、出错那行源码、脱字符与堆栈行——拆文件后打包出的文件名与行号本来就变 */
const errorMessage = (text) => text.split("\n").filter((l) => !l.startsWith("file:///") && !/^\s+at /.test(l) && !/^\s*\^+\s*$/.test(l) && !l.startsWith("\t")).join("\n");
const run = (cli, args) => {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", timeout: 300_000 });
  return { code: r.status, out: r.stdout, err: errorMessage(r.stderr) };
};
let same = 0;
for (const args of COMMANDS) {
  const a = run(oldCli, args);
  const b = run(newCli, args);
  const equal = a.code === b.code && a.out === b.out && a.err === b.err;
  if (equal) same += 1;
  console.log(`${equal ? "一致" : "不一致"}  docfirst ${args.join(" ")}  退出码 ${a.code}/${b.code}  输出 ${a.out.length}/${b.out.length} 字符`);
  if (!equal) {
    const al = a.out.split("\n");
    const bl = b.out.split("\n");
    for (let i = 0; i < Math.max(al.length, bl.length); i += 1) {
      if (al[i] !== bl[i]) {
        console.log(`  第 ${i + 1} 行\n    旧：${al[i]}\n    新：${bl[i]}`);
        break;
      }
    }
    if (a.err !== b.err) console.log(`  标准错误不同\n    旧：${a.err.slice(0, 300)}\n    新：${b.err.slice(0, 300)}`);
  }
}
console.log(`${same}/${COMMANDS.length} 条一致`);
