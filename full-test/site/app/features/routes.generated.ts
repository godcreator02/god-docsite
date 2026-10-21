// 建站器生成，勿手改：addFeature / regenerateFeatureIndex 每次都重写。功能清单是 app/features/ 下含 routes.ts、feature.tsx、mdx.ts、styles.css 或 site.server.ts 的子目录
import type { RouteConfigEntry } from '@react-router/dev/routes'
import * as collabRoutes from './collab/routes.ts'
import * as commentsRoutes from './comments/routes.ts'
import * as fixtureNotesRoutes from './fixture-notes/routes.ts'
import * as fixturePapersRoutes from './fixture-papers/routes.ts'
import * as identityRoutes from './identity/routes.ts'
import * as trajectoryRoutes from './trajectory/routes.ts'
import * as wordReportRoutes from './word-report/routes.ts'

/** 各功能 routes.ts 可以导出的：默认导出嵌在布局路由里，standaloneRoutes 在布局路由之外（占满窗口、不带侧栏） */
interface FeatureRoutesModule {
  default?: RouteConfigEntry[]
  standaloneRoutes?: RouteConfigEntry[]
}

const featureRoutesModules: FeatureRoutesModule[] = [collabRoutes, commentsRoutes, fixtureNotesRoutes, fixturePapersRoutes, identityRoutes, trajectoryRoutes, wordReportRoutes]

export const featureRoutes: RouteConfigEntry[] = featureRoutesModules.flatMap((routes) => routes.default ?? [])
export const featureStandaloneRoutes: RouteConfigEntry[] = featureRoutesModules.flatMap((routes) => routes.standaloneRoutes ?? [])
