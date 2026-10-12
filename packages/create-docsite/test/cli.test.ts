import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createMarkerFileName } from '../src/plan.ts'
import { fileHashesUnder, makeTempRoot, writeSampleTemplate } from './helpers.ts'

const cliPath = fileURLToPath(new URL('../src/cli.ts', import.meta.url))

function runCli(args: readonly string[]) {
  return spawnSync(process.execPath, [cliPath, ...args], { encoding: 'utf8' })
}

let root: string
beforeEach(() => {
  root = makeTempRoot('cli')
})
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('CLI', () => {
  it('成功：退出码 0，打印新建与保留计数，站点文件真实存在', () => {
    const templateDir = path.join(root, 'template')
    const siteDir = path.join(root, 'site')
    writeSampleTemplate(templateDir)
    fs.mkdirSync(siteDir, { recursive: true })
    fs.writeFileSync(path.join(siteDir, 'people.json'), '{"people":[]}\n')

    const run = runCli(['--dir', siteDir, '--template', templateDir])

    expect(run.status).toBe(0)
    expect(run.stderr).toBe('')
    expect(run.stdout).toMatch(/已创建站点/)
    expect(run.stdout).toMatch(/新建文件 9 个/)
    expect(run.stdout).toMatch(/保留目标里已有的 1 个/)
    expect(run.stdout).toMatch(/people\.json/)
    expect(fs.existsSync(path.join(siteDir, 'app', 'routes', 'page.tsx'))).toBe(true)
    expect(fs.existsSync(path.join(siteDir, createMarkerFileName))).toBe(true)
  })

  it('拒绝已有站点：退出码 1，报错进 stderr', () => {
    const templateDir = path.join(root, 'template')
    const siteDir = path.join(root, 'site')
    writeSampleTemplate(templateDir)
    fs.mkdirSync(siteDir, { recursive: true })
    fs.writeFileSync(path.join(siteDir, createMarkerFileName), '{}\n')

    const run = runCli(['--dir', siteDir, '--template', templateDir])

    expect(run.status).toBe(1)
    expect(run.stderr).toMatch(/已经是站点/)
  })

  it('冲突：退出码 1，stderr 逐条列出冲突文件', () => {
    const templateDir = path.join(root, 'template')
    const siteDir = path.join(root, 'site')
    writeSampleTemplate(templateDir)
    fs.mkdirSync(siteDir, { recursive: true })
    fs.writeFileSync(path.join(siteDir, 'vite.config.ts'), '用户的\n')
    const hashesBefore = fileHashesUnder(siteDir)

    const run = runCli(['--dir', siteDir, '--template', templateDir])

    expect(run.status).toBe(1)
    expect(run.stderr).toMatch(/vite\.config\.ts/)
    expect(fileHashesUnder(siteDir)).toEqual(hashesBefore)
  })

  it('缺参数：退出码 2，打印用法', () => {
    const run = runCli(['--dir', path.join(root, 'site')])
    expect(run.status).toBe(2)
    expect(run.stderr).toMatch(/用法/)
    expect(run.stderr).toMatch(/缺少 --template/)
  })

  it('未知参数：退出码 2，点名不认识的参数', () => {
    const run = runCli(['--dir', 'x', '--template', 'y', '--verbose'])
    expect(run.status).toBe(2)
    expect(run.stderr).toMatch(/不认识的参数：--verbose/)
  })

  it('--help：退出码 0，打印用法', () => {
    const run = runCli(['--help'])
    expect(run.status).toBe(0)
    expect(run.stdout).toMatch(/用法/)
  })
})
