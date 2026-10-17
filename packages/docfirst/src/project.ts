/**
 * 一个项目 = 项目根 + 校验过的配置。装配时定下现状区有哪些文件，备好钉码与生成物两个功能包要的对象。
 *
 * 分区按约定：内容根下 `trajectory/` 与 `future/` 两个名字固定、不进核对；内容根下别的 .mdx 都是现状区，
 * 再加上现状区里组件格式认领的代码文件（讲解组件的源码）：页面同名文件夹、组里 `_` 开头的共用文件夹、内容根下几组页面共用的 `_components/`。
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import { codeFormat } from "@godcreator/code-pin";
import { createPinWorkspace } from "@godcreator/code-pin/node";
import type { PinWorkspace } from "@godcreator/code-pin/node";
import { assertOutputTurf } from "@godcreator/doc-export/node";
import type { OutputProject } from "@godcreator/doc-export/node";
import type { DocfirstConfig } from "./config.ts";

export interface Project {
  root: string;
  config: DocfirstConfig;
  /** 钉码：读工作区、旧内容从 git 取 */
  pins: PinWorkspace;
  /** 生成物：落点、名册、和 pins 同一个钉码核心 */
  outputs: OutputProject;
  /** 现状区里的文件：相对项目根、正斜杠、排过序 */
  docs: string[];
  /** 这篇是不是生成正本（outputs 里有它） */
  isOutputSource(doc: string): boolean;
  docIdOf(path: string): string;
  read(doc: string): string;
}

/** 文档身份：相对项目根、正斜杠。绝对路径按项目根算；相对路径原样收，`./` 前缀与反斜杠一并归一 */
export function docIdOf(root: string, path: string): string {
  const rel = isAbsolute(path) ? relative(root, path) : path;
  return rel.split(sep).join("/").replace(/\\/g, "/").replace(/^\.\//, "");
}

const NOT_STATUS_AREAS = new Set(["trajectory", "future"]);
const isPage = (name: string): boolean => name.endsWith(".mdx");

/** 目录下的全部文件（递归），绝对路径；指向目录的软链接会跟进去 */
function filesUnderFollowingLinks(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnderFollowingLinks(path) : [path];
  });
}

/** 现状区里的全部文件（文档身份）：内容根下除 trajectory/、future/ 之外的 */
function statusAreaFiles(root: string, contentAbs: string): string[] {
  return readdirSync(contentAbs).flatMap((name) => {
    const path = join(contentAbs, name);
    if (statSync(path).isDirectory()) return NOT_STATUS_AREAS.has(name) ? [] : filesUnderFollowingLinks(path).map((file) => docIdOf(root, file));
    return [docIdOf(root, path)];
  });
}

/** 目录下的全部文件（递归），绝对路径；按目录项自己的类型判断，指向目录的软链接当成文件 */
function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

/** 内容根下放几组页面共用的组件的文件夹：`_` 开头，所以是现状区里的普通文件夹，不用单独收 */
const SHARED_COMPONENTS_FOLDER = "_components";
/** 讲解组件以前放的位置：还有文件就报错，不然里面的钉码没人核对 */
const RETIRED_COMPONENTS_DIR = "src/components";
/** 几组页面共用的组件以前放的位置：站点代码也可以放这里，只有带钉码标记的文件才报错 */
const RETIRED_SHARED_COMPONENTS_DIR = "app/components";

function whereComponentsGo(contentDir: string): string {
  return `讲解组件只给一页用的放进那一页的同名文件夹，几组页面共用的放进 ${contentDir}/${SHARED_COMPONENTS_FOLDER}/，docfirst 只核对内容根里的钉码`;
}

function assertNoRetiredComponents(root: string, contentDir: string): void {
  const dir = join(root, RETIRED_COMPONENTS_DIR);
  if (!existsSync(dir)) return;
  const files = filesUnder(dir).map((path) => docIdOf(root, path));
  if (files.length === 0) return;
  throw new Error(`${RETIRED_COMPONENTS_DIR}/ 下还有文件：${files.join("、")}——${whereComponentsGo(contentDir)}`);
}

function hasPinMarkers(root: string, file: string): boolean {
  try {
    return codeFormat.parse(readFileSync(join(root, file), "utf8")).length > 0;
  } catch (err) {
    throw new Error(`${file}：${(err as Error).message}`);
  }
}

function assertNoPinsInRetiredSharedComponents(root: string, contentDir: string): void {
  const dir = join(root, RETIRED_SHARED_COMPONENTS_DIR);
  if (!existsSync(dir)) return;
  const pinnedFiles = filesUnder(dir).map((path) => docIdOf(root, path)).filter(codeFormat.claims).filter((file) => hasPinMarkers(root, file));
  if (pinnedFiles.length === 0) return;
  throw new Error(`${RETIRED_SHARED_COMPONENTS_DIR}/ 下有带钉码标记的文件：${pinnedFiles.join("、")}——${whereComponentsGo(contentDir)}`);
}

/** outputs 里的正本得是现状区里的 mdx 页面：写错路径的映射不会被核对，也不会被生成 */
function assertOutputSourcesAreStatusPages(outputs: DocfirstConfig["outputs"], docs: readonly string[]): void {
  const pages = new Set(docs.filter(isPage));
  const strays = Object.keys(outputs).filter((doc) => !pages.has(doc));
  if (strays.length > 0) throw new Error(`outputs 里的正本不是现状区的 mdx 页面：${strays.join("、")}——正本要写相对项目根的路径，放在内容根下（trajectory/、future/ 之外）`);
}

export function assembleProject(root: string, config: DocfirstConfig): Project {
  const contentAbs = join(root, config.contentDir);
  if (!existsSync(contentAbs) || !statSync(contentAbs).isDirectory()) {
    throw new Error(`内容根 ${config.contentDir} 不是项目根下的目录——配置的 content 写错了，或者还没建`);
  }
  assertOutputTurf(root, [config.contentDir], config.outputs);
  assertNoRetiredComponents(root, config.contentDir);
  assertNoPinsInRetiredSharedComponents(root, config.contentDir);
  const statusFiles = statusAreaFiles(root, contentAbs);
  const docs = [...statusFiles.filter(isPage), ...statusFiles.filter(codeFormat.claims)].sort();
  assertOutputSourcesAreStatusPages(config.outputs, docs);
  const pins = createPinWorkspace(root);
  return {
    root,
    config,
    pins,
    outputs: { root, outputs: config.outputs, roster: config.roster, pinner: pins.pinner },
    docs,
    isOutputSource: (doc) => config.outputs[doc] !== undefined,
    docIdOf: (path) => docIdOf(root, path),
    read: (doc) => readFileSync(join(root, doc), "utf8"),
  };
}
