import { PageIndex } from '@collab/ui'

export const meta = { title: '首页' }

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <h1 className="text-3xl font-bold">2026 SST 与 MMC 样机设计</h1>
      <p className="text-fd-muted-foreground">
        每一页是 <code>pages/</code> 下的一个 React 组件，页面旁边同名的 <code>.collab.json</code> 存这一页的批注和任务。右侧批注栏里「添加批注」后点页面上的元素，批注会写回那份 JSON。
      </p>
      <PageIndex />
    </div>
  )
}
