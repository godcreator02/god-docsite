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
  /** 组件名册（机读规则），mdx 格式用；没声明就是空表，出现任何组件都算名册外 */
  components?: Roster;
  /**
   * 生成正本的摆放：文档身份（相对项目根、正斜杠）→ 目标数组。每个目标是相对项目根的路径（可以出根），
   * 或者 `{ to, frontmatter }`——要生成物保留 frontmatter 里的几个字段时用对象写法。
   * render 只处理有映射的文档
   */
  outputs?: Record<string, Array<string | OutputTarget>>;
  /** 轨迹卡目录，相对项目根；不写时是内容根下的 trajectory/。建在文档站基础包上的站写 `trajectory`，卡放在站点根下 */
  trajectory?: string;
  /** 术语自动标注：terms 是术语表模块（相对项目根，default 导出词条数组），skip 是不标注的文档（文档身份）。站构建时用，命令行只校验形状 */
  glossary?: GlossaryConfig;
}

export interface GlossaryConfig {
  terms: string;
  skip?: string[];
}

/** 配置文件只有这一个名字 */
const CONFIG_NAME = "docfirst.config.mjs";

export function configPathOf(root: string): string {
  const path = join(root, CONFIG_NAME);
  if (!pathExists(path)) throw new Error(`${root} 下没有 ${CONFIG_NAME}——项目根就是放配置的那个目录`);
  return path;
}

/** 配置认的键 */
const CONFIG_KEYS = ["content", "components", "outputs", "trajectory", "glossary"];

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

function glossaryProblems(glossary: unknown): string[] {
  if (typeof glossary !== "object" || glossary === null || Array.isArray(glossary)) return ["glossary 要是 { terms, skip? } 对象"];
  const table = glossary as Record<string, unknown>;
  const problems = Object.keys(table)
    .filter((key) => key !== "terms" && key !== "skip")
    .map((key) => `glossary 里不认识的键 ${key}：只认 terms / skip`);
  if (!isNonEmptyString(table.terms)) problems.push("glossary.terms 要是术语表模块的路径（相对项目根）");
  if (table.skip !== undefined && (!Array.isArray(table.skip) || !table.skip.every(isNonEmptyString))) problems.push("glossary.skip 要是文档身份（相对项目根）的数组");
  return problems;
}

/** 配置里要改的地方，一条一句；没有就是空表。只检查结构，不读写文件 */
export function configProblems(config: unknown): string[] {
  if (typeof config !== "object" || config === null) return ["docfirst.config 要 export default 一个对象"];
  const table = config as Record<string, unknown>;
  const problems: string[] = [];
  for (const key of Object.keys(table)) {
    if (!CONFIG_KEYS.includes(key)) problems.push(`不认识的键 ${key}：配置只认 ${CONFIG_KEYS.join(" / ")}`);
  }
  if (table.content !== undefined && !isNonEmptyString(table.content)) problems.push("content 要是一个非空目录（相对项目根）");
  if (table.trajectory !== undefined && !isNonEmptyString(table.trajectory)) problems.push("trajectory 要是一个非空目录（相对项目根）");
  if (table.glossary !== undefined) problems.push(...glossaryProblems(table.glossary));
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

/** 相对项目根的目录：正斜杠、不带尾斜杠 */
const normalizedDir = (dir: string): string => dir.replace(/\\/g, "/").replace(/\/+$/, "");

/** 内容根：相对项目根、正斜杠、不带尾斜杠；没配就是 content */
export function contentDirOf(config: ProjectConfig): string {
  return normalizedDir(config.content ?? "content");
}

/** 轨迹卡目录：相对项目根、正斜杠、不带尾斜杠；没配就是内容根下的 trajectory */
export function trajectoryDirOf(config: ProjectConfig): string {
  return config.trajectory === undefined ? `${contentDirOf(config)}/trajectory` : normalizedDir(config.trajectory);
}
