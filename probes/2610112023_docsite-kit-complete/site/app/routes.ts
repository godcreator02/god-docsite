import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('second', 'routes/second.tsx'),
  route('comments-demo', 'routes/comments-demo.tsx'),
  route('comments', 'routes/comments.tsx'),
  route('api/comments', 'routes/api-comments.ts'),
] satisfies RouteConfig;
