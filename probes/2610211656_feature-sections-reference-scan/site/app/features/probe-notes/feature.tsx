import type { ReactNode } from 'react'
import { Link } from 'react-router'

function Note({ id, page, children }: { id: string; page?: string; children?: ReactNode }) {
  return <Link to={`/notes/${id}${page === undefined ? '' : `/${page}`}`}>{children ?? id}</Link>
}

export const mdxComponents = { Note }
