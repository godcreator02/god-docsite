import { siteSearchServer } from '@godcreator/docsite-kit/server'
import { source } from '../lib/source'
import type { Route } from './+types/search'

/** 服务端实时搜：本机开发与发布都一样 */
const server = siteSearchServer(source)

export async function loader({ request }: Route.LoaderArgs) {
  return server.GET(request)
}
