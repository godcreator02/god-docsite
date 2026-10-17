import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { identityOf, publicPeopleOf, type PublicPerson, type StoredPerson } from '../src/core/index.js'
import { Avatar, IdentityBadge, IdentityProvider, useSiteIdentity, useSitePeople } from '../src/site/index.js'

const storedPeople: StoredPerson[] = [
  { id: 'zhou', name: '小周', codes: ['zhoucode0001'], gitea: 'zhou' },
  { id: 'claude', name: 'Claude', agent: true },
]
const zhou = identityOf(storedPeople, 'zhoucode0001')

function WhoAmI() {
  const identity = useSiteIdentity()
  const people = useSitePeople()
  return <p>{`${identity.person?.name ?? '只读'}：${people.map((person) => person.id).join(',')}`}</p>
}

describe('给浏览器的人员只能是公开投影', () => {
  it('类型上 StoredPerson 不能当 PublicPerson 用，Provider 只收投影过的列表', () => {
    // @ts-expect-error StoredPerson 带着 codes，不能直接交给浏览器
    const leaked: PublicPerson = storedPeople[0]!
    expect(leaked.id).toBe('zhou')
    // @ts-expect-error Provider 的 people 只收 PublicPerson
    const element = <IdentityProvider identity={zhou} people={storedPeople}>{null}</IdentityProvider>
    expect(element).toBeDefined()
  })

  it('投影过的列表经 Provider 交给 hook：有名字、有 id，页面上没有身份码', () => {
    const html = renderToStaticMarkup(
      <IdentityProvider identity={zhou} people={publicPeopleOf(storedPeople)}>
        <WhoAmI />
      </IdentityProvider>,
    )
    expect(html).toContain('小周：zhou,claude')
    expect(html).not.toContain('zhoucode0001')
  })

  it('绕过类型把带 codes 的人交给 Provider：渲染时报错，点名是谁', () => {
    expect(() =>
      renderToStaticMarkup(
        <IdentityProvider identity={zhou} people={storedPeople as unknown as PublicPerson[]}>
          <WhoAmI />
        </IdentityProvider>,
      ),
    ).toThrow('交给浏览器的人员列表带着身份码（zhou）')
  })

  it('在 Provider 外面用 hook 直接报错', () => {
    expect(() => renderToStaticMarkup(<WhoAmI />)).toThrow('useSiteIdentity 要在 IdentityProvider 里面用')
  })
})

const inProvider = (people: PublicPerson[], element: ReactNode) =>
  renderToStaticMarkup(
    <IdentityProvider identity={zhou} people={people}>
      {element}
    </IdentityProvider>,
  )

describe('身份标识', () => {
  it('有身份是一个能点开头像面板的按钮，带名字；只读显示「只读」并把原因放在 title 上，没有按钮', () => {
    const badge = inProvider(publicPeopleOf(storedPeople), <IdentityBadge identity={zhou} />)
    expect(badge).toContain('小周')
    expect(badge).toContain('data-identity-badge')
    const readOnly = inProvider(publicPeopleOf(storedPeople), <IdentityBadge identity={identityOf(storedPeople, undefined)} />)
    expect(readOnly).toContain('只读')
    expect(readOnly).toContain('没有本机的身份码')
    expect(readOnly).not.toContain('data-identity-badge')
  })
})

describe('头像', () => {
  it('按 id 在人员列表里查头像：有地址画图，没有画名字的第一个字', () => {
    const people: PublicPerson[] = [...publicPeopleOf(storedPeople).slice(0, 1), { id: 'claude', name: 'Claude', agent: true, avatar: '/avatars/claude.webp?v=1' }]
    const html = inProvider(
      people,
      <>
        <Avatar person={{ id: 'claude', name: 'Claude' }} />
        <Avatar person={{ id: 'zhou', name: '小周' }} />
      </>,
    )
    expect(html).toContain('<img aria-hidden="true" alt="" class="dc-avatar" src="/avatars/claude.webp?v=1"')
    expect(html).toContain('>小</span>')
  })

  it('在 Provider 外面用直接报错', () => {
    expect(() => renderToStaticMarkup(<Avatar person={{ id: 'zhou', name: '小周' }} />)).toThrow('Avatar 要在 IdentityProvider 里面用')
  })
})
