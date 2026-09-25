/**
 * `@godcreator/docfirst-fumadocs/trajectory`：服务端组件 `Trajectory`——读卡目录、建模、渲 `StarDisk`，
 * 下面列报病；另给一个 `loadTrajectory(dir)`，要自己摆页面的站直接拿数据。
 *
 * 读卡目录走 `@godcreator/docfirst-workflow/cards` 的 `scanCardDir`（它顺带查卡里不许钉码），建模走
 * `@godcreator/docfirst-trajectory` 的纯函数。只引 `./cards` 不引 `.`：`.` 带着命令行与配置加载，
 * 进了 Next 的服务端构建会让 Turbopack 报按路径读盘的警告，Next 16.3.5 显示这条警告时会崩溃。`StarDisk` 用包名从 `@godcreator/docfirst-trajectory/disk`
 * 取：那份产物头一行是 "use client"，按包名 import 它原样留在产物里，Next 才认得出客户端边界；
 * 打进这份产物的话指令就丢了，StarDisk 会被当服务端组件渲染，命中 hooks 就报错。
 */

import { resolve } from "node:path";
import { buildTrajectory, launcherThumbs } from "@godcreator/docfirst-trajectory";
import type { Trajectory as TrajectoryData } from "@godcreator/docfirst-trajectory";
import { StarDisk } from "@godcreator/docfirst-trajectory/disk";
import { scanCardDir } from "@godcreator/docfirst-workflow/cards";

/** 读一个卡目录并建模：绝对路径，或相对站的项目根（`process.cwd()`）的相对路径；目录不在给空模型 */
export async function loadTrajectory(dir: string): Promise<TrajectoryData> {
  return buildTrajectory(await scanCardDir(resolve(process.cwd(), dir)));
}

export interface TrajectoryProps {
  /** 卡目录：绝对路径，或相对站的项目根（`process.cwd()`）的相对路径——站的 mdx 里写的都是相对写法。 */
  dir: string;
  /** 卡页路由前缀，透传给 StarDisk。 */
  hrefBase: string;
  /** 初始显示哪张盘，透传给 StarDisk；不给就是启动器卡阵。 */
  initialDisk?: string;
}

export async function Trajectory({ dir, hrefBase, initialDisk }: TrajectoryProps) {
  const data = await loadTrajectory(dir);
  return (
    <div className="star-trajectory">
      <StarDisk data={data} hrefBase={hrefBase} initialDisk={initialDisk} thumbs={launcherThumbs(data)} />
      {data.sick.length > 0 ? (
        <div className="star-sick">
          <div className="star-sick-title">报病（{data.sick.length} 个文件）</div>
          <ul>
            {data.sick.map((f) => (
              <li key={f.path}>
                <code>{f.path}</code>
                <ul>
                  {f.problems.map((p, i) => (
                    <li key={i}>
                      {p.reason}
                      {p.value ? `：${p.value}` : ""}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
