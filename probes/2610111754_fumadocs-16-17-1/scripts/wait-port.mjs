// 等端口就绪：每 0.5 秒查一次 TCP 连接，总超时由第一个参数给定（秒），超时非零退出
const [, , portArg, timeoutArg, labelArg] = process.argv;
const port = Number(portArg);
const timeoutMs = Number(timeoutArg ?? 60) * 1000;
const label = labelArg ?? `port ${port}`;
const start = Date.now();
while (Date.now() - start < timeoutMs) {
  try {
    const ok = await fetch(`http://127.0.0.1:${port}/`, { redirect: "manual" }).then((r) => r.status < 500);
    if (ok) {
      console.log(`${label} ready in ${((Date.now() - start) / 1000).toFixed(1)}s`);
      process.exit(0);
    }
  } catch {
    // 端口还没开
  }
  await new Promise((r) => setTimeout(r, 500));
}
console.error(`${label} NOT ready within ${timeoutMs / 1000}s`);
process.exit(1);
