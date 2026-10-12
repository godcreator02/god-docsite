// 自检的运行钩子：src 里的 import 按 tsc NodeNext 的规矩写 .js 后缀（编译产物是 .js），
// node 的类型剥离不重写扩展名，这里把找不到的 .js 说明符映射回同目录的 .ts 源文件。
// 只在自检时用 `node --import ./ts-extension-hooks.mjs selfcheck.ts` 加载，不参与包的构建。
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (specifier.startsWith('.') && specifier.endsWith('.js')) {
        const candidate = new URL(specifier.replace(/\.js$/, '.ts'), context.parentURL)
        if (existsSync(fileURLToPath(candidate))) return { url: candidate.href, shortCircuit: true }
      }
      throw error
    }
  },
})
