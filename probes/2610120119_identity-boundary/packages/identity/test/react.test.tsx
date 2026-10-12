import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Avatar, IdentityBadge } from '../src/react/index.js'
import { resolveIdentity } from '../src/server/identity.js'
import type { StoredPerson } from '../src/server/people-file.js'

const people: StoredPerson[] = [
  { id: 'zhou', name: '小周', codes: ['probezhou001'] },
  { id: 'claude', name: 'Claude', agent: true },
]

describe('Avatar', () => {
  it('渲染名字的第一个字，不带身份码', () => {
    const html = renderToStaticMarkup(<Avatar person={{ id: 'zhou', name: '小周' }} />)
    expect(html).toContain('小')
    expect(html).toContain('ib-avatar')
  })
})

describe('IdentityBadge', () => {
  it('有身份：显示头像与名字；只读：显示「只读」，title 里是只读原因', () => {
    const zhou = resolveIdentity(people, 'probezhou001')
    const withIdentity = renderToStaticMarkup(<IdentityBadge identity={zhou} />)
    expect(withIdentity).toContain('小周')
    expect(withIdentity).toContain('ib-identity')
    const readOnly = resolveIdentity(people, undefined)
    const readonly = renderToStaticMarkup(<IdentityBadge identity={readOnly} />)
    expect(readonly).toContain('只读')
    expect(readonly).toContain('title="只读')
  })

  it('children 是宿主插槽：给什么渲染什么', () => {
    const zhou = resolveIdentity(people, 'probezhou001')
    const html = renderToStaticMarkup(
      <IdentityBadge identity={zhou}>
        <a href="/people">人员管理</a>
      </IdentityBadge>,
    )
    expect(html).toContain('<a href="/people">人员管理</a>')
  })

  it('两态输出都不出现身份码', () => {
    const withIdentity = renderToStaticMarkup(<IdentityBadge identity={resolveIdentity(people, 'probezhou001')} />)
    const readonly = renderToStaticMarkup(<IdentityBadge identity={resolveIdentity(people, undefined)} />)
    for (const html of [withIdentity, readonly]) expect(html).not.toContain('probezhou001')
  })
})
