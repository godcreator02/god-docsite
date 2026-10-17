import type { Route } from './+types/avatar'
import { handleAvatarWrite } from '@godcreator/identity/node'
import { site } from '@/lib/site.server'

/** 上传（PUT）或删掉（DELETE）本机身份的头像，存在站点的 public/avatars/<人员 id>.webp */
export async function action({ request }: Route.ActionArgs) {
  return handleAvatarWrite({ request, siteDir: site.dir, people: site.people(), identity: site.identity(), trustedOrigin: site.trustedOrigin() })
}
