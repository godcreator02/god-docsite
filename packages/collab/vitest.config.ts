import path from 'node:path'
import { defineConfig } from 'vitest/config'

const src = (file: string) => path.resolve(import.meta.dirname, 'src', file)

export default defineConfig({
  // template/ 里的文件按包名 import 本包：测试里指到源码，不依赖先构建出 dist
  resolve: {
    alias: [
      { find: /^@godcreator\/collab$/, replacement: src('core/index.ts') },
      { find: /^@godcreator\/collab\/mdx$/, replacement: src('mdx/index.ts') },
      { find: /^@godcreator\/collab\/site$/, replacement: src('site/index.ts') },
      { find: /^@godcreator\/collab\/site\/server$/, replacement: src('site/index.server.ts') },
    ],
  },
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
  },
})
