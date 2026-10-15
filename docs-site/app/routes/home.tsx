import { Link, useLoaderData } from 'react-router'
import { BookOpen, Cpu, LayoutTemplate, Server, Wrench } from 'lucide-react'
import { Card, Cards } from '@fumadocs/base-ui/components/card'
import { siteHomeData } from '@godcreator/god-docsite/server'
import { SiteHomeLayout } from '@godcreator/god-docsite/react'
import { site } from '@/lib/site.server'
import { featureRuntime } from '@/features/runtime.generated'

export function loader() {
  return siteHomeData(site)
}

export default function Home() {
  const data = useLoaderData<typeof loader>()
  return (
    <SiteHomeLayout data={data} sidebarLinks={featureRuntime.sidebarLinks}>
      <title>{data.siteName}</title>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-14 px-4 py-20">
        <section className="flex flex-col items-center gap-5 text-center">
          <h1 className="text-4xl font-bold">{data.siteName}</h1>
          <p className="max-w-2xl text-fd-muted-foreground">
            文档站平台包、按功能切的功能包，以及三个 gwb 插件。仓正在重构，设计未定，以代码和仓根 AGENTS.md 为准。
          </p>
          <Link to={data.docsUrl} className="rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90">
            看文档
          </Link>
        </section>
        <Cards>
          <Card icon={<BookOpen />} title="总览" description="有哪些包、依赖方向、三个插件各做什么" href="/docs" />
          <Card icon={<Cpu />} title="fumadocs 原理" description="站点底下的 fumadocs、Vite 与 React Router 怎么工作" href="/background/overview" />
          <Card icon={<LayoutTemplate />} title="写页面" description="一页说明怎么写、能用哪些组件" href="/docsite/writing" />
          <Card icon={<Server />} title="Gitea 与 NAS" description="NAS 上的 Gitea、执行器与 ntfy 各做什么、怎么配" href="/gitea" />
          <Card icon={<Wrench />} title="维护" description="怎么跑、检查节奏、发版顺序" href="/maintain" />
        </Cards>
      </div>
    </SiteHomeLayout>
  )
}
