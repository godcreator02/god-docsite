/**
 * docfirst 站在基础站上多出来的几步：叠 docfirst 的起始物、写 doc 系列脚本与命令行依赖、加三个功能包。
 * 功能包与 docfirst 包是本插件的 dependencies，只按路径读它们的 package.json 与 template/，一行不 import。
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { GwbDocsiteApi } from "../service.js";
import { isRecord } from "./vocab.js";

/** 命令行包：template/ 叠在站点根，站点 devDependencies 里装它，doc 系列脚本调它的 docfirst 命令 */
export const DOCFIRST_PACKAGE = "@godcreator/docfirst";

/** docfirst 站要的功能包，按这个顺序交给 gwbDocsite.addFeature */
export const DOCFIRST_FEATURES = ["@godcreator/code-pin", "@godcreator/trajectory", "@godcreator/explainer"] as const;

/** 写进站点 package.json 的脚本：核对、确认、生成 */
export const DOCFIRST_SCRIPTS: Readonly<Record<string, string>> = {
  doc: "docfirst check",
  "doc:confirm": "docfirst confirm",
  "doc:render": "docfirst render",
};

export interface PackageNearby {
  dir: string;
  version: string;
}

/** 按 Node 找包的顺序：从 fromDir 起逐级往上看各级 node_modules 里有没有这个包；不经 exports，没导出 package.json 的包也找得到 */
export function packageNearby(fromDir: string, name: string): PackageNearby {
  for (let dir = resolve(fromDir); ; dir = dirname(dir)) {
    const packageDir = join(dir, "node_modules", ...name.split("/"));
    const manifestFile = join(packageDir, "package.json");
    if (existsSync(manifestFile)) {
      const manifest: unknown = JSON.parse(readFileSync(manifestFile, "utf8"));
      const version = isRecord(manifest) ? manifest["version"] : undefined;
      if (typeof version !== "string" || version === "") throw new Error(`${manifestFile} 没写 version`);
      return { dir: packageDir, version };
    }
    if (dirname(dir) === dir) throw new Error(`从 ${fromDir} 往上的 node_modules 里找不到 ${name}：它是 gwb-docsite 的 dependencies，重装插件`);
  }
}

function filesUnder(dir: string, prefix = ""): string[] {
  return readdirSync(dir)
    .flatMap((entry) => {
      const full = join(dir, entry);
      const relative = prefix === "" ? entry : `${prefix}/${entry}`;
      return statSync(full).isDirectory() ? filesUnder(full, relative) : [relative];
    })
    .sort();
}

/** 把 docfirst 的 template/ 叠到站点根：站点已有的文件不覆盖。回补进去的与留着没动的（相对站点根） */
export function overlayDocfirstTemplate(siteDir: string, docfirstDir: string): { added: string[]; kept: string[] } {
  const templateDir = join(docfirstDir, "template");
  if (!existsSync(templateDir)) throw new Error(`${DOCFIRST_PACKAGE}（${docfirstDir}）没有 template/`);
  const added: string[] = [];
  const kept: string[] = [];
  for (const relative of filesUnder(templateDir)) {
    const target = join(siteDir, relative);
    if (existsSync(target)) {
      kept.push(relative);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(templateDir, relative), target);
    added.push(relative);
  }
  return { added, kept };
}

/** 往站点 package.json 写 doc 系列脚本与 devDependencies 里的 docfirst 命令行；站点已有同名脚本或这个依赖就报错，不替人改 */
export function addDocfirstScripts(siteDir: string, docfirstSpecifier: string): void {
  const file = join(siteDir, "package.json");
  const manifest: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!isRecord(manifest)) throw new Error(`${file} 要是一个对象`);
  const scripts = isRecord(manifest["scripts"]) ? manifest["scripts"] : {};
  const devDependencies = isRecord(manifest["devDependencies"]) ? manifest["devDependencies"] : {};
  const clashes = Object.keys(DOCFIRST_SCRIPTS).filter((name) => scripts[name] !== undefined);
  if (clashes.length > 0) throw new Error(`${file} 已经有脚本 ${clashes.join("、")}：docfirst 只往新站里写`);
  if (devDependencies[DOCFIRST_PACKAGE] !== undefined) throw new Error(`${file} 的 devDependencies 已经有 ${DOCFIRST_PACKAGE}：docfirst 只往新站里写`);
  manifest["scripts"] = { ...scripts, ...DOCFIRST_SCRIPTS };
  manifest["devDependencies"] = { ...devDependencies, [DOCFIRST_PACKAGE]: docfirstSpecifier };
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
}

export interface DocfirstSiteDeps {
  docsite: Pick<GwbDocsiteApi, "init" | "addFeature">;
  /** 包的版本与目录从哪里找：插件包根（这几个包是本插件的 dependencies） */
  packagesFrom: string;
}

/**
 * 建一个 docfirst 站：gwbDocsite.init 建基础站 → 叠 docfirst 起始物、写脚本与命令行依赖 → 逐个 gwbDocsite.addFeature。
 * 脚本与依赖写在加功能之前：addFeature 的 pnpm add 顺带把 docfirst 命令行装上，不用再装一次。版本都是插件旁边装着的那一版写 ^<版本>
 */
export async function createDocfirstSite(siteDir: string, { title }: { title: string }, deps: DocfirstSiteDeps): Promise<{ features: string[] }> {
  await deps.docsite.init(siteDir, { title });
  const docfirst = packageNearby(deps.packagesFrom, DOCFIRST_PACKAGE);
  overlayDocfirstTemplate(siteDir, docfirst.dir);
  addDocfirstScripts(siteDir, `^${docfirst.version}`);
  let features: string[] = [];
  for (const packageName of DOCFIRST_FEATURES) {
    const added = await deps.docsite.addFeature(siteDir, { packageName, specifier: `^${packageNearby(deps.packagesFrom, packageName).version}` });
    features = added.features;
  }
  return { features };
}
