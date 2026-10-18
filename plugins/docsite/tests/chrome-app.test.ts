import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { chromeAppIdOf, chromeAppOpener, chromeCandidatesOf, findChrome } from '../src/chrome-app.js'

describe('找 Chrome', () => {
  const env = { ProgramFiles: 'C:\\Program Files', 'ProgramFiles(x86)': 'C:\\Program Files (x86)', LOCALAPPDATA: 'C:\\Users\\bob\\AppData\\Local' }
  const candidates = chromeCandidatesOf(env)

  it('按 64 位、32 位、只给当前用户装的顺序找，没设的环境变量跳过', () => {
    expect(candidates).toEqual([
      path.join('C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join('C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join('C:\\Users\\bob\\AppData\\Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ])
    expect(chromeCandidatesOf({ LOCALAPPDATA: 'C:\\Users\\bob\\AppData\\Local' })).toEqual([candidates[2]])
  })

  it('用第一个存在的；一个都没有就报错，写明找过哪些', () => {
    expect(findChrome(candidates, (file) => file === candidates[2])).toBe(candidates[2])
    expect(() => findChrome(candidates, () => false)).toThrow(/没找到 Chrome（找过 .*Program Files/)
  })
})

describe('每个站点只用一个 Chrome 应用窗口', () => {
  const url = 'http://127.0.0.1:4330/'
  const title = '混合型 MMC 样机'

  it('应用窗口的身份不带端口', () => {
    expect(chromeAppIdOf(url)).toBe('Chrome.127.0.0.1_/')
    expect(chromeAppIdOf('http://127.0.0.1:4331/tasks')).toBe('Chrome.127.0.0.1_/tasks')
  })

  it('按站名找已有窗口，找到只切到前台、不启动；关掉以后下一次重新启动', async () => {
    const focus = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const launch = vi.fn().mockResolvedValue(undefined)
    const open = chromeAppOpener(focus, launch)
    expect(await open('chrome', url, title)).toBe('focused')
    expect(focus).toHaveBeenCalledWith('chrome', url, title)
    expect(launch).not.toHaveBeenCalled()
    expect(await open('chrome', url, title)).toBe('launched')
    expect(launch).toHaveBeenCalledExactlyOnceWith('chrome', url)
  })

  it('启动以后不再等窗口出现：页面还在加载时认不出窗口，也不报错', async () => {
    const focus = vi.fn().mockResolvedValue(false)
    const launch = vi.fn().mockResolvedValue(undefined)
    await chromeAppOpener(focus, launch)('chrome', url, title)
    expect(focus).toHaveBeenCalledOnce()
    expect(launch).toHaveBeenCalledOnce()
  })

  it('站点没写站名时不找窗口，直接启动', async () => {
    const focus = vi.fn().mockResolvedValue(true)
    const launch = vi.fn().mockResolvedValue(undefined)
    expect(await chromeAppOpener(focus, launch)('chrome', url, null)).toBe('launched')
    expect(focus).not.toHaveBeenCalled()
  })

  it('同一站点同时点几次只打开一次，不同端口各开各的', async () => {
    const focus = vi.fn().mockResolvedValue(false)
    const launch = vi.fn().mockResolvedValue(undefined)
    const open = chromeAppOpener(focus, launch)
    await Promise.all([open('chrome', url, title), open('chrome', `${url}tasks`, title), open('chrome', 'http://127.0.0.1:4331/', '另一个项目')])
    expect(launch).toHaveBeenCalledTimes(2)
  })

  it('找已有窗口时出错就报错，不盲目再开一个', async () => {
    const focus = vi.fn().mockRejectedValue(new Error('窗口读取失败'))
    const launch = vi.fn().mockResolvedValue(undefined)
    await expect(chromeAppOpener(focus, launch)('chrome', url, title)).rejects.toThrow('窗口读取失败')
    expect(launch).not.toHaveBeenCalled()
  })
})
