/** 站点 source.config.ts 里集合的目录：内容目录（docs 集合）与全部集合的目录 */
export interface CollectionDirs {
  /** 全部集合（docs、doc、meta）的目录，相对站点根 */
  all: string[]
  /** docs 集合的目录：页面所在的内容目录，TSX、HTML 页面与它们引用的文件也在这里 */
  pages: string
}

const collectionTypes = ['docs', 'doc', 'meta']

function dirsOf(name: string, dir: unknown): string[] {
  if (typeof dir === 'string') return [dir]
  if (Array.isArray(dir) && dir.every((each) => typeof each === 'string')) return dir as string[]
  throw new Error(`source.config.ts 的集合 ${name} 的 dir 要是字符串或字符串数组，收到 ${JSON.stringify(dir)}`)
}

/**
 * 从 source.config.ts 的全部导出里认出集合（defineDocs、defineCollections 的结果，带 type 与 dir），取出目录。
 * 要有且只有一个 docs 集合：它的目录是页面的内容目录
 */
export function collectionDirsOf(exports: Record<string, unknown>): CollectionDirs {
  const collections = Object.entries(exports).filter(
    (entry): entry is [string, { type: string; dir: unknown }] =>
      entry[0] !== 'default' && typeof entry[1] === 'object' && entry[1] !== null && collectionTypes.includes((entry[1] as { type?: unknown }).type as string),
  )
  if (collections.length === 0) throw new Error('source.config.ts 里没有集合：godDocsite({ collections }) 要传 import * as collections from "./source.config"')
  const docs = collections.filter(([, collection]) => collection.type === 'docs')
  if (docs.length !== 1) throw new Error(`source.config.ts 要有且只有一个 defineDocs 集合（页面的内容目录），现在有 ${docs.length} 个`)
  const [docsName, docsCollection] = docs[0]!
  const pageDirs = dirsOf(docsName, docsCollection.dir)
  if (pageDirs.length !== 1) throw new Error(`docs 集合 ${docsName} 只能有一个目录，收到 ${JSON.stringify(pageDirs)}`)
  return { all: [...new Set(collections.flatMap(([name, collection]) => dirsOf(name, collection.dir)))], pages: pageDirs[0]! }
}
