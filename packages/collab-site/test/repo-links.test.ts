import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { projectDirOfSite } from '@godcreator/collab-model/project-model'
import { checkRepoLink, locallyOpenedOf, projectFileOf, vscodeCommandOf } from '../src/server/repo-links.js'

// 每条测试都新建三个 git 仓，仓根 pnpm check 与插件的测试并行时，Windows 上启动 git 进程慢，5 秒不够
vi.setConfig({ testTimeout: 20_000 })

function git(cwd: string, ...args: string[]) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' })
}

function write(file: string, content: string | Buffer) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, content)
}

function repoWithCommit(dir: string, files: Record<string, string | Buffer>) {
  mkdirSync(dir, { recursive: true })
  git(dir, 'init', '-q', '-b', 'main')
  git(dir, 'config', 'user.email', 'test@example.com')
  git(dir, 'config', 'user.name', 'test')
  for (const [file, content] of Object.entries(files)) write(path.join(dir, file), content)
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', 'init')
}

/**
 * 一个项目文件夹：协作仓 collab（站点在 collab/site/）、固件仓 firmware、手册仓 datasheets，加一个不是 git 仓的 notes 目录。
 * 路径取 realpath：Windows 的临时目录是短文件名，git 给出的是长文件名
 */
function projectFolder() {
  const projectDir = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'collab-project-')))
  repoWithCommit(path.join(projectDir, 'collab'), {
    'README.md': '# 混合 MMC 协作站\n\n正文\n',
    'site/pages/index.tsx': 'export const meta = { title: "首页" }\n',
  })
  repoWithCommit(path.join(projectDir, 'firmware'), {
    'README.md': '一段开场白\n\n# DSP 固件\n',
    'src/main.c': 'int main(void) { return 0; }\n',
    'lib.bin': Buffer.from([0x7f, 0x45, 0x00, 0x01]),
    '子模块/说明.md': '# 说明\n',
  })
  repoWithCommit(path.join(projectDir, 'datasheets'), { 'ti/a.pdf': '%PDF-1.7\n' })
  write(path.join(projectDir, 'notes', 'x.md'), '# x\n')
  return { projectDir, siteRoot: path.join(projectDir, 'collab', 'site') }
}

describe('项目文件夹', () => {
  it('是站点所在协作仓的上一级；按固定的布局算，不问 git', () => {
    const { projectDir, siteRoot } = projectFolder()
    expect(projectDirOfSite(siteRoot)).toBe(projectDir)
  })

  it('链接到别处的仓（目录联接、符号链接）里的文件也能打开', async () => {
    const { projectDir } = projectFolder()
    const elsewhere = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'collab-elsewhere-')))
    repoWithCommit(path.join(elsewhere, 'fpga'), { 'top.v': 'module top; endmodule\n' })
    symlinkSync(path.join(elsewhere, 'fpga'), path.join(projectDir, 'fpga'), 'junction')
    expect((await checkRepoLink(projectDir, 'repo:fpga/top.v#L1')).state).toBe('ok')
  })
})

