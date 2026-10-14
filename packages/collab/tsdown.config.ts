import { defineConfig } from 'tsdown'

// site 进浏览器，只从 core 取东西；node/ 只经 node、site/server 与命令行出去
export default defineConfig({
  entry: {
    'core/index': 'src/core/index.ts',
    'node/index': 'src/node/index.ts',
    'site/index': 'src/site/index.ts',
    'site/server': 'src/site/index.server.ts',
    'cli/bin': 'src/cli/bin.ts',
  },
  format: ['esm'],
  platform: 'node',
  dts: true,
  clean: true,
})
