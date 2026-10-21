type PackageJson = Record<string, unknown>

/**
 * 功能包 package.json 里 "godDocsite": { "dataDirs": [...] }：功能的 loader 直接读、不经 Vite 模块的目录，相对站点根。
 * 没写就是没有；写了就要是字符串数组。vite 插件盯着它们刷新页面，建站器把它们写成 Tailwind 的 @source not
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

/** 站点 package.json 的 dependencies 与 devDependencies 里的包名，去重 */
export function siteDependencyNamesOf(sitePackageJson: PackageJson): string[] {
  const namesIn = (deps: unknown) => (typeof deps === 'object' && deps !== null ? Object.keys(deps) : [])
  return [...new Set([...namesIn(sitePackageJson['dependencies']), ...namesIn(sitePackageJson['devDependencies'])])]
}
