import { statSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertAvatarImage, avatarFileInSite, AvatarRejected, avatarUrlOf, type AvatarWriteResult } from '../core/avatar.js'
import type { SiteIdentity } from '../core/identity.js'
import type { Person } from '../core/people.js'
import { publicPeopleOf, type PublicPerson } from '../core/public-people.js'
import { authorizeWrite, WriteAccessError } from '../core/write-access.js'

/** 这个人的头像地址；站点里没有他的头像文件为 undefined */
export function siteAvatarUrlOf(siteDir: string, personId: string): string | undefined {
  const stats = statSync(path.join(siteDir, avatarFileInSite(personId)), { throwIfNoEntry: false })
  return stats === undefined ? undefined : avatarUrlOf(personId, stats.mtimeMs)
}

/** 交给浏览器的人员列表，有头像文件的人带上头像地址：布局 loader 交给 IdentityProvider 的就是它 */
export function publicPeopleWithAvatars(siteDir: string, people: readonly Person[]): PublicPerson[] {
  return publicPeopleOf(people).map((person) => {
    const avatar = siteAvatarUrlOf(siteDir, person.id)
    return avatar === undefined ? person : { ...person, avatar }
  })
}

export type AvatarWriteOptions = {
  request: Request
  siteDir: string
  people: readonly Person[]
  identity: SiteIdentity<Person>
  /** 站点的可信 origin，请求的 Origin 头要和它完全一样 */
  trustedOrigin: string
}

const textResponse = (status: number, message: string) => new Response(`${message}\n`, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })

async function writeAvatar(siteDir: string, personId: string, request: Request): Promise<AvatarWriteResult> {
  const bytes = new Uint8Array(await request.arrayBuffer())
  assertAvatarImage(request.headers.get('content-type'), bytes)
  const file = path.join(siteDir, avatarFileInSite(personId))
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, bytes)
  return { avatar: siteAvatarUrlOf(siteDir, personId)! }
}

async function removeAvatar(siteDir: string, personId: string): Promise<AvatarWriteResult> {
  const file = path.join(siteDir, avatarFileInSite(personId))
  if (statSync(file, { throwIfNoEntry: false }) === undefined) throw new AvatarRejected(404, `${personId} 没有头像（${avatarFileInSite(personId)} 不在）`)
  await rm(file)
  return { avatar: null }
}

/**
 * 头像写入路由（avatarWriteUrl）的处理：PUT 把正文存成本机身份那个人的头像，DELETE 删掉它，只能改自己的。
 * 核对 Origin 与本机身份（authorizeWrite，没有 as：agent 的头像由人直接放文件再提交）；图片按 assertAvatarImage 核对，不合格直接拒绝
 */
export async function handleAvatarWrite({ request, siteDir, people, identity, trustedOrigin }: AvatarWriteOptions): Promise<Response> {
  try {
    if (request.method !== 'PUT' && request.method !== 'DELETE') return textResponse(405, `头像只收 PUT（上传）与 DELETE（删掉）：收到 ${request.method}`)
    const person = authorizeWrite(request, { identity, people, origin: trustedOrigin })
    const result = request.method === 'PUT' ? await writeAvatar(siteDir, person.id, request) : await removeAvatar(siteDir, person.id)
    return Response.json(result satisfies AvatarWriteResult)
  } catch (error) {
    if (error instanceof WriteAccessError || error instanceof AvatarRejected) return textResponse(error.status, error.message)
    throw error
  }
}
