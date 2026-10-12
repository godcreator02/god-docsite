/**
 * 样本页面：服务端渲染（react-dom/server），展示身份公开组件怎么被宿主使用——
 * Avatar 逐个作者用、IdentityBadge 带宿主插槽、人员列表只收投影过的公开形状
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { Avatar, IdentityBadge } from '@probe/identity/react'
import type { Person, SiteIdentity } from '@probe/identity'
import type { Comment } from './comments.js'

function htmlDocument(title: string, body: string) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="/identity.css">
<link rel="stylesheet" href="/sample.css">
</head>
<body>
${body}
</body>
</html>
`
}

function Page({ identity, people, comments, origin }: { identity: SiteIdentity; people: readonly Person[]; comments: readonly Comment[]; origin: string }) {
  const agents = people.filter((person) => person.agent)
  return (
    <main className="page">
      <h1>身份边界组合样本</h1>
      <p className="hint">
        可信 origin：<code>{origin}</code>。写入请求的 Origin 头要与它逐字符相等；身份码只留在服务端，这个页面与所有错误文本里都不会出现。
      </p>

      <section>
        <h2>当前身份</h2>
        <IdentityBadge identity={identity}>
          {/* 宿主插槽：身份包不注入功能，这里放什么都由宿主决定 */}
          <a className="slot-demo" href="#" title="宿主插槽示例：真实站点里放人员管理入口">
            身份码管理（宿主插槽示例）
          </a>
        </IdentityBadge>
        {identity.person ? <p className="hint">可以写评论；也可以用 as 以 agent 的名义代发。</p> : <p className="hint">这个服务没有本机的身份码：只读，写请求一律 403。</p>}
      </section>

      <section>
        <h2>人员列表（公开投影）</h2>
        <ul className="people">
          {people.map((person) => (
            <li key={person.id}>
              <Avatar person={person} />
              <span>
                {person.name}（{person.id}）
              </span>
              {person.agent ? <span className="tag">agent</span> : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>评论</h2>
        {comments.length === 0 ? <p className="hint">还没有评论。</p> : null}
        <ul className="comments">
          {comments.map((comment) => (
            <li key={comment.id}>
              <Avatar person={{ id: comment.author.id, name: comment.author.name }} size={20} />
              <div>
                <div className="comment-author">
                  {comment.author.name}（{comment.author.id}）
                </div>
                <div>{comment.body}</div>
              </div>
            </li>
          ))}
        </ul>

        <form method="post" action="/comments" className="comment-form">
          <label>
            评论正文
            <textarea name="body" rows={3} placeholder="写点什么……" />
          </label>
          <label>
            以谁的名义发
            <select name="as">
              <option value="">本人（按身份码，不代发）</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  代发为 {agent.name}（{agent.id}，agent）
                </option>
              ))}
            </select>
          </label>
          {/* 演示自报 actor 被忽略：这个字段的值不会成为署名人，服务端只认 authorizeWrite 返回的可信 actor */}
          <input type="hidden" name="actor" value="li" />
          <button type="submit">发表</button>
        </form>
      </section>
    </main>
  )
}

export function renderPage(args: { identity: SiteIdentity; people: readonly Person[]; comments: readonly Comment[]; origin: string }): string {
  return htmlDocument('身份边界组合样本', renderToStaticMarkup(<Page {...args} />))
}

export function renderErrorPage(status: number, message: string): Response {
  const body = renderToStaticMarkup(
    <main className="page">
      <h1>写入被拒（{status}）</h1>
      <p>{message}</p>
      <p className="hint">
        回 <a href="/">样本首页</a>
      </p>
    </main>,
  )
  return new Response(htmlDocument(`写入被拒（${status}）`, body), { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
}
