/**
 * E-7 重做：feeds 只在服务端读。`.server.ts` 后缀是 React Router 的服务端约定——浏览器端代码
 * import 它会在构建时报错，所以它不进客户端 bundle；feeds 文件变化时只有 loader 依赖的
 * 服务端模块失效，页面不再整页刷新。
 */
export function demoFeedMessage(): string {
  const entries = Object.entries(import.meta.glob('/feeds/*.json', { eager: true, import: 'default' }));
  const data = entries.find(([path]) => path.endsWith('/demo.json'))?.[1] as { message?: string } | undefined;
  return data?.message ?? '(missing)';
}
