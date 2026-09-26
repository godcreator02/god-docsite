import path from 'node:path'

/**
 * 单元容器根：建站选端口时要在整个容器根里查重，否则每个单元的第一个站都会选到同一个端口。
 * 容器根取自单元文件夹插件的设置 `unit-folder` / `units-root`。
 */

/**
 * 设置值 → 绝对路径（与 gwb-unit-folder 的判断一致）：不是字符串、去掉空白后是空的都算没配；
 * 相对路径当场 `path.resolve`。
 */
export function rootFromSetting(raw: unknown): string | undefined {
  const dir = typeof raw === 'string' ? raw.trim() : ''
  return dir === '' ? undefined : path.resolve(dir)
}

/** `dir` 在不在 `root` 之内（含根本身） */
export function isInside(root: string, dir: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(dir))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}
