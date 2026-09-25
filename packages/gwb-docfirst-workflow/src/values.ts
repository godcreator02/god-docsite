/**
 * 占位符的值：站的显示名与站目录名。
 */
import { basename } from "node:path";
import type { SiteValues } from "./template.js";

/**
 * 显示名：给了 `title` 就用给的；否则用仓根 package.json 的 `title`；再否则用包名去掉 scope 的部分；
 * 包名不带 scope 或没有包名时用仓的目录名。
 */
export function valuesFor(siteDir: string, repoDir: string, manifest: { name?: unknown; title?: unknown } | null, title?: string): SiteValues {
  const pkg = typeof manifest?.name === "string" ? manifest.name : "";
  const unscoped = pkg.includes("/") ? pkg.slice(pkg.indexOf("/") + 1) : basename(repoDir);
  const given = (title ?? "").trim();
  const fromManifest = typeof manifest?.title === "string" ? manifest.title.trim() : "";
  return {
    title: given !== "" ? given : fromManifest !== "" ? fromManifest : unscoped,
    site: basename(siteDir),
  };
}
