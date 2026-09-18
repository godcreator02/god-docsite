import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { registerSelfReportGuard } from '@godcreator/gwb-repo-kit'

/**
 * 自述防漏——正本住 @godcreator/gwb-repo-kit，这儿只是挂号薄壳。
 * docsDir 必须显式给：守卫默认按 `<包根>/docs-site/content/docs` 找站现状区，本仓的站在**仓根**（包在
 * `packages/` 下，三层往上），默认那格指不到，第四条「源码 inject 的服务名站现状区里都写了」会静默空跑。
 */
const here = path.dirname(fileURLToPath(import.meta.url))
registerSelfReportGuard(
  { describe, it, expect },
  { root: path.resolve(here, '..'), docsDir: path.resolve(here, '../../../docs-site/content/docs') },
)
