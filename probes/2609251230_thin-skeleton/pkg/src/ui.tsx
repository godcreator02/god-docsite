'use client'
import { useState } from 'react'
import { useTreeContext } from 'fumadocs-ui/contexts/tree'

export function TreeProbe() {
  const [clicks, setClicks] = useState(0)
  const { full } = useTreeContext()
  return (
    <button
      type="button"
      data-probe="tree"
      className="rounded-md bg-emerald-600 px-3 py-1 text-white"
      onClick={() => setClicks(clicks + 1)}
    >
      tree:{String(full.name)} clicks:{clicks}
    </button>
  )
}
