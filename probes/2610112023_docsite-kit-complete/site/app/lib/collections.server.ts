import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { collectionA, collectionB } from '../../.source/server';

// 生成的 server 入口只被本文件（.server.ts 后缀）引用：它进服务端 bundle，
// 不进浏览器包；路由在 loader 里调用这里，把正文以 HTML 字符串交给页面。
export function renderedCollections() {
  return {
    a: renderToStaticMarkup(createElement(collectionA.docs[0].body)),
    b: renderToStaticMarkup(createElement(collectionB.docs[0].body)),
  };
}
