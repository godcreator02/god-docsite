// TSX 页面样本：标题与描述从导出的 meta 来；页面引用同目录 demo/ 里的组件。
// 验收断言按行为写：点「加一」数字加一、输入框内容跟着显示、点导航链接切换到别的页面。
import { Link } from 'react-router'
import { CounterPanel } from './demo/counter-panel'

export const meta = { title: '交互样本', description: '计数、未保存输入与站内导航的验收载体' }

export default function Page() {
  return (
    <main>
      <h2>计数与输入</h2>
      <CounterPanel start={0} />
      <h2>站内导航</h2>
      <p>
        点这个链接回站点首页：<Link to="/">回首页</Link>
      </p>
    </main>
  )
}
