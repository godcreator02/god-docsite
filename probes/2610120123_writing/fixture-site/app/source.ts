import { loader } from 'fumadocs-core/source'
import { docs, notes } from '../.source/server'

/**
 * 服务端集合入口（fumadocs-mdx 从 source.config.ts 生成）：两个集合各自一条 loader，
 * 不造多来源引擎。浏览器端的正文走 .source/browser（见各内容页路由），不经过这个文件
 */
export const docsSource = loader({ source: docs.toFumadocsSource(), baseUrl: '/docs' })

export const notesSource = loader({ source: notes.toFumadocsSource(), baseUrl: '/notes' })
