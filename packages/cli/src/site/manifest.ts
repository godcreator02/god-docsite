/**
 * 目标站 `package.json` 的那一次合并：补上 livedoc 的依赖与几条 doc 脚本。
 *
 * 模块内部件，不在装配接口的面上。**只加不减**——骨架写的 name / version / dev / build / start
 * 一个字不动（端口就钉在那几条脚本里），补的是这个站接了 livedoc 之后才有的东西。
 * 这不是「改写别人的代码」：整个装配只在刚铺好的骨架上跑，那份 package.json 是机器一分钟前
 * 生成的，重排字段没有信息损失。
 */
import { LIVEDOC_DEPS } from "./deps.ts";

/** 接了 livedoc 之后多出来的几条脚本 */
export const DOC_SCRIPTS: Record<string, string> = {
  livedoc: "livedoc",
  doc: "livedoc check",
  "doc:confirm": "livedoc confirm",
  "doc:render": "livedoc render",
  "verify:roster": "node scripts/verify-roster.mjs",
};

/**
 * 合并完的那份 `package.json` 正文（两空格缩进，末尾一个换行——跟骨架写出来的一致）。
 * 依赖进 devDependencies：站构建 import 接线、门禁跑 check，都是开发期的事。
 */
export function withLivedoc(manifestText: string, title: string): string {
  const manifest = JSON.parse(manifestText) as Record<string, unknown>;
  manifest.description = `${title} 的六区文档站：现状钉在这个仓的真实源码上，README / AGENTS 由 render 摆出`;
  manifest.scripts = { ...(manifest.scripts as Record<string, string> | undefined), ...DOC_SCRIPTS };
  manifest.devDependencies = sorted({ ...(manifest.devDependencies as Record<string, string> | undefined), ...LIVEDOC_DEPS });
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** 依赖表按名字排——补进去的几条散在原表中间，diff 就看不出加了什么 */
function sorted(table: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
}
