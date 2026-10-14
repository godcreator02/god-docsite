import type { Person } from './people.js'

/**
 * 交给浏览器的人：只有公共字段。codes 写成 never，StoredPerson 在类型上就不能直接当 PublicPerson 用，
 * 要给浏览器只能经 publicPersonOf / publicPeopleOf
 */
export type PublicPerson = Person & { codes?: never }

/** 按白名单重造一个对象：身份码 codes 与调用方对象上的任何别的字段都不会带出去 */
export function publicPersonOf(person: Person): PublicPerson {
  const publicPerson: PublicPerson = { id: person.id, name: person.name }
  if (person.gitea !== undefined) publicPerson.gitea = person.gitea
  if (person.agent !== undefined) publicPerson.agent = person.agent
  return publicPerson
}

/** 交给浏览器的人员列表：凡是进 loader 数据的人员列表都只能是它的结果 */
export function publicPeopleOf(people: readonly Person[]): PublicPerson[] {
  return people.map(publicPersonOf)
}
