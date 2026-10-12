// 初始化按 package.json 的 docsite.features 生成，不要手改
import type { FeatureContent } from '@godcreator/docsite-kit/feature'
import feature0 from '@godcreator/docfirst-site/content'

export const featureContents: ReadonlyArray<{ name: string } & FeatureContent> = [{ name: '@godcreator/docfirst-site', ...feature0 }]
