import { relative, type RouteConfig } from '@react-router/dev/routes'
import { trajectoryHrefBase } from './href.ts'

const { route } = relative(import.meta.dirname)
const path = trajectoryHrefBase.slice(1)

export default [route(path, './disk.tsx'), route(`${path}/*`, './card.tsx')] satisfies RouteConfig
