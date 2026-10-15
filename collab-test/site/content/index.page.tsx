import { Card, Cards } from '@fumadocs/base-ui/components/card'
import { BookOpen, CalendarDays, FileText, ListTodo, MessageSquare, Orbit } from 'lucide-react'

export const meta = { title: '协作站测试', description: 'god-docsite 仓的测试站：一个假的三人项目，装上了协作、钉码、轨迹卡、讲解四个功能' }

/** 站点主页：不进页面树（content/meta.json 里写了 "!index"），列出功能页面和各组目录的入口 */
export default function Home() {
  return (
    <div>
      <h2 id="project">项目</h2>
      <Cards>
        <Card icon={<ListTodo />} title="任务" description="看板、甘特图与模块，数据在协作仓的 collab/records/" href="/tasks" />
        <Card icon={<CalendarDays />} title="日历" description="每天的日志，点一天看当天写了什么" href="/calendar" />
        <Card icon={<MessageSquare />} title="评论" description="全站的评论按页分组列出来" href="/comments" />
        <Card icon={<Orbit />} title="轨迹" description="站点根 trajectory/ 里的轨迹卡画成的星轨盘" href="/trajectory" />
      </Cards>
      <h2 id="pages">目录</h2>
      <Cards>
        <Card icon={<FileText />} title="这个测试站是什么" description="装了哪些功能、数据放在哪" href="/about" />
        <Card icon={<FileText />} title="重写方案" description="协作站从旧地基搬到新平台的方案" href="/plan" />
        <Card icon={<FileText />} title="用法示例" description="正文里能写什么：引用任务、站内链接、别的仓的链接、公式" href="/usage" />
        <Card icon={<BookOpen />} title="指南" description="另一组目录：侧栏左上角的目录切换按钮换到它" href="/guide" />
      </Cards>
    </div>
  )
}
