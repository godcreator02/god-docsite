import { relative, type RouteConfig } from '@react-router/dev/routes';

const { route } = relative(import.meta.dirname);

export const demoRoutes = [route('demo', './demo.tsx'), route('demo/events', './events.ts')] satisfies RouteConfig;
