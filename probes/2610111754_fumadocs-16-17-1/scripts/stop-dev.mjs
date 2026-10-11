// 停掉监听 4446/4447 的进程：TaskStop 杀 pnpm 壳杀不掉 react-router dev 子进程，按端口找 PID 强杀
import { execSync } from "node:child_process";

for (const port of [4446, 4447]) {
  let out = "";
  try {
    out = execSync(`netstat -ano`, { encoding: "utf8" });
  } catch {
    continue;
  }
  const pids = [
    ...new Set(
      out
        .split("\n")
        .filter((line) => line.includes(`:${port}`) && line.includes("LISTENING"))
        .map((line) => line.trim().split(/\s+/).at(-1)),
    ),
  ];
  for (const pid of pids) {
    if (pid === "0") continue;
    try {
      execSync(`taskkill /PID ${pid} /F`, { encoding: "utf8" });
      console.log(`port ${port}: killed pid ${pid}`);
    } catch (err) {
      console.error(`port ${port}: kill pid ${pid} failed: ${err.message}`);
    }
  }
}
