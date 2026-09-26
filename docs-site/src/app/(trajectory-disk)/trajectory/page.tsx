import { join } from 'node:path';
import Link from 'next/link';
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch';
import { loadTrajectory, StarDisk } from '@godcreator/docfirst-fumadocs/trajectory';

// 顶栏归页面画（回文档、报病数、主题切换），搜索、设置、帮助、图例、竖轨是组件自己固定在容器四角的浮层。
export default async function Page() {
  const data = await loadTrajectory(join(process.cwd(), 'content', 'trajectory'));
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
        <StarDisk data={data} hrefBase="/trajectory" />
      </div>
    </div>
  );
}
