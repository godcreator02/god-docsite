import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { normalizePath, type Plugin } from 'vite'
import { findDepPkgJsonPath } from 'vitefu'
import { dataDirsChangedEvent } from '../core/dev-events.js'

type PackageJson = Record<string, unknown>

/** 一批文件改动（git 拉进来、agent 连着写几个文件）攒到最后一个改动之后这么久，只让浏览器重新取一次数据 */
export const dataDirsChangeBatchMs = 300

/**
 * 功能包 package.json 里 "godDocsite": { "dataDirs": [...] }：功能的 loader 直接读、不经 Vite 模块的目录，相对站点根。
 * 没写就是没有；写了就要是字符串数组
 */
export function dataDirsDeclaredBy(packageName: string, packageJson: PackageJson): string[] {
  const declared = packageJson['godDocsite']
  if (declared === undefined) return []
  if (typeof declared !== 'object' || declared === null) throw new Error(`${packageName} 的 package.json 里 godDocsite 要是对象，收到 ${JSON.stringify(declared)}`)
  const dataDirs = (declared as Record<string, unknown>)['dataDirs']
  if (dataDirs === undefined) return []
  if (!Array.isArray(dataDirs) || !dataDirs.every((dir) => typeof dir === 'string' && dir !== '')) {
    throw new Error(`${packageName} 的 package.json 里 godDocsite.dataDirs 要是目录的数组（相对站点根），收到 ${JSON.stringify(dataDirs)}`)
  }
  return dataDirs as string[]
}

async function siteDependencyNamesOf(root: string): Promise<string[]> {
  const sitePackageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as PackageJson
  return [...new Set([...Object.keys((sitePackageJson['dependencies'] ?? {}) as object), ...Object.keys((sitePackageJson['devDependencies'] ?? {}) as object)])]
}

/** 站点直接依赖的包登记的数据目录，换成绝对路径 */
async function declaredDataDirsOf(root: string): Promise<string[]> {
  const dirs = await Promise.all(
    (await siteDependencyNamesOf(root)).map(async (name) => {
      const file = await findDepPkgJsonPath(name, root)
      if (file === undefined) return []
      return dataDirsDeclaredBy(name, JSON.parse(await readFile(file, 'utf8')) as PackageJson).map((dir) => normalizePath(path.resolve(root, dir)))
    }),
  )
  return [...new Set(dirs.flat())]
}

/** 最后一次调用之后过 delayMs 才运行 run；期间再调用就重新计时 */
export function batchedCalls(delayMs: number, run: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  return () => {
    clearTimeout(timer)
    timer = setTimeout(run, delayMs)
  }
}

/**
 * dev 下盯住功能包登记的数据目录（协作的任务记录、日志等），有文件增删改就经热更新连接通知浏览器重新取当前页的数据。
 * 这些目录由 loader 直接读，不在 Vite 的模块图里：不盯的话，站外改了（agent 调命令、git 同步进来）已打开的页面不会变
 */
export function refreshPagesOnDataDirChange(): Plugin {
  let dataDirs: string[] = []
  return {
    name: 'god-docsite:refresh-pages-on-data-dir-change',
    apply: 'serve',
    async configResolved(config) {
      dataDirs = await declaredDataDirsOf(config.root)
    },
    configureServer(server) {
      if (dataDirs.length === 0) return
      server.watcher.add(dataDirs)
      const notifyBrowsers = batchedCalls(dataDirsChangeBatchMs, () => server.ws.send({ type: 'custom', event: dataDirsChangedEvent }))
      server.watcher.on('all', (_event, file) => {
        const changed = normalizePath(file)
        if (dataDirs.some((dir) => changed === dir || changed.startsWith(`${dir}/`))) notifyBrowsers()
      })
    },
  }
}
