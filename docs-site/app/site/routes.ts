// 初始化按 package.json 的 docsite.features 生成，不要手改
import type { FeatureRoutes } from '@godcreator/docsite-kit/feature'
import feature0 from '@godcreator/docfirst-site/routes'

export const featureRoutes: ReadonlyArray<{ name: string } & FeatureRoutes> = [{ name: '@godcreator/docfirst-site', ...feature0 }]
