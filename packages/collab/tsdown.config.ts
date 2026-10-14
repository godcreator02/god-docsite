import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'core/index': 'src/core/index.ts',
    'node/index': 'src/node/index.ts',
    'cli/bin': 'src/cli/bin.ts',
  },
  format: ['esm'],
  platform: 'node',
  dts: true,
  clean: true,
})
