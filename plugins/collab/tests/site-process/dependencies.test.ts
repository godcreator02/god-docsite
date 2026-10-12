import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { installSiteDependencies, pnpmInstall, type InstallDependencies, type SiteControl } from '../../src/site-process/dependencies.js'
import { CollabRejected } from '../../src/errors.js'
import type { Project } from '../../src/project/project.js'

const project: Project = { repo: 'D:/projects/hybrid-mmc/collab', collabDir: 'D:/projects/hybrid-mmc/collab/collab', siteDir: 'D:/projects/hybrid-mmc/collab/site', person: 'bob' }

/** 假的站点进程：只记下停了哪个、启动了哪个；relaunch 是装完之后常驻的规矩要不要启动 */
function fakeSites(running: boolean, relaunch = running) {
  const steps: string[] = []
  const sites: Pick<SiteControl, 'whileStopped'> = {
    whileStopped: async (each, work) => {
      if (running) steps.push(`stop ${each.repo}`)
      const result = await work(running)
      if (relaunch) steps.push(`launch ${each.repo}`)
      return { result, relaunched: relaunch }
    },
  }
  return { sites, steps }
}

function recordingInstall(steps: string[], outcome: 'ok' | 'fail'): InstallDependencies {
  return async (siteDir) => {
    steps.push(`install ${siteDir}`)
    if (outcome === 'fail') throw new CollabRejected('在 site/ 里运行 pnpm install 失败（退出码 1）：\nERR_PNPM_FETCH_404')
    return { outputTail: 'Done in 1.2s' }
  }
}

describe('装 site/ 的依赖', () => {
  it('站点没在运行：只装依赖', async () => {
    const { sites, steps } = fakeSites(false)
    expect(await installSiteDependencies(project, sites, recordingInstall(steps, 'ok'))).toEqual({ outputTail: 'Done in 1.2s', siteRestarted: false })
    expect(steps).toEqual([`install ${project.siteDir}`])
  })

  it('站点正由本插件运行：先停、装完再启动', async () => {
    const { sites, steps } = fakeSites(true)
    expect(await installSiteDependencies(project, sites, recordingInstall(steps, 'ok'))).toEqual({ outputTail: 'Done in 1.2s', siteRestarted: true })
    expect(steps).toEqual([`stop ${project.repo}`, `install ${project.siteDir}`, `launch ${project.repo}`])
  })

  it('站点没在运行、按常驻的规矩装完要启动（克隆完第一次装依赖）：装完启动', async () => {
    const { sites, steps } = fakeSites(false, true)
    expect(await installSiteDependencies(project, sites, recordingInstall(steps, 'ok'))).toEqual({ outputTail: 'Done in 1.2s', siteRestarted: true })
    expect(steps).toEqual([`install ${project.siteDir}`, `launch ${project.repo}`])
  })

  it('pnpm 失败：报错带 pnpm 原话，写明站点已停、没有重新启动', async () => {
    const { sites, steps } = fakeSites(true)
    await expect(installSiteDependencies(project, sites, recordingInstall(steps, 'fail'))).rejects.toThrow(/ERR_PNPM_FETCH_404[\s\S]*站点已经停了，没有重新启动/)
    expect(steps).toEqual([`stop ${project.repo}`, `install ${project.siteDir}`])
  })
})

describe('pnpm install', () => {
  it('site/ 下没有 package.json：拒绝，不运行 pnpm', async () => {
    const siteDir = mkdtempSync(path.join(tmpdir(), 'gwb-collab-deps-'))
    await expect(pnpmInstall(siteDir)).rejects.toThrow(/没有 package\.json/)
  })

  it('没有依赖的 package.json：装完回 pnpm 输出的最后几行', async () => {
    const siteDir = path.join(mkdtempSync(path.join(tmpdir(), 'gwb-collab-deps-')), 'site')
    mkdirSync(siteDir)
    writeFileSync(path.join(siteDir, 'package.json'), '{"name":"site","private":true}\n')
    const installed = await pnpmInstall(siteDir)
    expect(typeof installed.outputTail).toBe('string')
  }, 60_000)

  it('pnpm 失败：原话报出来', async () => {
    const siteDir = path.join(mkdtempSync(path.join(tmpdir(), 'gwb-collab-deps-')), 'site')
    mkdirSync(siteDir)
    writeFileSync(path.join(siteDir, 'package.json'), '{ 这不是 JSON')
    await expect(pnpmInstall(siteDir)).rejects.toThrow(/pnpm install 失败（退出码 \d+）/)
  }, 60_000)
})
