import path from 'node:path'
import { siteOrigin } from '@godcreator/god-docsite/server'
import { siteIdentity, sitePeople } from '@godcreator/identity/node'
import { comments } from '../../.source/server'
import { source } from './source'

// react-router dev 与 react-router-serve 都在站点目录里启动
const dir = process.cwd()
const mode: 'dev' | 'start' = import.meta.env.DEV ? 'dev' : 'start'

/** 站点上下文：平台与功能包的 loader、action 经参数拿到它，它们自己不 import 站点代码 */
export const site = {
  dir,
  mode,
  source,
  contentDir: path.join(dir, 'content'),
  commentsDir: path.join(dir, 'comments'),
  commentEntries: comments,
  /** people.json 每次都重新读：改了不用重启。带身份码，只在服务端用；给浏览器的经 publicPeopleOf */
  people: () => sitePeople(dir),
  /** 本机身份：启动方经环境变量 DOCSITE_IDENTITY_CODE 给的码在 people.json 里认出的人，没有就只读 */
  identity: () => siteIdentity(dir),
  /** 写入请求的 Origin 头要和它一样：DOCSITE_ORIGIN，否则 dev 取 --host/--port、start 取 HOST/PORT */
  trustedOrigin: () => siteOrigin(mode),
}
