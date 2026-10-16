import type { PaneArgs, PaneHandle } from '@godcreator/gwb-shell/pane'
import { createRoot } from 'react-dom/client'
import { SitesPane } from './SitesPane'

/** 外壳要求同步返回 { dispose }；本插件只有一个窗格 sites */
export function mountPane({ host, shell, pane }: PaneArgs, container: HTMLElement): PaneHandle {
  if (pane.id !== 'sites') throw new Error(`文档站插件没有窗格 ${pane.id}`)
  const root = createRoot(container)
  root.render(<SitesPane host={host} shell={shell} />)
  return {
    dispose: () => {
      root.unmount()
      container.textContent = ''
    },
  }
}
