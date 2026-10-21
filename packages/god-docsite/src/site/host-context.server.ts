import { hostChannel, type HostContext } from '../core/host-context.js'
import { siteFeedValue } from './feed.server.js'

/**
 * 托管方（gwb-docsite）推进频道 host 的上下文，没推过是 null（手动 pnpm dev、发布版、测试站）。
 * 推送时已经核对过，这里直接取用
 */
export function siteHostContext(): HostContext | null {
  return siteFeedValue<HostContext>(hostChannel) ?? null
}

/** 托管方提供的本机目录，名字到绝对路径：只有个人站收得到；没推过上下文或是 shared 站就是没有 */
export function siteProvidedDirs(): Readonly<Record<string, string>> {
  return siteHostContext()?.dirs ?? {}
}
