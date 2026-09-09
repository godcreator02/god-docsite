/**
 * 端口：邻居占了哪些、这个站用哪个。
 *
 * 模块内部件，不在建站接口的面上——调用方只在结果里看到挑中的那个口和占用表。
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** 端口从这一段起找。4310–4399 是留给文档站的一段 */
export const PORT_FROM = 4310;
export const PORT_TO = 4399;

/**
 * 扫一遍**目标仓的邻居**已经占掉的站端口——同一个父目录下的各个仓，深三层。
 *
 * **按脚本内容认，不按目录名认**：站不一定叫 `docs-site`，认的是 package.json 的 scripts 里
 * 那个 `next dev -p <口>` / `next start -p <口>`。目录名靠不住，脚本靠得住。
 */
export function scanUsedPorts(neighborhood: string): Map<number, string> {
  const used = new Map<number, string>();
  if (!existsSync(neighborhood)) return used;

  const visit = (dir: string, depth: number): void => {
    if (depth > 3) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        visit(join(dir, entry.name), depth + 1);
      } else if (entry.name === "package.json") {
        let json: { scripts?: Record<string, unknown> };
        try {
          json = JSON.parse(readFileSync(join(dir, entry.name), "utf8")) as { scripts?: Record<string, unknown> };
        } catch {
          continue;
        }
        for (const command of Object.values(json.scripts ?? {})) {
          if (typeof command !== "string") continue;
          const hit = /\bnext\s+(?:dev|start)\b[^&|]*?-p\s+(\d{2,5})/.exec(command);
          if (hit !== null) used.set(Number(hit[1]), dir);
        }
      }
    }
  };
  visit(neighborhood, 0);
  return used;
}

/**
 * 挑一个口。**手给的一律让给你**——被占了上层只警告一声，不替人改主意：
 * 人知道自己在干什么（比如那个占它的站早就不跑了）。没给就从 4310 起找第一个空位。
 */
export function pickPort(used: Iterable<number> | Map<number, string>, prefer?: number): number {
  if (prefer !== undefined) return prefer;
  const taken = used instanceof Map ? new Set(used.keys()) : new Set(used);
  for (let port = PORT_FROM; port <= PORT_TO; port += 1) {
    if (!taken.has(port)) return port;
  }
  throw new Error(`${PORT_FROM}–${PORT_TO} 全被占了，自己给一个 --port`);
}
