import type { Route } from './+types/demo';
import { demoAction, demoLoader } from 'demo-pages/site/server';
import { site } from '@/lib/site.server';

export const loader = (args: Route.LoaderArgs) => demoLoader(args, site);
export const action = (args: Route.ActionArgs) => demoAction(args, site);
export { DemoPage as default } from 'demo-pages/site';
