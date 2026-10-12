// 本站测试的 vitest 配置：root 是站目录（绝对路径，避免相对解析歧义）；
// vitest 二进制用仓里已有的（见各测试文件头注释），本站不新增依赖
import { fileURLToPath } from 'node:url'

export default {
  root: fileURLToPath(new URL('..', import.meta.url)),
  test: { include: ['test/*.test.ts'], testTimeout: 30000, hookTimeout: 30000 },
}
