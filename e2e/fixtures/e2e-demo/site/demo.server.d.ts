/** 演示功能的上下文：站点 app/features/e2e-demo/site.server.ts 从基础站点上下文组装 */
export interface DemoSite {
  counterFile: string
  notes: ReadonlyArray<{ info: { path: string }; title?: string }>
}

export declare function demoLoader(args: unknown, site: DemoSite): { count: number }
export declare function demoAction(args: { request: Request }, site: DemoSite): Promise<{ count: number }>
export declare function noteLoader(args: { params: Record<string, string | undefined> }, site: DemoSite): { path: string; title: string }
