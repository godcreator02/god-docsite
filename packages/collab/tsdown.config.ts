import { defineConfig } from 'tsdown'

// site 进浏览器，只从 core 取东西；node/ 只经 node、site/server 与命令行出去；mdx 是构建期入口，不碰 react。
// 服务端入口的产物名以 .server.mjs 结尾，React Router 的 .server 检查才认得出它
export default defineConfig({
  entry: {
    'core/index': 'src/core/index.ts',
    'node/index': 'src/node/index.ts',
    'mdx/index': 'src/mdx/index.ts',
    'site/index': 'src/site/index.ts',
    'site/index.server': 'src/site/index.server.ts',
    'cli/bin': 'src/cli/bin.ts',
  },
  format: ['esm'],
  platform: 'node',
  dts: true,
  clean: true,
})
