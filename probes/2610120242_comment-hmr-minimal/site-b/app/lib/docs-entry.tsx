import browserCollections from '../../.source/browser';

/**
 * docs 正文的官方 client loader 入口（createClientLoader / useContent）：
 * N 线（2610120120_fumadocs-native）与 B1/B2 实测「MDX 引用本地 TSX 组件」在此形态下
 * 浏览器渲染正常。渲染前由调用方用公开 raw 预查入口，未到先显示占位（不 throw）。
 *
 * 已知代价（C 线实测）：模块重求值后本实例更换，内部 Renderer 类型随之更换，
 * 已打开正文的子树（含其中的交互组件状态）会重挂。自写 use().default 渲染可避免它，
 * 但在当前版本组合（fumadocs-mdx 15.4.7 + RR 8.4.0 + React 19.3）触发
 * 「An unknown Component is an async Client Component」错误，两种形态的差异见 docs-add-result.md。
 */
export const docsContent = browserCollections.docs.createClientLoader({
  component({ default: MDX }) {
    return <MDX />;
  },
});
