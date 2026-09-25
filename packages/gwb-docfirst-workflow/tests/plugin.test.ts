import { describe, expect, it } from 'vitest'
import { name } from '../src/index.js'

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
})
