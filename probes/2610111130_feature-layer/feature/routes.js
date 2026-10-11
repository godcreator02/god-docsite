/**
 * 功能包交给站点 routes.ts 展开的路由。file 相对站点的 app/：
 * 前两条的路由模块放在包里（经 node_modules 找到），第三条放在项目里（功能包叠加时复制进去的文件）
 */
export const featureRoutes = [
  { path: 'probe/in-package', file: '../node_modules/@probe/feature/pages/in-package.js' },
  { path: 'probe/via-alias', file: '../node_modules/@probe/feature/pages/via-alias.js' },
  { path: 'probe/journal/:date', file: 'routes/probe-journal.tsx' },
]

/** 内容页不能占用的第一段地址 */
export const featureReservedSlugs = ['probe']
