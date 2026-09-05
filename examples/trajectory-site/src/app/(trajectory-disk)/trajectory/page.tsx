import { resolve } from 'node:path';
import Link from 'next/link';
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch';
import { buildTrajectory } from '@godcreator02/live-doc-trajectory';
import { StarDisk } from '@godcreator02/live-doc-trajectory/react';

// 星轨盘整页：卡目录就是本站的 cards/。顶栏归页面（左边回文档、右边报病数与主题切换），
// 盘页签 / 搜索 / 设置 / 帮助 / 图例是组件自己贴在容器四角的 HUD。
// 初始盘从 ?disk= 取，组件切盘（点虫洞、点页签）时也写回这个参数。
export default async function Page({ searchParams }: { searchParams: Promise<{ disk?: string }> }) {
  const { disk } = await searchParams;
  const data = await buildTrajectory(resolve(process.cwd(), 'cards'));
  return (
    <div className="trajectory-page">
      <header className="trajectory-topbar">
        <Link href="/docs">← 文档</Link>
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
        <StarDisk data={data} hrefBase="/trajectory" mode="page" initialDisk={disk} />
      </div>
    </div>
  );
}
