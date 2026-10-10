import { useState } from 'react'

const headings = [
  { level: 2, text: '二级标题' },
  { level: 3, text: '三级标题' },
  { level: 4, text: '四级标题' },
]

export function IndentPreview() {
  const [indentPerLevel, setIndentPerLevel] = useState(12)
  return (
    <div className="not-prose rounded-lg border p-3 text-sm">
      <label className="flex items-center gap-2 text-xs text-fd-muted-foreground">
        每级缩进 {indentPerLevel}px
        <input type="range" min={0} max={24} value={indentPerLevel} onChange={(event) => setIndentPerLevel(Number(event.target.value))} />
      </label>
      <ul className="mt-2 space-y-1">
        {headings.map((heading) => (
          <li key={heading.level} style={{ paddingInlineStart: (heading.level - 2) * indentPerLevel }}>
            {heading.text}
          </li>
        ))}
      </ul>
    </div>
  )
}
