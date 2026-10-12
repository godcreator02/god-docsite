/**
 * 站名的规则。建站命令用这里的规则，站名只有这一份规则。
 */
import { basename } from "node:path";
import type { RepoManifest } from "./repo-root.js";

/**
 * 显示名：给了 title 就用给的；否则用仓根 package.json 的 title；再否则用包名去掉 scope 的部分；
 * 包名不带 scope 或没有包名时用仓的目录名。
 */
export function siteTitle(repoDir: string, manifest: RepoManifest | null, title?: string): string {
  const pkg = typeof manifest?.name === "string" ? manifest.name : "";
  const unscoped = pkg.includes("/") ? pkg.slice(pkg.indexOf("/") + 1) : basename(repoDir);
  const given = (title ?? "").trim();
  const fromManifest = typeof manifest?.title === "string" ? manifest.title.trim() : "";
  return given !== "" ? given : fromManifest !== "" ? fromManifest : unscoped;
}
