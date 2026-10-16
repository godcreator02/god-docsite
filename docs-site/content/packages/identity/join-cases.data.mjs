/**
 * JoinCases（「identity：身份」那一页「身份码从哪来、怎么进名单」一节）的全部数据，画面（join-cases.tsx）只读这一份。
 * 六种情况共用同一份名单：照 people.test.ts 的夹具（小周带 gitea，Claude 是 agent；小李还没进名单），
 * 带来的 id、名字、码与 gitea、名单行的变化、报错原话全部照那份测试与 peopleWithJoined 的源码抄；
 * 「不动文件」出自 node 层 joinSitePeople 的 changed: false。
 */

/** 六种情况共用的名单（people.test.ts 的夹具，写成 peopleFileText 的样子：一项一行、两格缩进） */
/* ref file="../packages/identity/test/people.test.ts" lines="4-7" hash="48745e8ad382" blob="949619187900" */
export const peopleLines = [
  '  {"id":"zhou","name":"小周","codes":["zhoucode0001"],"gitea":"zhou"},',
  '  {"id":"claude","name":"Claude","agent":true}',
];

/** 加入名单的规则与全部拒绝原话，都在 peopleWithJoined；断言照 people.test.ts 的第三条测试 */
/* ref file="../packages/identity/test/people.test.ts" lines="44-51" hash="533cd66fa6a5" blob="949619187900" */
/* ref file="../packages/identity/src/core/people.ts" lines="66-76" hash="8585ac01df4c" blob="5d0cf38c6fe0" */
export const cases = [
  {
    id: 'new-person',
    label: '新的人',
    text: '名单里没有这个 id：新加一项，people.json 多一行。小李带着新 home 的码第一次把自己加进来。',
    joining: { id: 'li', name: '小李', code: 'licode000001', gitea: 'li' },
    outcome: { kind: 'joined', old: [], now: ['  {"id":"li","name":"小李","codes":["licode000001"],"gitea":"li"}'] },
  },
  {
    id: 'new-code',
    label: '新的码',
    text: '小周换了一台电脑，新 home 的设置里是另一个码：名单里已有 zhou，就把新码加进它的 codes，只有那一行变。',
    joining: { id: 'zhou', name: '小周', code: 'zhoucode0002' },
    outcome: {
      kind: 'joined',
      old: ['  {"id":"zhou","name":"小周","codes":["zhoucode0001"],"gitea":"zhou"},'],
      now: ['  {"id":"zhou","name":"小周","codes":["zhoucode0001","zhoucode0002"],"gitea":"zhou"},'],
    },
  },
  {
    id: 'same-code',
    label: '码已在名下',
    text: '码已经在小周名下：joinSitePeople 比过名单没变，不写文件。',
    joining: { id: 'zhou', name: '小周', code: 'zhoucode0001' },
    outcome: { kind: 'unchanged' },
  },
  {
    id: 'code-taken',
    label: '码在别人名下',
    text: '一个码只能写在一个人名下：小李带着小周的码想加入，报错。',
    joining: { id: 'li', name: '小李', code: 'zhoucode0001' },
    outcome: { kind: 'rejected', reason: '身份码 zhoucode0001 已经写在 zhou 名下，一个码只能是一个人的' },
  },
  {
    id: 'agent',
    label: 'id 是 agent',
    text: 'agent 没有身份码：想给名单里的 agent claude 加码，报错。',
    joining: { id: 'claude', name: 'Claude', code: 'botcode00001' },
    outcome: { kind: 'rejected', reason: 'claude 是 agent，agent 没有身份码' },
  },
  {
    id: 'gitea-differs',
    label: 'gitea 对不上',
    text: '带来的 gitea 和名单里已写的不一样：报错，不猜该改成哪个。',
    joining: { id: 'zhou', name: '小周', code: 'zhoucode0002', gitea: 'someone' },
    outcome: { kind: 'rejected', reason: 'zhou 的 gitea 写的是 zhou，不是 someone' },
  },
];
