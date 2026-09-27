/**
 * 项目配置 `docfirst.config`：认哪些键、怎么校验、内容根怎么归一。配置只认 `CONFIG_KEYS` 里那几个键，出现别的键当场报错并说清该怎么改。
 */
import { join } from "node:path";
import type { Roster } from "../mdx/index.ts";
import { importDefault, pathExists } from "../node/index.ts";
import type { OutputTarget } from "./placement.ts";

export interface ProjectConfig {
  /** 内容根，相对项目根；默认 content */
  content?: string;
  /** 组件名册（压平规则），mdx 格式用；没声明就是空表，出现任何组件都算名册外 */
  components?: Roster;
  /**
   * 生成正本的摆放：文档身份（相对项目根、正斜杠）→ 目标数组。每个目标是相对项目根的路径（可以出根），
   * 或者 `{ to, frontmatter }`——要生成物保留 frontmatter 里的几个字段时用对象写法。
   * render 只处理有映射的文档
   */
  outputs?: Record<string, Array<string | OutputTarget>>;
}

const CONFIG_NAMES = ["docfirst.config.mjs", "docfirst.config.js", "docfirst.config.ts"];

export function configPathOf(root: string): string {
  const hit = CONFIG_NAMES.map((name) => join(root, name)).find(pathExists);
  if (hit === undefined) throw new Error(`${root} 下没有 docfirst.config.mjs——项目根就是放配置的那个目录`);
  return hit;
}

/** 配置认的键 */
const CONFIG_KEYS = ["content", "components", "outputs"];

/** 配置里要改的地方，一条一句；没有就是空表。只检查结构，不读写文件 */
export function configProblems(config: unknown): string[] {
  if (typeof config !== "object" || config === null) return ["docfirst.config 要 export default 一个对象"];
  const table = config as Record<string, unknown>;
  const problems: string[] = [];
  for (const key of Object.keys(table)) {
    if (!CONFIG_KEYS.includes(key)) problems.push(`不认识的键 ${key}：配置只认 ${CONFIG_KEYS.join(" / ")}`);
  }
  if (table.content !== undefined && (typeof table.content !== "string" || table.content.trim() === "")) problems.push("content 要是一个非空目录（相对项目根）");
  return problems;
}

/** 按 Node 原生加载项目的配置模块，交回 default 导出（还没校验） */
export async function importConfig(root: string): Promise<unknown> {
  return importDefault(configPathOf(root));
}

/** 加载项目根下的配置并校验，有要改的地方就一次列全报错 */
export async function loadConfig(root: string): Promise<ProjectConfig> {
  const loaded = await importConfig(root);
  const problems = configProblems(loaded);
  if (problems.length > 0) throw new Error(`${configPathOf(root)} 有 ${problems.length} 处要改：\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  return loaded as ProjectConfig;
}

/** 内容根：相对项目根、正斜杠、不带尾斜杠；没配就是 content */
export function contentDirOf(config: ProjectConfig): string {
  return (config.content ?? "content").replace(/\\/g, "/").replace(/\/+$/, "");
}
