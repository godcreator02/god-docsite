import { relative, type RouteConfig } from '@react-router/dev/routes'

const { route } = relative(import.meta.dirname)

export default [route('notes', './search.tsx'), route('notes/:id/:page?', './page.tsx')] satisfies RouteConfig
