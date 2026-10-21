// 建站器生成，勿手改：addFeature / regenerateFeatureIndex 每次都重写。功能清单是 app/features/ 下含 routes.ts、feature.tsx、mdx.ts、styles.css 或 site.server.ts 的子目录
import type { FeatureSections } from '@godcreator/god-docsite/server'
import * as fixtureNotesServer from './fixture-notes/site.server.ts'
import * as fixturePapersServer from './fixture-papers/site.server.ts'

/** 各功能 site.server.ts 导出的 sections：布局路由的 loader 每次请求调一遍，并进侧栏 */
export const featureSections: FeatureSections[] = [{ feature: 'fixture-notes', sections: fixtureNotesServer.sections }, { feature: 'fixture-papers', sections: fixturePapersServer.sections }]
