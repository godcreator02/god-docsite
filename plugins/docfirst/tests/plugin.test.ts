import { describe, expect, it } from 'vitest'
import { SITE_LIST_COMMAND as PANE_READS } from '../src/client/site-rows.js'
import { CREATE_COMMAND, CREATE_PLAIN_COMMAND, inject, name, SITE_ADD_COMMAND, SITE_LIST_COMMAND, SITE_REMOVE_COMMAND, SITE_RESTART_COMMAND, SITES_PANE } from '../src/index.js'

/**
 * 第一条测试：插件的身份对不对。
 *
 * 判据只有一条——**这段逻辑能不能不启动进程、不开窗口、只传入输入看输出**。能，就写在这儿；
 * 不能（要启动子进程、要 Electron、要真装进 home），那不是不测，是走实机验证那条路。
 * 两者不互相替代：`pnpm check` 全绿从来不代表装出来能跑，它检查的是源码、不碰 build 产物。
 */
describe('gwb-docfirst-workflow', () => {
  it('插件名跟包名派生自同一个短名', () => {
    expect(name).toBe('gwb-docfirst-workflow')
  })

  it('两条建站命令的名字是命令总线上的公开接口；必需的服务只有命令总线', () => {
    expect(CREATE_COMMAND).toBe('docfirst.create')
    expect(CREATE_PLAIN_COMMAND).toBe('docfirst.create-plain')
    expect(inject).toEqual(['gwbCommands'])
  })

  it('四条托管命令的名字也是公开接口', () => {
    expect([SITE_LIST_COMMAND, SITE_ADD_COMMAND, SITE_REMOVE_COMMAND, SITE_RESTART_COMMAND]).toEqual(['docfirst.site.list', 'docfirst.site.add', 'docfirst.site.remove', 'docfirst.site.restart'])
  })

  it('窗格 id 写进人的布局里，也是公开接口；窗格读的就是 list 那条命令', () => {
    expect(SITES_PANE).toBe('sites')
    expect(PANE_READS).toBe(SITE_LIST_COMMAND)
  })
})
