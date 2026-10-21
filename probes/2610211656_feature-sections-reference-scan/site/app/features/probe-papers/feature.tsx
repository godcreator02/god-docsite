import type { ReactNode } from 'react'
import { Link } from 'react-router'

function Ref({ id, page, children }: { id: string; page?: string; children?: ReactNode }) {
  return <Link to={`/refs/${id}${page === undefined ? '' : `/${page}`}`}>{children ?? id}</Link>
}

export const mdxComponents = { Ref }
