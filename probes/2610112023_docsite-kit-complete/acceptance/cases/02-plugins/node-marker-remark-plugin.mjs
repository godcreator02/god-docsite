// Node-only 的 remark 插件样本：真的用 node:fs，浏览器环境导入它必然失败，
// 因此只有「编译期在 Node 里跑、浏览器经生成入口拿正文」的接线才能让它生效。
// 用法：在 source.config.ts 里只给 A 集合的 mdxOptions 挂上它，B 集合不挂。
import { readFileSync } from 'node:fs'

export const NODE_MARKER = 'A-COLLECTION-NODE-MARKER'

export function remarkNodeMarker() {
  return (tree) => {
    // 读一个真实文件，证明这一步只能发生在 Node 里
    const proof = JSON.parse(readFileSync(new URL('./package-proof.json', import.meta.url), 'utf8'))
    tree.children.push({
      type: 'paragraph',
      children: [{ type: 'text', value: `${NODE_MARKER} (proof: ${proof.name})` }],
    })
  }
}
