// 初始化按 package.json 的 docsite.features 生成，不要手改
import type { FeatureSiteServer } from '@godcreator/docsite-kit/feature'
import feature0 from '@godcreator/collab-site/site-server'

export const featureServers: ReadonlyArray<{ name: string } & FeatureSiteServer> = [{ name: '@godcreator/collab-site', ...feature0 }]
