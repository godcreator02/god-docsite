import { Link, useLoaderData } from 'react-router'
import { CalendarDays, ListTodo, MessageSquare, Orbit } from 'lucide-react'
import { Card, Cards } from '@fumadocs/base-ui/components/card'
import { siteHomeData } from '@godcreator/god-docsite/server'
import { SiteHomeLayout } from '@godcreator/god-docsite/react'
import { site } from '@/lib/site.server'
import { featureRuntime } from '@/features/runtime.generated'

export function loader() {
  return siteHomeData(site)
}

const buttonClassName = 'rounded-lg px-4 py-2 text-sm font-medium transition-colors'

export default function Home() {
  const data = useLoaderData<typeof loader>()
  return (
    <SiteHomeLayout data={data} sidebarLinks={featureRuntime.sidebarLinks}>
      <title>{data.siteName}</title>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-14 px-4 py-20">
        <section className="flex flex-col items-center gap-5 text-center">
          <h1 className="text-4xl font-bold">{data.siteName}</h1>
          <p className="max-w-2xl text-fd-muted-foreground">
            god-docsite 仓的测试站：一个假的三人项目，基础站装上协作、钉码、轨迹卡、讲解四个功能。任务与模块在协作仓的 collab/records/，日志在站点的 journal/。
          </p>
          <div className="flex gap-3">
            <Link to={data.docsUrl} className={`${buttonClassName} bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/90`}>
              看文档
            </Link>
            <Link to="/tasks" className={`${buttonClassName} border bg-fd-secondary text-fd-secondary-foreground hover:bg-fd-accent`}>
              看任务
            </Link>
          </div>
        </section>
        <Cards>
          <Card icon={<ListTodo />} title="任务" description="看板、甘特图与模块" href="/tasks" />
          <Card icon={<CalendarDays />} title="日历" description="每天的日志，点一天看当天写了什么" href="/calendar" />
          <Card icon={<MessageSquare />} title="评论" description="全站的评论按页分组列出来" href="/comments" />
          <Card icon={<Orbit />} title="轨迹" description="站点根 trajectory/ 里的轨迹卡画成的星轨盘" href="/trajectory" />
        </Cards>
      </div>
    </SiteHomeLayout>
  )
}
