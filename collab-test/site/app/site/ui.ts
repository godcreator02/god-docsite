// 初始化按 package.json 的 docsite.features 生成，不要手改
import type { FeatureSite } from '@godcreator/docsite-kit/feature'
import feature0 from '@godcreator/collab-site/site'

export const featureSites: ReadonlyArray<{ name: string } & FeatureSite> = [{ name: '@godcreator/collab-site', ...feature0 }]
