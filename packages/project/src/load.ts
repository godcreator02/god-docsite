/**
 * 消费方项目的装配。
 * 一个项目 = 一个根目录 + 一份 livedoc.config（声明格式包、文档目录、用哪个比较器）+ 一本记录簿。
 * loadProject(root) 把这些串起来交出一个核心服务；同一个根只装配一次（站构建时几十个 loader 并发调它）。
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createHashComparator, createKindComparator, createService } from "@godcreator02/live-doc-core";
import type { Comparator, Format, Service } from "@godcreator02/live-doc-core";
import { createAutoComparator } from "./auto-comparator.ts";
import { createReader } from "./fs-reader.ts";
import { createGitComparator } from "./git-comparator.ts";
import { createLedger } from "./json-ledger.ts";
import { assertTurf, createPlacing, placementsOf } from "./placement.ts";
import type { OutputTarget, Placement, Placing, PlacingHost } from "./placement.ts";

export interface ProjectConfig {
  /** 这个项目挂了哪些格式包 */
  formats: Format[];
  /** 文档目录，相对项目根；默认 docs。给数组就几个目录一起扫（六区站是 docs + outputs 两区进 check） */
  docs?: string | string[];
  /** 渲染产物落哪，相对项目根；默认 out */
  out?: string;
  /** 记录簿文件，相对项目根；默认 .ledger.json */
  ledger?: string;
  /** 行段 / 整文件的记忆：auto（默认，按文件位置挑 git 或 hash）、git、hash，或者自己造一个（自己造的得自己管全部五种目标） */
  comparator?: "auto" | "git" | "hash" | Comparator;
  /** 组件名册（压平规则），格式包用；没声明就用格式包的默认表 */
  components?: Record<string, unknown>;
  /**
   * 渲染产物的摆放：文档路径（正斜杠，同记录簿的键）→ 目标数组。每个目标是相对项目根的路径（可以出根），
   * 或者 `{ to, frontmatter }`——要生成物保留 frontmatter 里的几个字段时用对象写法。
   * 挂了映射的文档 render --target ai 只写目标，不落 out/
   */
  outputs?: Record<string, Array<string | OutputTarget>>;
  /** fumadocs 格式包的私货：集合名。一个字符串是全部文档同一个集合；按文档目录分就给一张表（文档目录 → 集合名） */
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
  /** 轨迹卡目录的绝对路径；`livedoc.config` 没配 `trajectory` 时为 null */
  trajectoryDir: string | null;
  /** 摆放：render 摆一趟、check 只核对。渲成什么、跟盘上怎么比、四态怎么定，都在它背后 */
  placing: Placing;
  /** 文档目录下有格式包认领的那些文档，相对项目根、正斜杠、排过序 */
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
 * 文档身份：相对项目根、正斜杠。记录簿的键、命令行的报告、站的 loader 都用它。
 * 绝对路径按项目根算；相对路径原样收，`./` 前缀与反斜杠一并归一——命令行点名的路径三种写法都可能。
 */
export function docIdOf(root: string, path: string): string {
  const rel = isAbsolute(path) ? relative(root, path) : path;
  return rel.split(sep).join("/").replace(/\\/g, "/").replace(/^\.\//, "");
}

const CONFIG_NAMES = ["livedoc.config.mjs", "livedoc.config.js", "livedoc.config.ts"];

export function configPathOf(root: string): string {
  const hit = CONFIG_NAMES.map((name) => join(root, name)).find((path) => existsSync(path));
  if (hit === undefined) throw new Error(`${root} 下没有 livedoc.config.mjs——项目根就是放配置的那个目录`);
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

function comparatorOf(config: ProjectConfig, root: string): Comparator {
  const want = config.comparator ?? "auto";
  if (want === "auto") return createAutoComparator({ root });
  // 强制 git / hash 只管行段和整文件；目录树、存在性、名字照旧走核心那三个
  if (want === "git") return createKindComparator({ span: createGitComparator({ root }) });
  if (want === "hash") return createKindComparator({ span: createHashComparator() });
  return want;
}

async function build(root: string): Promise<Project> {
  // 配置是消费方项目里的活模块，必须由 Node 原生加载：站的打包器会把动态 import 改写成
  // 它自己的加载器，两个标记让它绕开这一句（turbopack / webpack 各认一个）
  const configUrl = pathToFileURL(configPathOf(root)).href;
  const config = ((await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ configUrl)) as { default: ProjectConfig }).default;
  const service = createService({
    formats: config.formats,
    reader: createReader(root),
    ledger: createLedger(join(root, config.ledger ?? ".ledger.json")),
    comparator: comparatorOf(config, root),
  });
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

  // 摆放模块认得的只有这几样，先攒齐再交给它——它拿不到装配的别的部分
  const host: PlacingHost = {
    root,
    config,
    service,
    roster: config.components,
    placements: (doc) => placements[doc] ?? [],
    read: (doc) => readFileSync(join(root, doc), "utf8"),
  };

  return {
    ...host,
    docsDirs,
    trajectoryDir: config.trajectory !== undefined ? join(root, config.trajectory) : null,
    placing: createPlacing(host),
    docs: allDocs,
    docIdOf: (path) => docIdOf(root, path),
    write: (doc, text) => writeFileSync(join(root, doc), text),
  };
}
