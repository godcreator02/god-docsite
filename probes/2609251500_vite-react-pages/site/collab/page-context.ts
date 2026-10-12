import { createContext, useContext } from 'react'
import type { SitePage } from './data'

export const CurrentPageContext = createContext<SitePage | null>(null)

export function useCurrentPage() {
  const page = useContext(CurrentPageContext)
  if (!page) throw new Error('useCurrentPage 只能在页面组件里用')
  return page
}
