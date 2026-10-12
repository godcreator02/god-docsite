/**
 * 身份包自检：不依赖 node_modules（vitest、react 未安装时也能跑），用 node 24 的类型剥离直接执行 src 的 model 与 server 代码。
 * 跑法：在本目录运行 `node --import ./ts-extension-hooks.mjs selfcheck.ts`（钩子把 src 里 .js 后缀的 import 映射回 .ts 源）。
 * react 入口与 vitest 正式测试要等依赖安装后才能检查，见 result.md。
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  authorizeWrite,
  identityCodeEnvName,
  identityCodePattern,
  identityOf,
  parsePeople,
  peopleFile,
  peopleMatching,
  peopleWithJoined,
  personOf,
  publicPeopleOf,
  publicPersonOf,
  siteIdentity,
  sitePeople,
  WriteAccessError,
  type StoredPerson,
} from '../../../../packages/docsite-identity/src/server/index.js'
import { mentionBeingTyped, mentionsOf, type Person } from '../../../../packages/docsite-identity/src/model.js'

let checks = 0
const section = (name: string) => console.log(`\n== ${name} ==`)
const ok = (condition: boolean, label: string) => {
  if (!condition) throw new Error(`FAIL: ${label}`)
  checks++
  console.log(`PASS ${label}`)
}
const equal = (actual: unknown, expected: unknown, label: string) => {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`FAIL: ${label}\n  实际 ${a}\n  期望 ${e}`)
  checks++
  console.log(`PASS ${label}`)
}
const throwsWith = (fn: () => unknown, expected: string, label: string) => {
  try {
    fn()
  } catch (error) {
    const message = String((error as Error).message)
    if (message !== expected) throw new Error(`FAIL: ${label}\n  实际报错 ${JSON.stringify(message)}\n  期望报错 ${JSON.stringify(expected)}`)
    checks++
    console.log(`PASS ${label}`)
    return error as Error
  }
  throw new Error(`FAIL: ${label}（没有报错）`)
}

const stored: StoredPerson[] = [
  { id: 'zhou', name: '小周', codes: ['zhoucode0001'], gitea: 'zhou' },
  { id: 'li', name: '小李' },
  { id: 'claude', name: 'Claude', agent: true },
]
const publicPeople: Person[] = [
  { id: 'zhou', name: '小周', gitea: 'zhou' },
  { id: 'li', name: '小李' },
  { id: 'claude', name: 'Claude', agent: true },
]

section('根入口：公开模型')
equal(peopleFile, 'people.json', '人员列表文件名是 people.json')
equal(personOf(publicPeople, 'claude'), { id: 'claude', name: 'Claude', agent: true }, 'personOf 按 id 取人')
throwsWith(() => personOf(publicPeople, 'nobody'), 'people.json 里没有 nobody', 'personOf 取不到时报错')
equal(
  publicPersonOf({ id: 'zhou', name: '小周', codes: ['zhoucode0001'], gitea: 'zhou' } as Person & { codes: string[] }),
  { id: 'zhou', name: '小周', gitea: 'zhou' },
  'publicPersonOf 白名单投影，codes 不出现',
)
equal(publicPeopleOf(stored), publicPeople, 'publicPeopleOf 整个列表投影')
equal(mentionsOf('@zhou 看一下，也请 @claude 和 @nobody，再 @zhou；mail@zhou 不算', publicPeople), ['zhou', 'claude'], 'mentionsOf 只认列表里的人，按出现顺序不重复')
equal(mentionBeingTyped('看一下 @zh'), { start: 4, query: 'zh' }, 'mentionBeingTyped 认出 @ 的位置和已打的字')
ok(mentionBeingTyped('mail a@b') === null, '邮箱不算在打 @')
ok(mentionBeingTyped('@zhou ') === null, '@ 后打了空格不算在打 @')
equal(
  peopleMatching([{ id: 'azhou', name: '阿周' }, { id: 'zhou', name: '小周' }, { id: 'li', name: '小李' }], 'zh').map((person) => person.id),
  ['zhou', 'azhou'],
  'peopleMatching 按 id 或名字筛，id 开头的排前面',
)

section('server：people.json 的校验与登记')
equal(parsePeople(stored), stored, '合法的 people.json 原样读回')
throwsWith(
  () =>
    parsePeople([
      { id: 'zhou', name: '小周', codes: ['zhoucode0001'] },
      { id: 'zhou', name: '' },
      { id: '小 李', name: '小李', agent: 'yes', role: 'x' },
      'li',
      { id: 'li', name: '小李', codes: ['zhoucode0001', 'BAD'] },
      { id: 'bot', name: 'Bot', agent: true, codes: ['botcode00001'] },
    ] as unknown as StoredPerson[]),
  [
    'people.json 第 2 项：id zhou 和前面的重复了',
    'people.json 第 2 项：name 要是非空字符串',
    'people.json 第 3 项：认不出 role，能写的只有 id、name、codes、gitea、agent',
    'people.json 第 3 项：id 要是字母、数字、_、- 组成的字符串',
    'people.json 第 3 项：agent 要是 true 或 false',
    'people.json 第 4 项 要是 { "id": …, "name": … }',
    'people.json 第 5 项：身份码 zhoucode0001 已经写在 zhou 名下，一个码只能是一个人的',
    'people.json 第 5 项：身份码 BAD 要是 8 到 64 个小写字母或数字',
    'people.json 第 6 项：agent 没有身份码，去掉 codes',
  ].join('\n'),
  '写错的 people.json 一次列出全部问题',
)
ok(identityCodePattern.test('zhoucode0001') && !identityCodePattern.test('abc') && !identityCodePattern.test('ABC12345') && !identityCodePattern.test('a'.repeat(65)), '身份码是 8 到 64 个小写字母或数字')
equal(peopleWithJoined(stored, 'zhoucode0002', { id: 'zhou', name: '小周' })[0]!.codes, ['zhoucode0001', 'zhoucode0002'], 'join：已有这个人就加进他的 codes')
equal(peopleWithJoined(stored, 'wangcode0001', { id: 'wang', name: '小王', gitea: 'wang' })[3], { id: 'wang', name: '小王', codes: ['wangcode0001'], gitea: 'wang' }, 'join：没有就新加一项')
throwsWith(() => peopleWithJoined(stored, 'zhoucode0001', { id: 'li', name: '小李' }), '身份码 zhoucode0001 已经写在 zhou 名下，一个码只能是一个人的', 'join：码在别人名下时报错')
throwsWith(() => peopleWithJoined(stored, 'botcode00001', { id: 'claude', name: 'Claude' }), 'claude 是 agent，agent 没有身份码', 'join：id 是 agent 时报错')
throwsWith(() => peopleWithJoined(stored, 'zhoucode0002', { id: 'zhou', name: '小周', gitea: 'someone' }), 'zhou 的 gitea 写的是 zhou，不是 someone', 'join：gitea 和已写的不一样时报错')

section('server：本机身份')
equal(identityOf(stored, 'zhoucode0001'), { person: { id: 'zhou', name: '小周', gitea: 'zhou' } }, '码在列表里就是那个人，person 不带 codes')
ok(!('codes' in identityOf(stored, 'zhoucode0001').person!), 'identityOf 的 person 没有 codes 字段')
const noCode = identityOf(stored, undefined)
ok(noCode.person === null && noCode.reason!.includes('不是经 gwb 插件 gwb-docsite 启动的'), '没有码时只读并写明原因')
const unknownCode = identityOf(stored, 'othercode001')
ok(unknownCode.person === null && unknownCode.reason!.includes('本机的身份码不在 people.json 里') && !unknownCode.reason!.includes('othercode001'), '码不在列表里时只读，原因里不出现码')

const siteDir = await mkdtemp(path.join(tmpdir(), 'docsite-identity-selfcheck-'))
try {
  throwsWith(() => sitePeople(siteDir), '站点目录里没有 people.json：写一个数组列出参与的人，每项 { "id": "zhou", "name": "小周", "codes": ["<身份码>"] }，agent 加 "agent": true', '没有 people.json 时报错写明怎么写')
  await writeFile(path.join(siteDir, 'people.json'), JSON.stringify(stored))
  equal(sitePeople(siteDir), stored, 'sitePeople 读站点目录里的 people.json')
  ok(siteIdentity(siteDir).person === null && siteIdentity(siteDir).reason!.includes('没有本机的身份码'), 'siteIdentity 没有环境变量时只读')
  process.env[identityCodeEnvName] = 'zhoucode0001'
  equal(siteIdentity(siteDir), { person: { id: 'zhou', name: '小周', gitea: 'zhou' } }, 'siteIdentity 按环境变量的码找人')
  process.env[identityCodeEnvName] = 'othercode001'
  ok(siteIdentity(siteDir).reason!.includes('本机的身份码不在 people.json 里') && !siteIdentity(siteDir).reason!.includes('othercode001'), 'siteIdentity 的只读原因不泄露码')
} finally {
  delete process.env[identityCodeEnvName]
  await rm(siteDir, { recursive: true })
}

section('server：写入前的核对 authorizeWrite')
const origin = 'http://127.0.0.1:4430'
const zhouIdentity = identityOf(stored, 'zhoucode0001')
const postFrom = (headerOrigin: string | null) => {
  const headers = new Headers()
  if (headerOrigin !== null) headers.set('Origin', headerOrigin)
  return new Request('http://site/api/comments', { method: 'POST', headers, body: new FormData() })
}
equal(authorizeWrite(postFrom(origin), { identity: zhouIdentity, people: publicPeople, origin }).id, 'zhou', 'Origin 和宿主配置完全一样时放行')
const missingOrigin = throwsWith(() => authorizeWrite(postFrom(null), { identity: zhouIdentity, people: publicPeople, origin }), '写入只接受来自 http://127.0.0.1:4430 的请求', 'Origin 缺失 403') as WriteAccessError
ok(missingOrigin.status === 403 && missingOrigin instanceof WriteAccessError, 'Origin 缺失抛 WriteAccessError，status 403')
const wrongOrigin = throwsWith(() => authorizeWrite(postFrom(origin), { identity: zhouIdentity, people: publicPeople, origin: 'http://127.0.0.1:5460' }), '写入只接受来自 http://127.0.0.1:5460 的请求', 'Origin 不匹配 403') as WriteAccessError
ok(wrongOrigin.status === 403, 'Origin 不匹配 status 403')
const spoofed = throwsWith(() => authorizeWrite(postFrom('http://127.0.0.1:4430.evil.example'), { identity: zhouIdentity, people: publicPeople, origin }), '写入只接受来自 http://127.0.0.1:4430 的请求', '前缀相同的别的 origin 不放行') as WriteAccessError
ok(spoofed.status === 403, '伪造的 origin status 403')
const readOnly = throwsWith(() => authorizeWrite(postFrom(origin), { identity: identityOf(stored, undefined), people: publicPeople, origin }), '只读：这个开发服务不是经 gwb 插件 gwb-docsite 启动的，没有本机的身份码', '没有本机身份 403') as WriteAccessError
ok(readOnly.status === 403, '无身份 status 403')
equal(authorizeWrite(postFrom(origin), { identity: zhouIdentity, people: publicPeople, as: undefined, origin }).id, 'zhou', 'as 省略用当前身份')
equal(authorizeWrite(postFrom(origin), { identity: zhouIdentity, people: publicPeople, as: null, origin }).id, 'zhou', 'as 是 null 也算省略')
equal(authorizeWrite(postFrom(origin), { identity: zhouIdentity, people: publicPeople, as: 'claude', origin }).id, 'claude', 'as 是已登记的 agent：以它身份写')
const unknownAs = throwsWith(() => authorizeWrite(postFrom(origin), { identity: zhouIdentity, people: publicPeople, as: 'nobody', origin }), 'people.json 里没有 nobody', 'as 未知 400') as WriteAccessError
ok(unknownAs.status === 400, 'as 未知 status 400')
const personAs = throwsWith(() => authorizeWrite(postFrom(origin), { identity: zhouIdentity, people: publicPeople, as: 'li', origin }), 'as 只给 agent 用：li 不是 agent，人的身份取本机的身份码', 'as 冒充人 403') as WriteAccessError
ok(personAs.status === 403, 'as 冒充人 status 403')

section('authorizeWrite 的白名单投影（输入直接带服务端字段，不经 identityOf 预投影）')
const zhouWithServerFields: StoredPerson & { extra: string } = { id: 'zhou', name: '小周', gitea: 'zhou', codes: ['zhoucode0001'], extra: 'server-only' }
const agentWithExtra: Person & { extra: string } = { id: 'claude', name: 'Claude', agent: true, extra: 'server-only' }
equal(authorizeWrite(postFrom(origin), { identity: { person: zhouWithServerFields }, people: [zhouWithServerFields, agentWithExtra], origin }), { id: 'zhou', name: '小周', gitea: 'zhou' }, 'as 省略：identity.person 带 codes 与 extra，返回只有 id、name、gitea')
equal(authorizeWrite(postFrom(origin), { identity: { person: zhouWithServerFields }, people: [zhouWithServerFields, agentWithExtra], as: null, origin }), { id: 'zhou', name: '小周', gitea: 'zhou' }, 'as 是 null：同样经投影')
equal(zhouWithServerFields, { id: 'zhou', name: '小周', gitea: 'zhou', codes: ['zhoucode0001'], extra: 'server-only' }, 'as 省略：输入对象未被修改')
equal(authorizeWrite(postFrom(origin), { identity: { person: zhouWithServerFields }, people: [zhouWithServerFields, agentWithExtra], as: 'claude', origin }), { id: 'claude', name: 'Claude', agent: true }, 'as 是 agent：people 里的 agent 带 extra，返回只有 id、name、agent')
equal(agentWithExtra, { id: 'claude', name: 'Claude', agent: true, extra: 'server-only' }, 'as 是 agent：输入对象未被修改')

section('不在本自检范围内')
console.log('- src/react/index.tsx 的类型与渲染、test/*.test.ts 的正式测试：由 tsc --noEmit 与 vitest 检查，输出见 checks-fix.log')

console.log(`\nselfcheck 完成：${checks} 项全部通过`)
