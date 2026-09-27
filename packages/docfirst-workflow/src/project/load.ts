/**
 * 消费方项目的装配。
 * 一个项目 = 一个根目录 + 一份 docfirst.config（声明内容根、组件名册、生成物摆到哪）。
 * loadProject(root) 把这些装配起来，返回带钉码编排的项目；同一个根只装配一次（站构建时几十个 loader 并发调它）。
 *
 * 分区按约定：内容根（`content`，默认 `content`）下 `trajectory/` 是轨迹卡、`future/` 是未来区，
 * 这两个名字固定；内容根下别的一切（目录里的、直接放在根上的）.mdx 文档都是现状区，都进 check。
 * 项目根下 `src/components/` 里有格式认领的代码文件（讲解组件的源码）也是现状区。配置怎么读、怎么校验在 config.ts。
 */
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { createPinner } from "@godcreator/code-pin";
import type { Roster } from "../mdx/index.ts";
import { codeFormat } from "../code/index.ts";
import { createPinning } from "../pinning/index.ts";
import type { Pinning } from "../pinning/index.ts";
import { createGitHistory, createReader, filesUnder, filesUnderFollowingLinks, isDirectory, namesIn, pathExists, readText, readTextIfExists, writeText, writeTextMakingParents } from "../node/index.ts";
import { contentDirOf, loadConfig } from "./config.ts";
import type { ProjectConfig } from "./config.ts";
import { assertTurf, createPlacing, placementsOf } from "./placement.ts";
import type { Placement, Placing, PlacingHost } from "./placement.ts";

export interface Project {
  root: string;
  config: ProjectConfig;
  /** 钉码编排：核对与确认一篇文档都经它 */
  pinning: Pinning;
  roster: Roster | undefined;
  /** 内容根，相对项目根、正斜杠 */
  contentDir: string;
  /** 轨迹卡目录的绝对路径：内容根下的 trajectory/，不一定已经建了 */
  trajectoryDir: string;
  /** 摆放：render 摆放一次、check 只核对。渲染成什么、跟已有文件怎么比、落点状态怎么定，都由它负责 */
  placing: Placing;
  /** 现状区里的文件：内容根下的 .mdx 文档，加上 src/components/ 下有格式认领的代码文件；相对项目根、正斜杠、排过序 */
  docs(): string[];
  /** 这篇文档的摆放目标（归一化过）；没有映射给空数组 */
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

export function loadProject(root: string): Promise<Project> {
  const abs = resolve(root);
  let pending = cache.get(abs);
  if (pending === undefined) {
    pending = build(abs);
    cache.set(abs, pending);
  }
  return pending;
}

/** 现状区的文档：内容根下的 .mdx 文件 */
const isDoc = (name: string): boolean => name.endsWith(".mdx");

/** 内容根下固定的两个名字：轨迹卡与未来区，都不进 check */
const FIXED_AREAS = new Set(["trajectory", "future"]);

/** 讲解组件的源码目录，相对项目根 */
const COMPONENTS_DIR = "src/components";

async function build(root: string): Promise<Project> {
  const config = await loadConfig(root);
  const contentDir = contentDirOf(config);
  const contentAbs = join(root, contentDir);
  if (!isDirectory(contentAbs)) {
    throw new Error(`内容根 ${contentDir} 不是项目根下的目录——配置的 content 写错了，或者还没建`);
  }
  const pinning = createPinning(createPinner({ reader: createReader(root), history: createGitHistory(root) }));
  const placements = placementsOf(config);
  assertTurf(root, [contentDir], placements);

  /** 现状区：内容根下除 trajectory/、future/ 两个目录之外的全部 .mdx，加上 src/components/ 下组件格式认领的代码文件 */
  function statusDocs(): string[] {
    const pages: string[] = [];
    for (const name of namesIn(contentAbs)) {
      const path = join(contentAbs, name);
      if (isDirectory(path)) {
        if (!FIXED_AREAS.has(name)) pages.push(...filesUnderFollowingLinks(path).filter(isDoc).map((file) => docIdOf(root, file)));
      } else if (isDoc(name)) {
        pages.push(docIdOf(root, path));
      }
    }
    return [...pages, ...componentFiles()].sort();
  }

  function componentFiles(): string[] {
    const dir = join(root, COMPONENTS_DIR);
    if (!pathExists(dir)) return [];
    return filesUnder(dir).map((path) => docIdOf(root, path)).filter(codeFormat.claims);
  }

  // 摆放模块认得的只有这几样，先备齐再传给它——它拿不到装配的别的部分。
  // 后三样是读写真实文件的适配器：落点相对项目根，读写与建父目录经 ../node/，摆放本身不碰 node:fs
  const placingHost: PlacingHost = {
    pinning,
    placements: (doc) => placements[doc] ?? [],
    read: (doc) => readText(join(root, doc)),
    readPlaced: (to) => readTextIfExists(join(root, to)),
    writePlaced: (to, text) => writeTextMakingParents(join(root, to), text),
  };

  return {
    root,
    config,
    pinning,
    roster: config.components,
    contentDir,
    trajectoryDir: join(contentAbs, "trajectory"),
    placing: createPlacing(placingHost),
    docs: statusDocs,
    placements: (doc) => placements[doc] ?? [],
    docIdOf: (path) => docIdOf(root, path),
    read: (doc) => readText(join(root, doc)),
    write: (doc, text) => writeText(join(root, doc), text),
  };
}
