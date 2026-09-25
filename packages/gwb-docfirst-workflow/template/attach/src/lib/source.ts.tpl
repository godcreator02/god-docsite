/**
 * 每个内容集合一个 loader，URL 前缀 /docs、/trajectory、/future。
 * .source/ 由 fumadocs-mdx 按 source.config.ts 生成（在 .gitignore 里）。
 */
import { loader } from 'fumadocs-core/source'
import { docs, future, trajectory } from '../../.source/server'

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
})

export const sourceTrajectory = loader({
  baseUrl: '/trajectory',
  source: trajectory.toFumadocsSource(),
})

export const sourceFuture = loader({
  baseUrl: '/future',
  source: future.toFumadocsSource(),
})
