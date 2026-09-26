/**
 * `@godcreator/docfirst-fumadocs/trajectory`：`loadTrajectory(dir)` 读卡目录并建模，另外转出客户端组件
 * `StarDisk`——站的盘页拿前者的结果交给后者，只依赖这个包。盘的样式在 `./trajectory.css`。
 *
 * 读卡目录走 `@godcreator/docfirst-workflow/cards` 的 `scanCardDir`（它顺带查卡里不许钉码），建模走
 * `@godcreator/docfirst-trajectory` 的纯函数。只引 `./cards` 不引 `.`：`.` 带着命令行与配置加载，
 * 进了 Next 的服务端构建会让 Turbopack 报按路径读盘的警告，Next 16.3.5 显示这条警告时会崩溃。`StarDisk` 用包名从 `@godcreator/docfirst-trajectory/disk`
 * 转出：那份产物头一行是 "use client"，按包名引用它原样留在产物里，Next 才认得出客户端边界；
 * 打进这份产物的话指令就丢了，StarDisk 会被当服务端组件渲染，命中 hooks 就报错。
 */

import { resolve } from "node:path";
import { buildTrajectory } from "@godcreator/docfirst-trajectory";
import type { Trajectory } from "@godcreator/docfirst-trajectory";
import { scanCardDir } from "@godcreator/docfirst-workflow/cards";

export { StarDisk } from "@godcreator/docfirst-trajectory/disk";

/** 读一个卡目录并建模：绝对路径，或相对站的项目根（`process.cwd()`）的相对路径；目录不在给空盘 */
export async function loadTrajectory(dir: string): Promise<Trajectory> {
  return buildTrajectory(await scanCardDir(resolve(process.cwd(), dir)));
}
