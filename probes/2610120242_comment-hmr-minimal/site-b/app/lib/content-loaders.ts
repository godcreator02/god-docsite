import browserCollections from '../../.source/browser';

/**
 * 数据模块：只导出入口表，不含组件。
 * .source/browser.ts 每次重新生成（评论增删）后，本模块跟着重新求值，
 * 组件模块（content-components.tsx）经 Fast Refresh 原位更新后拿到新的表。
 */
export const docsRaw = browserCollections.docs.raw;
export const commentsRaw = browserCollections.comments.raw;
