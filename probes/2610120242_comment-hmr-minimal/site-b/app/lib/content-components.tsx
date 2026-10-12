import { use, useMemo, type ComponentType } from 'react';
import { commentsRaw, docsRaw } from './content-loaders';

/**
 * 纯组件模块：只导出 React 组件，这是 react-refresh 对它做「原位更新」（保子树状态）的前提。
 *
 * 为什么不用 createClientLoader().useContent：它的 Renderer 缓存在 createClientLoader
 * 调用的闭包里，模块重求值即换实例，Renderer 组件类型随之更换，所有正文子树被重挂
 * （B1/B2 实测：增删一条评论清空了未改动评论正文内的交互状态）。
 * 这里改用公开 raw 入口表 + React 原语（useMemo + use + Suspense 由调用方包）：
 * - 入口未到：raw[path] 为 undefined，渲染「准备中」占位（不 throw，不用错误边界吞时序）；
 * - 入口到了（原生 HMR 更新组件模块后原位重渲染）：自动脱离占位；
 * - 未改动评论的 MDX 模块未失效：import() 返回浏览器缓存的同一个已 resolve 的 promise，
 *   Doc 组件类型不变，正文子树（含其中的交互组件状态）保留。
 */
type MdxLoader = () => Promise<{ default: ComponentType }>;

/**
 * 入口查询：raw 的 key 在 default-target 下是集合相对路径（'a/index.mdx'），
 * vite-target（默认接线）的 import.meta.glob key 带 './' 前缀，两种形态都查。
 */
function entryOf(raw: Record<string, MdxLoader>, path: string): MdxLoader | undefined {
  return (raw[path] ?? raw[`./${path}`]) as MdxLoader | undefined;
}

export function DocsMdx({ path }: { path: string }) {
  const load = entryOf(docsRaw, path);
  if (!load) {
    return <p data-docs-pending>页面正文准备中（浏览器编译入口未到）</p>;
  }
  return <MdxDoc load={load} />;
}

export function CommentMdx({ path }: { path: string }) {
  const load = entryOf(commentsRaw, path);
  if (!load) {
    return (
      <p data-comment-pending data-pending-path={path}>
        正文准备中（浏览器编译入口未到）
      </p>
    );
  }
  return <MdxDoc load={load} />;
}

function MdxDoc({ load }: { load: MdxLoader }) {
  const promise = useMemo(() => load(), [load]);
  const Doc = use(promise).default;
  return <Doc />;
}
