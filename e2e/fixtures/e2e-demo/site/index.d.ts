import type { ReactElement } from 'react'

export declare function DemoPage(): ReactElement
export declare function DemoFullPage(): ReactElement
export declare function DemoCounter(props: { label?: string }): ReactElement
export declare function DemoLayoutTop(): ReactElement

export interface DemoTreeRoot {
  children: unknown[]
}
export declare function demoPageTreePlugin(link: { name: string; url: string }): {
  name: string
  transformPageTree: { root<Root extends DemoTreeRoot>(root: Root): Root }
}

/** browserCollection：站点 .source/browser 里这个集合的条目（有 createClientLoader） */
export declare function createNotePage(browserCollection: unknown): () => ReactElement
