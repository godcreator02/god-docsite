import { describe, expect, it } from 'vitest'
import { CREATE_COMMAND, inject, name } from '../src/index.js'

/**
 * 插件的身份对不对。判据只有一条——**这段逻辑能不能不启动进程、不开窗口、只传入输入看输出**。能，就写在这儿；
 * 不能（要启动子进程、要 Electron、要真装进 home），那不是不测，是走实机验证那条路。
 */
describe('gwb-docfirst-workflow', () => {
  it('插件名跟包名派生自同一个短名', () => {
    expect(name).toBe('gwb-docfirst-workflow')
  })

  it('建站命令的名字是命令总线上的公开接口；必需的服务只有命令总线', () => {
    expect(CREATE_COMMAND).toBe('docfirst.create')
    expect(inject).toEqual(['gwbCommands'])
  })
})
