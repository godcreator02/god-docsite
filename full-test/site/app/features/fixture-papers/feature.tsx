import type { ReactNode } from 'react'
import { Link } from 'react-router'

/** 正文里引用一条：<FixturePaper id="…" />，平台的引用扫描按组件名与 id 认它 */
function FixturePaper({ id, children }: { id: string; children?: ReactNode }) {
  return (
    <Link to={`/fixture-papers/${id}`} data-fixture-paper={id}>
      {children ?? id}
    </Link>
  )
}

export const mdxComponents = { FixturePaper }
