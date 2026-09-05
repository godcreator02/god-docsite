import { resolve } from 'node:path';
import Link from 'next/link';
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch';
import { buildTrajectory } from '@godcreator02/live-doc-trajectory';
import { StarDisk } from '@godcreator02/live-doc-trajectory/react';
import { launcherThumbs } from '@godcreator02/live-doc-trajectory/server';

// 星轨整页：卡目录就是本站的 cards/。`?disk=` 缺失渲启动器卡阵（每张盘一张服务端渲好的
// 静态定妆照），有则渲那张盘；组件切盘（点虫洞 / 点卡）与回启动器时也写回这个参数。
// 顶栏归页面：左边回文档，盘内多一条「启动器」返回；右边报病数与主题切换。
export default async function Page({ searchParams }: { searchParams: Promise<{ disk?: string }> }) {
  const { disk } = await searchParams;
  const data = await buildTrajectory(resolve(process.cwd(), 'cards'));
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
