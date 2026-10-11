// E-7：改写 feeds/demo.json 的 message（模拟 gwb 推数据），第二个参数是版本号
import { writeFileSync } from "node:fs";

const version = process.argv[2] ?? "next";
writeFileSync(
  new URL("../site/feeds/demo.json", import.meta.url),
  JSON.stringify({ message: `推送消息 v${version}`, n: Number(version.replace(/\D/g, "")) || 0 }, null, 2) + "\n",
);
console.log(`feeds/demo.json -> v${version} at ${new Date().toISOString()}`);
