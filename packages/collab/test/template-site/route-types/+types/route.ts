import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'

/** 模板类型检查用：react-router typegen 给每个路由文件生成的 Route 里，转发文件用到的两项 */
export declare namespace Route {
  type LoaderArgs = LoaderFunctionArgs
  type ActionArgs = ActionFunctionArgs
}
