/**
 * RecognizeCases（「identity：身份」那一页「认人」一节）的全部数据，画面（recognize-cases.tsx）只读这一份。
 * 四种情况共用这一页的贯穿名单（小周、小李、Claude），名单行照 write-access.test.ts 的夹具抄；
 * 两句只读原因照 core/identity.ts 的源码抄（源码里的 ${peopleFile} 展开成 people.json），
 * 发布版的只读原因照 node/identity.ts 抄——start 不看环境变量里的码。
 */

/** 贯穿名单（照测试夹具，一项一行） */
/* ref file="../packages/identity/test/write-access.test.ts" lines="4-10" hash="b8a2bfd59677" blob="52d5ba27187e" */
export const peopleLines = [
  '{"id":"zhou","name":"小周","codes":["zhoucode0001"]},',
  '{"id":"li","name":"小李"},',
  '{"id":"claude","name":"Claude","agent":true}',
];

/** 环境变量名：启动方（gwb-docsite）把本机的身份码放在这里（packages/identity/src/node/identity.ts） */
export const envName = 'DOCSITE_IDENTITY_CODE';

/** 只读原因的原文，照源码抄 */
/* ref file="../packages/identity/src/core/identity.ts" lines="11-16" hash="8913bef4311f" blob="7b82e260a0c2" */
const reasonNoCode = '只读：这个开发服务不是经 gwb 插件 gwb-docsite 启动的，没有本机的身份码';
const reasonUnknownCode = '只读：本机的身份码不在 people.json 里，调 docsite.people.join 把自己加进去';

/** 发布版的只读原因；start 不看环境变量里的码 */
/* ref file="../packages/identity/src/node/identity.ts" lines="10-20" hash="34fb155dc41e" blob="a212be6dd6f7" */
const reasonPublished = '只读：这是 build 之后的发布版，评论与任务只能在本机由 gwb 插件 gwb-docsite 启动的站点里写';

/**
 * 每种情况：这台机器（runMode、环境变量里的码、发布版不看码）、名单里命中的行（hitLine，没有命中是 null）、
 * 侧栏底部显示的（person：认出的人；reason：只读原因原话）。
 */
export const cases = [
  {
    id: 'dev-known',
    label: '认出小周',
    text: '开发服务由 gwb-docsite 启动，环境变量里的码在名单里 zhou 那一项：认出小周，侧栏底部显示头像与名字，能写评论。',
    machine: { runMode: 'dev', code: 'zhoucode0001', ignored: false },
    hitLine: 1,
    person: { id: 'zhou', name: '小周', initial: '周' },
    reason: null,
  },
  {
    id: 'dev-no-code',
    label: '没有环境变量',
    text: '自己在终端里启动的开发服务，环境变量里没有码：只读，原因写明这个服务不是经 gwb-docsite 启动的。',
    machine: { runMode: 'dev', code: null, ignored: false },
    hitLine: null,
    person: null,
    reason: reasonNoCode,
  },
  {
    id: 'dev-unknown-code',
    label: '码不在名单里',
    text: '这台机器的码 othercode001 不在名单里：只读，原因里写明调 docsite.people.join 把自己加进去，不写码本身。',
    machine: { runMode: 'dev', code: 'othercode001', ignored: false },
    hitLine: null,
    person: null,
    reason: reasonUnknownCode,
  },
  {
    id: 'start',
    label: '发布版',
    text: 'build 之后用 docsite-serve 启动的发布版一律只读：环境变量里就算有小周的码也不看，写评论回到本机的 dev 里做。',
    machine: { runMode: 'start', code: 'zhoucode0001', ignored: true },
    hitLine: null,
    person: null,
    reason: reasonPublished,
  },
];
