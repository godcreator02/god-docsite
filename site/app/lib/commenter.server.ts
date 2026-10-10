import { currentCommenter } from '@godcreator/docsite-kit/server'

/** 写评论的人：开发服务里是本机 git 的 user.name；发布出去的站（react-router-serve）只读，没有 */
export async function pageCommenter() {
  return import.meta.env.DEV ? await currentCommenter() : null
}
