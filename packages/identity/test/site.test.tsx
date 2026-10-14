import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { identityOf, publicPeopleOf, type PublicPerson, type StoredPerson } from '../src/core/index.js'
import { IdentityBadge, IdentityProvider, useSiteIdentity, useSitePeople } from '../src/site/index.js'

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

describe('身份标识', () => {
  it('有身份显示名字，只读显示「只读」并把原因放在 title 上', () => {
    expect(renderToStaticMarkup(<IdentityBadge identity={zhou} />)).toContain('小周')
    const readOnly = renderToStaticMarkup(<IdentityBadge identity={identityOf(storedPeople, undefined)} />)
    expect(readOnly).toContain('只读')
    expect(readOnly).toContain('没有本机的身份码')
  })
})
