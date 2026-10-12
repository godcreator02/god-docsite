import { type RouteConfig, route } from '@react-router/dev/routes';

export default [
  route('page', 'routes/page.tsx'),
  route('docs/*', 'routes/docs.tsx'),
] satisfies RouteConfig;
