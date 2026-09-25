/**
 * 消费方项目的装配。
 * 一个项目 = 一个根目录 + 一份 docfirst.config（声明格式、内容根、生成物摆到哪）。
 * loadProject(root) 把这些串起来交出一个判定服务；同一个根只装配一次（站构建时几十个 loader 并发调它）。
 *
 * 分区按约定：内容根（`content`，默认 `content`）下 `trajectory/` 是轨迹卡、`future/` 是未来区，
 * 这两个名字固定；内容根下别的一切（目录里的、直接放在根上的）有格式认领的文档都是现状区，都进 check。
 * 配置只认 `CONFIG_KEYS` 里那几个键，出现别的键当场报错并说清该怎么改。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createService } from "@godcreator/docfirst-pin";
import type { Service } from "@godcreator/docfirst-pin";
import type { DocFormat } from "../format/index.ts";
import { createReader } from "./fs-reader.ts";
import { createGitHistory } from "./history.ts";
import { assertTurf, createPlacing, placementsOf } from "./placement.ts";
import type { OutputTarget, Placement, Placing, PlacingHost } from "./placement.ts";

export interface ProjectConfig {
  /** 这个项目挂了哪些格式 */
  formats: DocFormat[];
  /** 内容根，相对项目根；默认 content */
  content?: string;
  /** 组件名册（压平规则），格式用；没声明就是空表，出现任何组件都算名册外 */
  components?: Record<string, unknown>;
  /**
   * 生成正本的摆放：文档身份（相对项目根、正斜杠）→ 目标数组。每个目标是相对项目根的路径（可以出根），
   * 或者 `{ to, frontmatter }`——要生成物保留 frontmatter 里的几个字段时用对象写法。
   * render 只处理挂了映射的文档
   */
  outputs?: Record<string, Array<string | OutputTarget>>;
}

export interface Project {
  root: string;
  config: ProjectConfig;
  service: Service<DocFormat>;
  roster: Record<string, unknown> | undefined;
  /** 内容根，相对项目根、正斜杠 */
  contentDir: string;
  /** 轨迹卡目录的绝对路径：内容根下的 trajectory/，不一定已经建了 */
  trajectoryDir: string;
  /** 摆放：render 摆一趟、check 只核对。渲成什么、跟盘上怎么比、落点状态怎么定，都在它背后 */
  placing: Placing;
  /** 现状区里有格式认领的那些文档，相对项目根、正斜杠、排过序 */
  docs(): string[];
  /** 这篇文档挂的摆放目标（归一化过）；没挂映射给空数组 */
  placements(doc: string): Placement[];
  /** 路径 → 文档身份；绝对路径按项目根算，相对路径原样收 */
  docIdOf(path: string): string;
  read(doc: string): string;
  write(doc: string, text: string): void;
}

const cache = new Map<string, Promise<Project>>();

/**
 * 文档身份：相对项目根、正斜杠。命令行的报告、outputs 映射的键、站的 loader 都用它。
 * 绝对路径按项目根算；相对路径原样收，`./` 前缀与反斜杠一并归一——命令行点名的路径三种写法都可能。
 */
