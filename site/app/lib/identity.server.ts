import { authorizeWrite, identityCodeEnvName, identityOf, sitePeople, writeAccessResponse, type Person } from '@godcreator/docsite-identity/server'

export { sitePeople }

/**
 * 身份与写入边界：身份码由启动方（gwb-docsite）经环境变量注入；没有码或码不在 people.json 里就是只读。
 * origin 是这个站的可信 origin（宿主配置），写请求的 Origin 头要和它完全一样；不从 request.url 推导。
 * 开发与 start 端口不同时，经 DOCSITE_ORIGIN 环境变量给对的那一个
 */
export const siteOrigin = process.env.DOCSITE_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? 4430}`

export function siteIdentity() {
  return identityOf(sitePeople(), process.env[identityCodeEnvName])
}

/** 核对一次写入请求（Origin、身份、as），失败抛 WriteAccessError——路由用 writeAccessResponse 转成响应 */
export function authorizeCommentWrite(request: Request, form: FormData): Person {
  const as = form.get('as')
  return authorizeWrite(request, {
    identity: siteIdentity(),
    people: sitePeople(),
    // 表单里「本人」选项的 as 是空串：按约定省掉 as 再核对（authorizeWrite 不收空串）
    as: typeof as === 'string' && as !== '' ? as : undefined,
    origin: siteOrigin,
  })
}

export { writeAccessResponse }
