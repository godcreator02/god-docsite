import path from 'node:path'

/**
 * 单元容器根：建站选端口时要在整个容器根里查重，否则每个单元的第一个站都会选到同一个端口。
 * 容器根由单元文件夹插件的服务 `gwbUnitFolder.unitsRoot()` 给出（它的设置 `units-root`）。
 */

/** `dir` 在不在 `root` 之内（含根本身） */
export function isInside(root: string, dir: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(dir))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}
