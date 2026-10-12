/**
 * 宿主接线（React Router 资源路由形状）：loader 渲染页面、action 处理写入。
 * 在 React Router v7 框架模式里，这两个函数就是 routes/comments.ts 里导出的 loader 与 action
 * （签名 (args: { request }) => Promise<Response>），宿主状态经 route context 注入；样本不依赖
 * react-router 包，用同样的签名直接驱动，接进真实站点时函数体原样可用。
 *
 * 身份边界：people、身份码、可信 origin 全部由宿主在启动时确定并显式传入；
 * 请求里自报的 actor 字段不参与判定，署名人只取 authorizeWrite 返回的可信 actor
 */
import { publicPeopleOf } from '@probe/identity'
import { authorizeWrite, readPeopleFile, resolveIdentity, writeAccessResponse } from '@probe/identity/server'
import { renderErrorPage, renderPage } from './page.js'
import { addComment, CommentInputError, type Comment } from './comments.js'

/** 宿主在启动时确定的样本环境；comments 是宿主持有的内存态（真实站点里换成读集合） */
export type SampleHost = {
  siteDir: string
  trustedOrigin: string
  identityCode: string | undefined
  comments: Comment[]
}

/** GET /：解析身份并渲染页面。给页面的人员列表先经 publicPeopleOf 投影，codes 不出服务端 */
async function loader({ request }: { request: Request }, host: SampleHost): Promise<Response> {
  const stored = readPeopleFile(host.siteDir)
  const identity = resolveIdentity(stored, host.identityCode)
  const html = renderPage({ identity, people: publicPeopleOf(stored), comments: host.comments, origin: host.trustedOrigin })
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

/**
 * POST /comments：先 authorizeWrite 拿可信 actor，再调评论纯函数。
 * authorizeWrite 抛错（Origin 不对、无身份、as 不合法）时控制流到不了 addComment，业务写入不会发生
 */
async function action({ request }: { request: Request }, host: SampleHost): Promise<Response> {
  const stored = readPeopleFile(host.siteDir)
  const identity = resolveIdentity(stored, host.identityCode)
  const form = await request.formData()
  try {
    // as 直接把表单值传给身份包判定（非字符串、空串、没登记的人、人都由它拒）；
    // 这里宿主把「不代发」的空串转成省略，是宿主自己的表单约定，包层的规则不受影响
    const asValue = form.get('as')
    const actor = authorizeWrite(request, {
      identity,
      people: stored,
      as: asValue === '' ? undefined : asValue,
      origin: host.trustedOrigin,
    })
    const { comments } = addComment(host.comments, actor, String(form.get('body') ?? ''))
    host.comments = comments
    return new Response(null, { status: 303, headers: { location: '/' } })
  } catch (error) {
    if (error instanceof CommentInputError) return renderErrorPage(error.status, error.message)
    // writeAccessResponse 只转 WriteAccessError，别的错误原样再抛，由服务器层回 500
    const rejected = writeAccessResponse(error)
    return renderErrorPage(rejected.status, (await rejected.text()).trim())
  }
}

export function createSampleRoutes(host: SampleHost) {
  return {
    loader: (args: { request: Request }) => loader(args, host),
    action: (args: { request: Request }) => action(args, host),
  }
}
