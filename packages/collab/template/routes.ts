import { relative, type RouteConfig } from '@react-router/dev/routes'

const { route } = relative(import.meta.dirname)

// 地址与 @godcreator/collab 的 tasksPageUrl、calendarUrl、recordLinksApiUrl、repoLinksApiUrl、projectFileApiUrl 一致；
// 参数名 recordId、date、* 是 recordLoader、journalLoader、projectFileLoader 读的
export default [
  route('tasks', './tasks.tsx'),
  route('tasks/:recordId', './record.tsx'),
  route('calendar', './calendar.tsx'),
  route('calendar/:date', './journal.tsx'),
  route('api/record-links', './record-links.ts'),
  route('api/repo-links', './repo-links.ts'),
  route('api/project-file/*', './project-file.ts'),
] satisfies RouteConfig
