import type { LoaderPlugin } from 'fumadocs-core/source'
import { trajectoryHrefBase } from './href'

/**
 * 侧栏根部末尾的「星轨盘」入口。
 * 不用 god-docsite/server 的 pageTreeLinksPlugin：本文件也被进浏览器的汇总文件 import，这里不能 import .server 模块
 */
export const pageTreePlugins: LoaderPlugin[] = [
  {
    name: 'trajectory:disk-link',
    transformPageTree: {
      root(root) {
        root.children.push({ type: 'page', name: '星轨盘', url: trajectoryHrefBase, $id: 'trajectory:disk-link' })
        return root
      },
    },
  },
]
