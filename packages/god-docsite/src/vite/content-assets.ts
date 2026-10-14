import path from 'node:path'
import type { Plugin } from 'vite'
import { copyContentAssetsToBuild } from '../node/content-files.js'

/**
 * build 收尾时把内容目录里可被 /api/content/ 服务的文件（HTML 页面与页面引用的图片、字体等）复制成客户端静态资产：
 * start 下这些地址由静态文件接管，正文、资源与构建时的标题、搜索索引来自同一份快照
 */
export function copyContentAssets(pageDir: string): Plugin {
  return {
    name: 'god-docsite:copy-content-assets',
    apply: 'build',
    async closeBundle() {
      if (this.environment.name !== 'client') return
      const { root, build } = this.environment.config
      const copied = await copyContentAssetsToBuild(path.resolve(root, pageDir), path.resolve(root, build.outDir))
      this.info(`${copied.length} 个内容文件复制进产物`)
    },
  }
}
