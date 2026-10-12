/**
 * 站名与模板占位符的值。两条建站命令都用这里的站名规则，站名只有这一份规则。
 */
import { basename } from "node:path";
import type { RepoManifest } from "./repo-root.js";
import type { SiteValues } from "./template.js";

/**
 * 显示名：给了 `title` 就用给的；否则用仓根 package.json 的 `title`；再否则用包名去掉 scope 的部分；
 * 包名不带 scope 或没有包名时用仓的目录名。
 */
export function siteTitle(repoDir: string, manifest: RepoManifest | null, title?: string): string {
  const pkg = typeof manifest?.name === "string" ? manifest.name : "";
  const unscoped = pkg.includes("/") ? pkg.slice(pkg.indexOf("/") + 1) : basename(repoDir);
  const given = (title ?? "").trim();
  const fromManifest = typeof manifest?.title === "string" ? manifest.title.trim() : "";
  return given !== "" ? given : fromManifest !== "" ? fromManifest : unscoped;
}

/** 占位符的值：显示名见 `siteTitle`，站目录名取 `siteDir` 的最后一段 */
export function valuesFor(siteDir: string, repoDir: string, manifest: RepoManifest | null, title?: string): SiteValues {
  return { title: siteTitle(repoDir, manifest, title), site: basename(siteDir) };
}
