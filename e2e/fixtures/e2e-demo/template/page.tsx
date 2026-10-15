import type { Route } from './+types/page'
import { demoAction, demoLoader } from 'e2e-demo/site/server'
import { demoSite } from './site.server'

export const loader = (args: Route.LoaderArgs) => demoLoader(args, demoSite)
export const action = (args: Route.ActionArgs) => demoAction(args, demoSite)
export { DemoPage as default } from 'e2e-demo/site'
