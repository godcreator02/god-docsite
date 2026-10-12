import type { PaneArgs, PaneHandle } from '@godcreator/gwb-shell/pane'
import { createRoot } from 'react-dom/client'
import { ProjectsPane } from './ProjectsPane'

/** 外壳要求同步返回 { dispose }；本插件只有一个窗格 projects */
export function mountPane({ host, shell, pane }: PaneArgs, container: HTMLElement): PaneHandle {
  if (pane.id !== 'projects') throw new Error(`协作插件没有窗格 ${pane.id}`)
  const root = createRoot(container)
  root.render(<ProjectsPane host={host} shell={shell} />)
  return {
    dispose: () => {
      root.unmount()
      container.textContent = ''
    },
  }
}