describe('repo: 链接', () => {
  it('文本文件由站点服务在 VS Code 里打开，#L 行号取出来跳到那一行，行段取起始行', async () => {
    const { projectDir } = projectFolder()
    expect(await checkRepoLink(projectDir, 'repo:firmware/src/main.c#L12')).toEqual({ target: 'repo:firmware/src/main.c#L12', state: 'ok', open: { how: 'vscode' } })
    const file = path.join(projectDir, 'firmware', 'src', 'main.c')
    expect(await locallyOpenedOf(projectDir, 'repo:firmware/src/main.c#L12')).toEqual({ open: { how: 'vscode' }, file, line: 12 })
    expect((await locallyOpenedOf(projectDir, 'repo:firmware/src/main.c#L12-L20')).line).toBe(12)
    expect((await locallyOpenedOf(projectDir, 'repo:firmware/src/main.c')).line).toBeUndefined()
  })

  it('站点服务只在本机打开 VS Code 与系统默认程序那两种；浏览器能看的、打不开的都抛错', async () => {
    const { projectDir } = projectFolder()
    expect((await locallyOpenedOf(projectDir, 'repo:firmware/lib.bin')).open).toEqual({ how: 'system' })
    await expect(locallyOpenedOf(projectDir, 'repo:datasheets/ti/a.pdf')).rejects.toThrow(/由页面在浏览器里打开/)
    await expect(locallyOpenedOf(projectDir, 'repo:firmware/src/nope.c')).rejects.toThrow(/repo:firmware\/src\/nope\.c：firmware 仓里没有 src\/nope\.c/)
  })

  it('VS Code 的命令：先给项目文件夹、再 -g 给文件和行号；Windows 上经 cmd.exe 运行 code，每个参数加引号、命令名不加', () => {
    expect(vscodeCommandOf('/p/hybrid-mmc', { file: '/p/hybrid-mmc/firmware/main.c', line: 12 }, 'linux')).toEqual({
      command: 'code',
      args: ['/p/hybrid-mmc', '-g', '/p/hybrid-mmc/firmware/main.c:12'],
      windowsVerbatimArguments: false,
    })
    expect(vscodeCommandOf('D:\\p\\hybrid-mmc', { file: 'D:\\p\\hybrid-mmc\\data sheets\\README.md' }, 'win32')).toEqual({
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', '"code "D:\\p\\hybrid-mmc" "-g" "D:\\p\\hybrid-mmc\\data sheets\\README.md""'],
      windowsVerbatimArguments: true,
    })
  })

  it('中文路径照写，百分号编码过的也认', async () => {
    const { projectDir } = projectFolder()
    expect((await checkRepoLink(projectDir, 'repo:firmware/子模块/说明.md')).state).toBe('ok')
    expect((await checkRepoLink(projectDir, `repo:firmware/${encodeURIComponent('子模块')}/${encodeURIComponent('说明.md')}`)).state).toBe('ok')
  })

  it('PDF 交给浏览器，经站点服务取文件，#page 原样带上', async () => {
    const { projectDir } = projectFolder()
    expect(await checkRepoLink(projectDir, 'repo:datasheets/ti/a.pdf#page=5')).toEqual({
      target: 'repo:datasheets/ti/a.pdf#page=5',
      state: 'ok',
      open: { how: 'browser', url: '/api/project-file/datasheets/ti/a.pdf#page=5' },
    })
  })

  it('指向目录的链接算写错：VS Code 只打开具体的文件；二进制文件用系统默认程序打开', async () => {
    const { projectDir } = projectFolder()
    expect(await checkRepoLink(projectDir, 'repo:firmware/src')).toEqual({ target: 'repo:firmware/src', state: 'invalid', problem: 'firmware/src 是目录：repo: 链接要指向具体的文件' })
    expect((await checkRepoLink(projectDir, 'repo:firmware')).state).toBe('invalid')
    expect(await checkRepoLink(projectDir, 'repo:firmware/lib.bin')).toEqual({ target: 'repo:firmware/lib.bin', state: 'ok', open: { how: 'system' } })
  })

  it('仓本机没有、目录不是 git 仓，是 no-repo；仓在文件不在，是 no-file', async () => {
    const { projectDir } = projectFolder()
    expect((await checkRepoLink(projectDir, 'repo:fpga/top.v')).state).toBe('no-repo')
    expect((await checkRepoLink(projectDir, 'repo:notes/x.md')).state).toBe('no-repo')
    expect((await checkRepoLink(projectDir, 'repo:firmware/src/nope.c')).state).toBe('no-file')
  })

  it('跑出项目文件夹、绝对路径、空路径、认不出的 # 都算写错', async () => {
    const { projectDir } = projectFolder()
    for (const target of [
      'repo:',
      'repo:../x',
      'repo:firmware/../collab/README.md',
      'repo:/etc/passwd',
      'repo:C:/Windows',
      'repo:firmware\\src\\main.c',
      'repo:firmware/src/main.c#page=3',
      'repo:firmware/src#L1',
      'repo:firmware/lib.bin#L1',
      'repo:firmware/%E5%AD',
    ]) {
      expect(await checkRepoLink(projectDir, target), target).toMatchObject({ target, state: 'invalid' })
    }
  })
})

describe('交给浏览器的文件', () => {
  it('只交项目文件夹里各仓里的 PDF、图片、网页', async () => {
    const { projectDir } = projectFolder()
    expect(projectFileOf(projectDir, '/datasheets/ti/a.pdf')).toBe(path.join(projectDir, 'datasheets', 'ti', 'a.pdf'))
    expect(() => projectFileOf(projectDir, '/../secret.pdf')).toThrow()
    expect(() => projectFileOf(projectDir, '/notes/x.pdf')).toThrow()
    expect(() => projectFileOf(projectDir, '/firmware/src/main.c')).toThrow()
  })
})
