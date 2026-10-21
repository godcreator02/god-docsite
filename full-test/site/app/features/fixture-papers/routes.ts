import { relative, type RouteConfig } from '@react-router/dev/routes'

const { route } = relative(import.meta.dirname)

/** 检索页、条目的各页（外部 mdx）、条目文件夹里的文件（正文里的图）；都在整站布局里 */
export default [
  route('fixture-papers', './search.tsx'),
  route('fixture-papers/:id/:page?', './page.tsx'),
  route('fixture-papers-files/:id/*', './file.ts'),
] satisfies RouteConfig
