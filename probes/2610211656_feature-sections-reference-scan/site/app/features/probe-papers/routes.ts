import { relative, type RouteConfig } from '@react-router/dev/routes'

const { route } = relative(import.meta.dirname)

export default [route('refs', './search.tsx'), route('refs/:id/:page?', './page.tsx')] satisfies RouteConfig
