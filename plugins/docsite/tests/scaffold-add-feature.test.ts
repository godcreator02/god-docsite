import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addSiteFeature, type AddSiteFeatureDeps } from '../src/scaffold/add-feature.js'
import { createDocsite } from '../src/scaffold/create.js'
import { loadPlatformScaffold } from '../src/scaffold/platform.js'
import { fakeHomePageCheck, fakePnpm, longTempDir, pluginDir, readJson, repoDir } from './site-fixtures.js'

let root: string
let siteDir: string

const linkOf = (unscoped: string) => `link:${path.join(repoDir, 'packages', unscoped).replaceAll('\\', '/')}`

beforeEach(async () => {
  root = longTempDir('gwb-docsite-feature-')
  siteDir = path.join(root, 'site')
  const events: string[] = []
  await createDocsite(siteDir, { title: '新站' }, { ...fakeHomePageCheck(events), scaffold: () => loadPlatformScaffold(), packageSource: { kind: 'link', repoDir }, pnpm: fakePnpm(events) })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function depsWith(events: string[], options: { running?: boolean } = {}): AddSiteFeatureDeps {
  return { ...fakeHomePageCheck(events), scaffold: () => loadPlatformScaffold(), pnpm: fakePnpm(events), isRunning: () => options.running ?? false, versionsFrom: pluginDir }
}

describe('addSiteFeature：给已有站点加功能', () => {
  it('pnpm add 功能包、补 app/features/<功能名>/、重写汇总文件、起服务检查', async () => {
    const events: string[] = []
    const added = await addSiteFeature(siteDir, { packageName: '@godcreator/trajectory', specifier: linkOf('trajectory') }, depsWith(events))
    expect(events).toEqual([`pnpm add @godcreator/trajectory@${linkOf('trajectory')}`, 'start', 'page-status', 'stop'])
    expect(added.feature).toBe('trajectory')
    expect(added.specifier).toBe(linkOf('trajectory'))
    expect(added.addedFiles).toContain('routes.ts')
    expect(added.keptFiles).toEqual([])
    expect(added.features).toEqual(['comments', 'trajectory'])
    expect(readFileSync(path.join(siteDir, 'app', 'features', 'routes.generated.ts'), 'utf8')).toContain("from './trajectory/routes.ts'")
    expect(readFileSync(path.join(siteDir, 'app', 'features', 'collections.generated.ts'), 'utf8')).toContain('export const trajectory')
  })

  it('重复运行只补缺的：站点改过的文件留着', async () => {
    const events: string[] = []
    await addSiteFeature(siteDir, { packageName: '@godcreator/code-pin', specifier: linkOf('code-pin') }, depsWith(events))
    const styles = path.join(siteDir, 'app', 'features', 'code-pin', 'styles.css')
    writeFileSync(styles, '/* 站点改过 */\n')
    rmSync(path.join(siteDir, 'app', 'features', 'code-pin', 'mdx.ts'))
    const again = await addSiteFeature(siteDir, { packageName: '@godcreator/code-pin', specifier: linkOf('code-pin') }, depsWith([]))
    expect(again.addedFiles).toEqual(['mdx.ts'])
    expect(again.keptFiles).toEqual(['styles.css'])
    expect(readFileSync(styles, 'utf8')).toBe('/* 站点改过 */\n')
  })

  it('不给依赖说明：取插件旁边装着的那一版写 ^<版本>；插件没装就拒绝', async () => {
    const events: string[] = []
    const version = readJson(path.join(repoDir, 'packages', 'identity', 'package.json'))['version'] as string
    await expect(addSiteFeature(siteDir, { packageName: '@godcreator/identity' }, depsWith(events))).rejects.toThrow('@godcreator/identity 已经装进站点，补功能文件时出错')
    expect(events).toEqual([`pnpm add @godcreator/identity@^${version}`])
    await expect(addSiteFeature(siteDir, { packageName: '@godcreator/collab' }, depsWith([]))).rejects.toThrow('gwb-docsite 旁边没装 @godcreator/collab，不知道该装哪一版：给 version')
  })

  it('站点在运行、包名或依赖说明不对：拒绝，不跑 pnpm', async () => {
    const events: string[] = []
    await expect(addSiteFeature(siteDir, { packageName: '@godcreator/trajectory', specifier: '^0.1.0' }, depsWith(events, { running: true }))).rejects.toThrow('站点在运行：先 docsite.site.stop')
    await expect(addSiteFeature(siteDir, { packageName: 'Bad Name', specifier: '^0.1.0' }, depsWith(events))).rejects.toThrow('不是 npm 包名')
    for (const specifier of ['latest', '^0.1', 'link:../relative', 'file:C:/a b/x.tgz', '^0.1.0 && calc']) {
      await expect(addSiteFeature(siteDir, { packageName: '@godcreator/trajectory', specifier }, depsWith(events))).rejects.toThrow('认不出')
    }
    expect(events).toEqual([])
    expect(existsSync(path.join(siteDir, 'app', 'features', 'trajectory'))).toBe(false)
  })
})
