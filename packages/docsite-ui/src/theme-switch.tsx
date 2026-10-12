import type { ComponentProps } from 'react'
import { ThemeSwitch } from '@fumadocs/base-ui/layouts/shared/slots/theme-switch'
import { IdentityBadge } from '@godcreator/docsite-identity/react'
import type { SiteIdentity } from '@godcreator/docsite-identity'
import { WidePageToggle } from './wide-page.js'

/**
 * 侧栏底部那一栏：左边显示本机身份（只读时写「只读」，鼠标停上去看原因）、右边是主题切换和全宽切换。
 * 身份标识来自身份包（identity 是服务端 siteIdentity() 的结果）
 */
export function themeSwitchWithIdentity(identity: SiteIdentity) {
  return function ThemeSwitchWithIdentity(props: ComponentProps<typeof ThemeSwitch>) {
    return (
      <>
        <IdentityBadge identity={identity} />
        <ThemeSwitch {...props} />
        <WidePageToggle />
      </>
    )
  }
}
