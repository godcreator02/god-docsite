/// <reference types="@godcreator/docsite-kit/site-modules" />

/** 功能包模板复制进站点的 app/lib/journal.ts：日志页的集合，src/routes/ 里经别名 @site 读 */
declare module '@site/lib/journal' {
  import type { ComponentType } from 'react'
  type JournalEntry = {
    info: { path: string }
    load(): Promise<{ body: ComponentType<{ components?: Readonly<Record<string, ComponentType<any>>> }> }>
  }
  export const journal: { entries: JournalEntry[] }
}