export function docIdOf(root: string, path: string): string {
  const rel = isAbsolute(path) ? relative(root, path) : path;
  return rel.split(sep).join("/").replace(/\\/g, "/").replace(/^\.\//, "");
}

const CONFIG_NAMES = ["docfirst.config.mjs", "docfirst.config.js", "docfirst.config.ts"];

export function configPathOf(root: string): string {
  const hit = CONFIG_NAMES.map((name) => join(root, name)).find((path) => existsSync(path));
  if (hit === undefined) throw new Error(`${root} 下没有 docfirst.config.mjs——项目根就是放配置的那个目录`);
  return hit;
}

export function loadProject(root: string): Promise<Project> {
  const abs = resolve(root);
  let pending = cache.get(abs);
  if (pending === undefined) {
    pending = build(abs);
    cache.set(abs, pending);
  }
  return pending;
}

/** 内容根下固定的两个名字：轨迹卡与未来区，都不进 check */
const FIXED_AREAS = new Set(["trajectory", "future"]);

/** 配置认的键 */
const CONFIG_KEYS = ["formats", "content", "components", "outputs"];

/** 删掉的旧键 → 该怎么改 */
const RETIRED_KEYS: Record<string, string> = {
  docs: '删掉 docs：现状区按约定是内容根下除 trajectory/、future/ 之外的全部；内容根不叫 content 就写 content: "…"',
  trajectory: "删掉 trajectory：轨迹卡目录固定是内容根下的 trajectory/",
  comparator: "删掉 comparator：行段与整文件只有一个比较器，不用选",
  ledger: "删掉 ledger：记录写在各记号上；旧记录簿先在项目根跑 docfirst migrate-ledger 迁进记号",
  fumadocs: "删掉 fumadocs：生成正本按原文渲染，不再按集合编译",
  out: "删掉 out：render 只生成 outputs 映射里的生成物，不再往 out/ 写调试产物",
};

/** 配置里要改的地方，一条一句；没有就是空表。只看形状，不碰盘 */
export function configProblems(config: unknown): string[] {
  if (typeof config !== "object" || config === null) return ["docfirst.config 要 export default 一个对象"];
  const table = config as Record<string, unknown>;
  const problems: string[] = [];
  for (const key of Object.keys(table)) {
    if (CONFIG_KEYS.includes(key)) continue;
    problems.push(RETIRED_KEYS[key] ?? `不认识的键 ${key}：配置只认 ${CONFIG_KEYS.join(" / ")}`);
  }
  if (!Array.isArray(table.formats)) problems.push("formats 要是格式的数组");
  if (table.content !== undefined && (typeof table.content !== "string" || table.content.trim() === "")) problems.push("content 要是一个非空目录（相对项目根）");
  return problems;
}

/** 按 Node 原生加载项目的配置模块，交回 default 导出（还没校验） */
export async function importConfig(root: string): Promise<unknown> {
  // 配置是消费方项目里的活模块，必须由 Node 原生加载：站的打包器会把动态 import 改写成
  // 它自己的加载器，两个标记让它绕开这一句（turbopack / webpack 各认一个）
  const configUrl = pathToFileURL(configPathOf(root)).href;
  return ((await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ configUrl)) as { default: unknown }).default;
}

async function build(root: string): Promise<Project> {
  const loaded = await importConfig(root);
  const problems = configProblems(loaded);
  if (problems.length > 0) throw new Error(`${configPathOf(root)} 有 ${problems.length} 处要改：\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  const config = loaded as ProjectConfig;
  const contentDir = (config.content ?? "content").replace(/\\/g, "/").replace(/\/+$/, "");
  const contentAbs = join(root, contentDir);
  if (!existsSync(contentAbs) || !statSync(contentAbs).isDirectory()) {
    throw new Error(`内容根 ${contentDir} 不是项目根下的目录——配置的 content 写错了，或者还没建`);
  }
  const service = createService({ formats: config.formats, reader: createReader(root), history: createGitHistory(root) });
  const placements = placementsOf(config);
  assertTurf(root, [contentDir], placements);

  function walk(dir: string, out: string[]): string[] {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path, out);
      else if (service.formatFor(name) !== null) out.push(docIdOf(root, path));
    }
    return out;
  }

  /** 现状区：内容根下除 trajectory/、future/ 之外的全部 */
  function statusDocs(): string[] {
    const out: string[] = [];
    for (const name of readdirSync(contentAbs)) {
      const path = join(contentAbs, name);
      if (statSync(path).isDirectory()) {
        if (!FIXED_AREAS.has(name)) walk(path, out);
      } else if (service.formatFor(name) !== null) {
        out.push(docIdOf(root, path));
      }
    }
    return out.sort();
  }

  // 摆放模块认得的只有这几样，先攒齐再交给它——它拿不到装配的别的部分。
  // 后三样是真盘那份适配器：落点相对项目根，读写与建父目录都在这儿，摆放本身不碰 node:fs
  const placingHost: PlacingHost = {
    service,
    placements: (doc) => placements[doc] ?? [],
    read: (doc) => readFileSync(join(root, doc), "utf8"),
    readPlaced(to) {
      const abs = join(root, to);
      return existsSync(abs) ? readFileSync(abs, "utf8") : null;
    },
    writePlaced(to, text) {
      const abs = join(root, to);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, text);
    },
  };

  return {
    root,
    config,
    service,
    roster: config.components,
    contentDir,
    trajectoryDir: join(contentAbs, "trajectory"),
    placing: createPlacing(placingHost),
    docs: statusDocs,
    placements: (doc) => placements[doc] ?? [],
    docIdOf: (path) => docIdOf(root, path),
    read: (doc) => readFileSync(join(root, doc), "utf8"),
    write: (doc, text) => writeFileSync(join(root, doc), text),
  };
}
