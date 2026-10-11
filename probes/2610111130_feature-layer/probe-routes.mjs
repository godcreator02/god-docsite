// 逐条请求试验路由，打印状态码与页面里的标记文字：node probe-routes.mjs <站点根地址>
const base = process.argv[2]
if (!base) throw new Error('用法：node probe-routes.mjs <站点根地址>')

const checks = [
  { path: '/', marker: '试验站的首页' },
  { path: '/second', marker: '第二页的正文' },
  { path: '/probe/in-package', marker: '包里的路由模块：loader 运行了' },
  { path: '/probe/via-alias', marker: '经别名读到的页面：' },
  { path: '/probe/journal/2026-10-11', marker: '日志正文渲染出来了' },
]

for (const { path, marker } of checks) {
  const response = await fetch(new URL(path, base))
  const html = await response.text()
  const found = html.includes(marker)
  const aliasLine = html.match(/经别名读到的页面：[^<]*/)?.[0]
  const journalLine = html.match(/第二个集合文件里的日志：[^<]*/)?.[0]
  const error = found ? '' : (html.match(/<pre[^>]*>([\s\S]{0,400})/)?.[1] ?? html.slice(0, 300)).replace(/\s+/g, ' ')
  console.log(response.status, found ? '有标记' : '没有标记', path, aliasLine ?? journalLine ?? '', error)
}
