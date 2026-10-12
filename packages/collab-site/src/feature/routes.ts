import type { FeatureRoutes } from '@godcreator/docsite-kit/feature'

/** 协作站的路由，路由模块在包里的 dist/routes/；首页跳到任务页。任务页、任务与模块各自那一页、日志页能批评论 */
const routes: FeatureRoutes = {
  routes: [
    { path: 'api/collab', file: 'dist/routes/collab.js', layout: false },
    { path: 'api/repo-links', file: 'dist/routes/repo-links.js', layout: false },
    { path: 'api/project-file/*', file: 'dist/routes/project-file.js', layout: false },
    { index: true, file: 'dist/routes/home.js' },
    { path: 'tasks', file: 'dist/routes/tasks.js', comments: true },
    { path: 'tasks/:recordId', file: 'dist/routes/record.js', comments: true },
    { path: 'calendar', file: 'dist/routes/calendar.js' },
    { path: 'calendar/:date', file: 'dist/routes/journal.js', comments: true },
  ],
}

export default routes
