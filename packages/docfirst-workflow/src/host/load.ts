/**
 * 消费方项目的装配。
 * 一个项目 = 一个根目录 + 一份 docfirst.config（声明格式、文档目录、生成物摆到哪）。
 * loadProject(root) 把这些串起来交出一个判定服务；同一个根只装配一次（站构建时几十个 loader 并发调它）。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createService } from "../engine/index.ts";
import type { Format, Service } from "../engine/index.ts";
import { createReader } from "./fs-reader.ts";
import { createGitHistory } from "./history.ts";
import { assertTurf, createPlacing, placementsOf } from "./placement.ts";
import type { OutputTarget, Placement, Placing, PlacingHost } from "./placement.ts";

export interface ProjectConfig {
  /** 这个项目挂了哪些格式 */
  formats: Format[];
  /** 文档目录，相对项目根；默认 docs。给数组就几个目录一起扫（六区站是 docs + outputs 两区进 check） */
  docs?: string | string[];
  /** 渲染产物落哪，相对项目根；默认 out */
  out?: string;
  /** 组件名册（压平规则），格式用；没声明就用格式的默认表 */
  components?: Record<string, unknown>;
  /**
   * 渲染产物的摆放：文档身份（相对项目根、正斜杠）→ 目标数组。每个目标是相对项目根的路径（可以出根），
   * 或者 `{ to, frontmatter }`——要生成物保留 frontmatter 里的几个字段时用对象写法。
   * 挂了映射的文档 render 只写目标，不落 out/
   */
  outputs?: Record<string, Array<string | OutputTarget>>;
  /** fumadocs 格式的私货：集合名。一个字符串是全部文档同一个集合；按文档目录分就给一张表（文档目录 → 集合名） */
  fumadocs?: { collection?: string | Record<string, string> };
  /** 轨迹卡目录，相对项目根；不配就不管轨迹（check 不跑卡校验、trajectory 子命令报错退出） */
  trajectory?: string;
}

export interface Project {
  root: string;
  config: ProjectConfig;
  service: Service;
  roster: Record<string, unknown> | undefined;
  /** 文档目录，相对项目根、正斜杠、按配置里的顺序；`docs` 没配就是 `["docs"]` */
  docsDirs: string[];
  /** 轨迹卡目录的绝对路径；`docfirst.config` 没配 `trajectory` 时为 null */
  trajectoryDir: string | null;
  /** 摆放：render 摆一趟、check 只核对。渲成什么、跟盘上怎么比、四态怎么定，都在它背后 */
  placing: Placing;
  /** 文档目录下有格式认领的那些文档，相对项目根、正斜杠、排过序 */
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

/** `docs` 配置项的两种写法归成一张目录表：字符串一项、数组照抄；没配退 `docs`。空串、空数组、非字符串项都拒 */
export function docsDirsOf(config: Pick<ProjectConfig, "docs">): string[] {
  const raw = config.docs ?? "docs";
  const dirs = Array.isArray(raw) ? raw : [raw];
  if (dirs.length === 0 || dirs.some((dir) => typeof dir !== "string" || dir.trim() === "")) {
    throw new Error("docs 得是一个非空目录，或几个非空目录的数组（相对项目根）");
  }
  return dirs.map((dir) => dir.replace(/\\/g, "/").replace(/\/+$/, ""));
}

async function build(root: string): Promise<Project> {
  // 配置是消费方项目里的活模块，必须由 Node 原生加载：站的打包器会把动态 import 改写成
  // 它自己的加载器，两个标记让它绕开这一句（turbopack / webpack 各认一个）
  const configUrl = pathToFileURL(configPathOf(root)).href;
  const config = ((await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ configUrl)) as { default: ProjectConfig }).default;
  const service = createService({ formats: config.formats, reader: createReader(root), history: createGitHistory(root) });
  const docsDirs = docsDirsOf(config);
  const placements = placementsOf(config);
  assertTurf(root, docsDirs, placements);

  function walk(dir: string, out: string[]): string[] {
    if (!existsSync(dir)) return out;
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path, out);
      else if (service.formatFor(name) !== null) out.push(docIdOf(root, path));
    }
    return out;
  }

  /** 几个文档目录一起扫；目录套目录时同一篇只算一次 */
  function allDocs(): string[] {
    const out: string[] = [];
    for (const dir of docsDirs) walk(join(root, dir), out);
    return [...new Set(out)].sort();
  }

  // 摆放模块认得的只有这几样，先攒齐再交给它——它拿不到装配的别的部分。
  // 后三样是真盘那份适配器：落点相对项目根，读写与建父目录都在这儿，摆放本身不碰 node:fs
  const placingHost: PlacingHost = {
    root,
    config,
    service,
    roster: config.components,
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
    docsDirs,
    trajectoryDir: config.trajectory !== undefined ? join(root, config.trajectory) : null,
    placing: createPlacing(placingHost),
    docs: allDocs,
    placements: (doc) => placements[doc] ?? [],
    docIdOf: (path) => docIdOf(root, path),
    read: (doc) => readFileSync(join(root, doc), "utf8"),
    write: (doc, text) => writeFileSync(join(root, doc), text),
  };
}
