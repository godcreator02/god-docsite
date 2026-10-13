import type { FeatureSiteServer } from '@godcreator/docsite-kit/feature'
import { collabSiteData } from './server/index.server.js'

/** 协作数据（任务、模块、人员、通知、有日志的日子）放在整站布局里读：每一页都要用，RecordLink 也在内容页里 */
const siteServer: FeatureSiteServer = {
  layoutData: ({ pages }) => collabSiteData([...pages]),
}

export default siteServer
