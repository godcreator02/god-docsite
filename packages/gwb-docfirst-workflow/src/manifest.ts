/**
 * 合并目标站的 `package.json`：补上 docfirst 的依赖与 doc 脚本，改写 description。
 * 骨架写的 name、version、dev / build / start 脚本（端口在这几条脚本里）与依赖都保留。
 */
import { DOCFIRST_DEPS } from "./deps.js";

/** 装了 docfirst 之后多出来的脚本 */
export const DOC_SCRIPTS: Record<string, string> = {
  docfirst: "docfirst",
  doc: "docfirst check",
  "doc:confirm": "docfirst confirm",
  "doc:render": "docfirst render",
  "verify:roster": "node scripts/verify-roster.mjs",
};

/**
 * 合并后的 `package.json` 正文（两空格缩进，末尾一个换行，与骨架的写法一致）。
 * 依赖放进 devDependencies：站构建引用接线代码、门禁跑 check，都是开发期的事。
 */
export function withDocfirst(manifestText: string, title: string): string {
  const manifest = JSON.parse(manifestText) as Record<string, unknown>;
  manifest.description = `${title} 的文档站（docfirst）：仓根 README / AGENTS / CLAUDE 由 render 生成`;
  manifest.scripts = { ...(manifest.scripts as Record<string, string> | undefined), ...DOC_SCRIPTS };
  manifest.devDependencies = sorted({ ...(manifest.devDependencies as Record<string, string> | undefined), ...DOCFIRST_DEPS });
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** 依赖表按名字排序：新加的几条散在原表中间时，diff 看得出加了什么 */
function sorted(table: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
}
