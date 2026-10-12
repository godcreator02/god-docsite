import type { ReactNode } from 'react'

export function LocalBox({ children }: { children?: ReactNode }) {
  return (
    <div data-probe="local" className="border-4 border-rose-500 p-2">
      {children}
    </div>
  )
}
