import type { Route } from './+types/file'
import { itemFileResponse } from './library.server'

/** 条目文件夹里的文件：正文里的图经它送出 */
export const loader = ({ request, params }: Route.LoaderArgs) => itemFileResponse(request, params.id, params['*'])
