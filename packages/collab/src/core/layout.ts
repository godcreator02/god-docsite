/** 项目仓的布局是固定的：任务与模块的记录在仓根的 collab/，站点在仓根的 site/，人员列表是站点的 site/people.json；都是相对仓根、用 / 分隔的路径 */
export const collabPathInRepo = 'collab'
export const sitePathInRepo = 'site'
export const peoplePathInRepo = 'site/people.json'

/** 网站自带的任务页的地址：任务与模块自己那一页是 /tasks/<记录 id> */
export const tasksPageUrl = '/tasks'

export function recordPageUrlOf(recordId: string): string {
  return `${tasksPageUrl}/${recordId}`
}

/** 项目日历；某一天（YYYY-MM-DD）的日志页在它下面 */
export const calendarUrl = '/calendar'

export function journalUrlOf(date: string): string {
  return `${calendarUrl}/${date}`
}

/** 正文里的记录链接、日志链接取显示数据的资源路由：GET ?id=<记录 id>（可写多个） */
export const recordLinksApiUrl = '/api/record-links'
