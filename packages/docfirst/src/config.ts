/**
 * 项目根下的 `docfirst.config.mjs`：读进来、按字段表校验、归一成命令行用的形状。
 * 要改的地方一次列全报错；属于站点构建的字段在这里报错，说明它移到了站点配置。
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fumadocsRoster, placementsOf } from "@godcreator/doc-export";
import type { OutputPlacement, OutputsConfig, Roster } from "@godcreator/doc-export";

/** `docfirst.config.mjs` 的 default 导出，字段表的正本 */
export interface DocfirstConfigFile {
  /** 内容根，相对项目根；不写是 content */
  content?: string;
  /** 组件名册：组件名 → 机读规则（"children" / "drop" / 函数）；生成正本里用到的组件都得在名册里 */
  components?: Roster;
  /** true：先用 doc-export 现成的 fumadocs 名册（Note、Files、Folder、File），components 里同名的规则盖过它 */
  fumadocsRoster?: boolean;
  /** 生成物：正本（相对项目根）→ 落点数组；落点写相对项目根的路径，或 { to, frontmatter } */
  outputs?: OutputsConfig;
  /** 轨迹卡目录，相对项目根；不写是内容根下的 trajectory/ */
  trajectory?: string;
}

/** 校验并归一之后的配置：目录都相对项目根、正斜杠、不带尾斜杠 */
export interface DocfirstConfig {
  contentDir: string;
  trajectoryDir: string;
  /** 用来查名册与生成生成物的那张表：fumadocs 名册（选了才有）加上 components */
  roster: Roster;
  outputs: Record<string, OutputPlacement[]>;
}

export const CONFIG_NAME = "docfirst.config.mjs";

const CONFIG_KEYS: ReadonlyArray<keyof DocfirstConfigFile> = ["content", "components", "fumadocsRoster", "outputs", "trajectory"];

/** 旧配置里属于站点构建的键：命令行不读，遇到就报错并说清它去了哪 */
const KEYS_MOVED_TO_SITE: Record<string, string> = {
  glossary: "术语表的位置与不标注的页由站点声明（站点的 source.ts）",
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const isRule = (value: unknown): boolean => value === "children" || value === "drop" || typeof value === "function";

function keyProblems(table: Record<string, unknown>): string[] {
  return Object.keys(table).flatMap((key) => {
    const movedTo = KEYS_MOVED_TO_SITE[key];
    if (movedTo !== undefined) return [`${key} 这一项移到站点配置了：${movedTo}，从 ${CONFIG_NAME} 里删掉`];
    if (!(CONFIG_KEYS as readonly string[]).includes(key)) return [`不认识的键 ${key}：配置只认 ${CONFIG_KEYS.join(" / ")}`];
    return [];
  });
}

function componentProblems(components: unknown): string[] {
  if (!isPlainObject(components)) return ["components 要是「组件名 → 规则」的对象"];
  return Object.entries(components)
    .filter(([, rule]) => !isRule(rule))
    .map(([name]) => `components.${name} 的规则要是 "children"、"drop" 或函数`);
}

/** 配置里要改的地方，一条一句；没有就是空表。只看形状，不读写文件 */
export function configProblems(raw: unknown): string[] {
  if (!isPlainObject(raw)) return [`${CONFIG_NAME} 要 export default 一个对象`];
  const problems = keyProblems(raw);
  if (raw.content !== undefined && !isNonEmptyString(raw.content)) problems.push("content 要是一个非空目录（相对项目根）");
  if (raw.trajectory !== undefined && !isNonEmptyString(raw.trajectory)) problems.push("trajectory 要是一个非空目录（相对项目根）");
  if (raw.fumadocsRoster !== undefined && typeof raw.fumadocsRoster !== "boolean") problems.push("fumadocsRoster 要是 true 或 false");
  if (raw.components !== undefined) problems.push(...componentProblems(raw.components));
  if (raw.outputs !== undefined && !isPlainObject(raw.outputs)) problems.push("outputs 要是「正本 → 落点数组」的对象");
  return problems;
}

/** 相对项目根的目录：正斜杠、不带尾斜杠 */
const normalizedDir = (dir: string): string => dir.replace(/\\/g, "/").replace(/\/+$/, "");

/** 校验过的 default 导出归一成命令行用的形状；落点写法不对由 placementsOf 报错 */
function normalizedConfig(file: DocfirstConfigFile): DocfirstConfig {
  const contentDir = normalizedDir(file.content ?? "content");
  return {
    contentDir,
    trajectoryDir: file.trajectory === undefined ? `${contentDir}/trajectory` : normalizedDir(file.trajectory),
    roster: { ...(file.fumadocsRoster === true ? fumadocsRoster : {}), ...file.components },
    outputs: placementsOf(file.outputs ?? {}),
  };
}

/** 校验并归一一份配置；source 是报错里说的配置出处 */
export function parseConfig(raw: unknown, source: string): DocfirstConfig {
  const problems = configProblems(raw);
  if (problems.length > 0) throw new Error(`${source} 有 ${problems.length} 处要改：\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  return normalizedConfig(raw as DocfirstConfigFile);
}

/** 由 Node 原生加载一个配置模块，交回它的 default 导出 */
export async function importConfigModule(path: string): Promise<unknown> {
  return ((await import(pathToFileURL(path).href)) as { default: unknown }).default;
}

/** 读项目根下的配置：文件只有 docfirst.config.mjs 这一个名字 */
export async function loadConfig(root: string): Promise<DocfirstConfig> {
  const path = join(root, CONFIG_NAME);
  if (!existsSync(path)) throw new Error(`${root} 下没有 ${CONFIG_NAME}——项目根就是放配置的那个目录`);
  return parseConfig(await importConfigModule(path), path);
}
