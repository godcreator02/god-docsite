import Link from 'next/link';
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch';
import { loadTrajectory } from '@godcreator/docfirst-fumadocs/trajectory';
import { launcherThumbs } from '@godcreator/docfirst-trajectory';
import { StarDisk } from '@godcreator/docfirst-trajectory/disk';

// 星轨整页：读取站里的卡目录并建模，渲染一条顶栏和一张占满剩余高度的盘或启动器卡阵。
// 没有 `?disk=` 时渲染启动器（每张盘一张服务端预先渲染的静态缩略图），有则渲染那张盘；组件切盘、回启动器
// 时也写回这个参数。顶栏属于页面：左边回文档，盘内多一条「启动器」返回；右边是报病数与主题切换。
// 搜索、设置、帮助、图例、竖轨都是组件自己固定在容器四角的 HUD。
export default async function Page({ searchParams }: { searchParams: Promise<{ disk?: string }> }) {
  const { disk } = await searchParams;
  const data = await loadTrajectory('content/trajectory');
  const thumbs = launcherThumbs(data);
  return (
    <div className="trajectory-page">
      <header className="trajectory-topbar">
        <div className="trajectory-topbar-left">
          <Link href="/docs">← 文档</Link>
          {disk ? <Link href="/trajectory">启动器</Link> : null}
        </div>
        <div className="trajectory-topbar-right">
          {data.sick.length > 0 ? (
            <span className="trajectory-sick" title={data.sick.map((f) => f.path).join('\n')}>
              报病 {data.sick.length}
            </span>
          ) : null}
          <ThemeSwitch mode="light-dark" />
        </div>
      </header>
      <div className="trajectory-stage">
        <StarDisk data={data} hrefBase="/trajectory" mode="page" initialDisk={disk} thumbs={thumbs} />
      </div>
    </div>
  );
}
