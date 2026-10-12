import { describe, expect, it, vi } from 'vitest'
import type { GwbGiteaApi } from '@godcreator/gwb-gitea'
import { giteaAccessOf, pushUrlOf } from '../../src/gitea-api/access.js'

function setup() {
  const state = { installed: true, token: 'first-token', login: 'alice', sendFails: false }
  const http = vi.fn(async (_request: unknown) => {
    if (state.sendFails) throw new Error('没发出去：网络不通')
    return { status: 200, truncated: false, body: { login: state.login } }
  })
  const service: GwbGiteaApi = {
    http,
    connection: () => ({ baseUrl: 'https://git.example.test/', pushUrl: 'https://push.example.test', token: state.token }),
  }
  return { state, http, access: giteaAccessOf(() => (state.installed ? service : null)) }
}

describe('经服务 gwbGitea 读地址、令牌与账号', () => {
  it('账号由 connection 的地址、令牌和 /user 查到的登录名组成，推送地址也从 connection 读', async () => {
    const { access, http } = setup()
    expect(await access.account()).toEqual({ baseUrl: 'https://git.example.test', token: 'first-token', login: 'alice' })
    expect(http).toHaveBeenCalledWith({ method: 'GET', path: '/user' })
    expect(await access.pushUrl()).toBe('https://push.example.test')
  })

  it('没填令牌时立即拒绝，不向 Gitea 发请求', async () => {
    const { state, access, http } = setup()
    state.token = ''
    await expect(access.account()).rejects.toThrow('还没填 Gitea 令牌')
    expect(http).not.toHaveBeenCalled()
  })

  it('gwb-gitea 没装或停用时，接口请求、账号、推送地址都拒绝', async () => {
    const { state, access } = setup()
    state.installed = false
    await expect(access.http({ method: 'GET', path: '/version' })).rejects.toThrow('gwb-gitea 没装或没启用')
    await expect(access.account()).rejects.toThrow('gwb-gitea 没装或没启用')
    await expect(access.pushUrl()).rejects.toThrow('gwb-gitea 没装或没启用')
  })

  it('相同令牌复用账号查询，换令牌后查询新的账号', async () => {
    const { state, access, http } = setup()
    await access.account()
    await access.account()
    expect(http).toHaveBeenCalledTimes(1)
    state.token = 'second-token'
    state.login = 'bob'
    expect(await access.account()).toEqual({ baseUrl: 'https://git.example.test', token: 'second-token', login: 'bob' })
    expect(http).toHaveBeenCalledTimes(2)
  })

  it('请求没发出去时带上 gwb-gitea 的原话拒绝', async () => {
    const { state, access } = setup()
    state.sendFails = true
    await expect(access.http({ method: 'GET', path: '/version' })).rejects.toThrow('gwb-gitea 没能发出请求：没发出去：网络不通')
  })
})

describe('推送地址', () => {
  it('gwb-gitea 的 push-url 写对了照用，写错了报错写明要什么，不替它改', () => {
    expect(pushUrlOf('https://ntfy.example.org:28377')).toBe('https://ntfy.example.org:28377')
    expect(() => pushUrlOf('https://ntfy.example.org/x')).toThrow(/不带路径/)
    expect(() => pushUrlOf('ntfy.example.org')).toThrow(/push-url 要是 http\(s\):\/\//)
    expect(() => pushUrlOf(undefined)).toThrow(/现在是 undefined/)
  })
})
