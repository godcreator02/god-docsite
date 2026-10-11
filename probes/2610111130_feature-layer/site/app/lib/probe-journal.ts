import { defineCollections } from 'fumadocs-mdx/macro'

/** 骨架的 collections.ts 以外的第二个集合文件：功能包叠加时复制进项目的那一类 */
export const probeJournal = defineCollections({ type: 'doc', dir: 'journal', async: true })
