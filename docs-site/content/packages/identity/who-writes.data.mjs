/**
 * WhoWrites（「identity：身份」那一页「一次写入以谁的身份」）的全部数据，画面（who-writes.tsx）只读这一份。
 * 一个例子贯穿七种情况：名单里有小周（zhou，码 zhoucode0001）、小李（li，没有码）、Claude（claude，agent），
 * 站点的可信 origin 是 http://127.0.0.1:4430。一次写入先认人（运行方式、身份码，只得出「本机是谁或只读」，
 * 不拒绝请求），再过 authorizeWrite（Origin、本机身份、as）。名单、码与原因原文都照 identity 包的源码和测试抄。
 */

/** 判定的五步：后三步是 authorizeWrite 的核对顺序，前两步只认人 */
/* ref file="../packages/identity/src/core/write-access.ts" lines="29-38" hash="4e0bfa531ed8" blob="e485df6ac0fa" */
export const stepNames = ['运行方式（dev 还是 start）', '身份码在名单里', 'Origin 头等于可信 origin', '有本机身份', 'as'];

/** 例子的名单（照 peopleFileText 的格式，一项一行）与可信 origin */
/* ref file="../packages/identity/test/write-access.test.ts" lines="4-10" hash="b8a2bfd59677" blob="52d5ba27187e" */
export const peopleLines = [
  '{"id":"zhou","name":"小周","codes":["zhoucode0001"]},',
  '{"id":"li","name":"小李"},',
  '{"id":"claude","name":"Claude","agent":true}',
];

export const trustedOrigin = 'http://127.0.0.1:4430';
const otherOrigin = 'http://evil.example';

/** 身份码在托管方上下文里的字段名：gwb-docsite 推进频道 host，站点模板取出来交给 siteIdentity */
export const codeField = 'identityCode';

/** 认人得出的只读原因，照源码抄；第二条里源码的 ${peopleFile} 展开成 people.json */
/* ref file="../packages/identity/src/core/identity.ts" lines="11-16" hash="8913bef4311f" blob="7b82e260a0c2" */
const reasonNoCode = '只读：这个开发服务不是经 gwb 插件 gwb-docsite 启动的，没有本机的身份码';
const reasonUnknownCode = '只读：本机的身份码不在 people.json 里，调 docsite.people.join 把自己加进去';

/** 发布版的只读原因；start 不看身份码 */
/* ref file="../packages/identity/src/node/identity.ts" lines="7-17" hash="4741e40c4e28" blob="2efe309e3dd1" */
const reasonPublished = '只读：这是 build 之后的发布版，评论与任务只能在本机由 gwb 插件 gwb-docsite 启动的站点里写';

/** authorizeWrite 的拒绝原因与状态码，照源码抄；第一条里源码的 ${origin} 展开成可信 origin */
/* ref file="../packages/identity/src/core/write-access.ts" lines="29-38" hash="4e0bfa531ed8" blob="e485df6ac0fa" */
const reasonOtherOrigin = '写入只接受来自 http://127.0.0.1:4430 的请求';
const reasonAsPerson = 'as 只给 agent 用：li 不是 agent，人的身份取本机的身份码';

/**
 * 每种情况：这台机器（machine：运行方式、托管方上下文里的码、发布版不看码）、写入请求（request：Origin 头、as）、
 * 名单里命中的行（hitLine：本机身份认出的那一项，没有命中的是 null）、as 指向的 agent（asPointsAt，只代 agent 写时有）、
 * 五步各走成什么样（steps）、结论（outcome：HTTP 状态、以谁写、原因原文或返回的对象、侧栏显示）。
 * steps 的 state：pass 通过；readonly 得出只读，往下走；reject 在这一步被拒；skip 没走到或不看。
 * 第 1、2 步不拒绝请求：只读时请求照样走到 Origin 一步，在没有本机身份那一步被拒。
 */
export const cases = [
  {
    id: 'self',
    label: '本机写',
    text: '开发服务由 gwb-docsite 启动，托管方上下文里的码 zhoucode0001 在名单里 zhou 那一项。请求从站点自己的页面发出，Origin 对得上；没写 as，以当前身份写。返回的人只有 id 和 name，codes 不带出去。',
    machine: { runMode: 'dev', code: 'zhoucode0001', ignored: false },
    request: { origin: trustedOrigin, as: null },
    hitLine: 1,
    asPointsAt: null,
    steps: [
      { state: 'pass', note: 'dev：本机由 gwb-docsite 启动的开发服务' },
      { state: 'pass', note: '托管方上下文里的码在 zhou 那一项' },
      { state: 'pass', note: 'Origin 头和可信 origin 完全一样' },
      { state: 'pass', note: '认出了小周' },
      { state: 'pass', note: '没写 as，用当前身份' },
    ],
    outcome: { http: 200, writes: '以 zhou 写', detail: '返回 { id: "zhou", name: "小周" }，没有 codes', sidebar: '小周' },
  },
  {
    id: 'no-code',
    label: '没经 gwb 启动',
    text: '自己在终端里 pnpm dev 起的开发服务，没有托管方上下文，也就没有码。认人得出只读，请求来源没问题，但没有本机身份，403，原因就是侧栏「只读」上看到的那句。',
    machine: { runMode: 'dev', code: null, ignored: false },
    request: { origin: trustedOrigin, as: null },
    hitLine: null,
    asPointsAt: null,
    steps: [
      { state: 'pass', note: 'dev：开发服务，但是自己在终端里启动的' },
      { state: 'readonly', note: '没有托管方上下文，也就没有码' },
      { state: 'pass', note: 'Origin 头和可信 origin 完全一样' },
      { state: 'reject', note: '没有本机身份' },
      { state: 'skip', note: '没走到' },
    ],
    outcome: { http: 403, writes: '拒绝', detail: reasonNoCode, sidebar: '只读' },
  },
  {
    id: 'unknown-code',
    label: '码不在名单里',
    text: '这台机器的码 othercode001 不在 people.json 里，只读。原因里写明调 docsite.people.join 把自己加进去，不写码本身。',
    machine: { runMode: 'dev', code: 'othercode001', ignored: false },
    request: { origin: trustedOrigin, as: null },
    hitLine: null,
    asPointsAt: null,
    steps: [
      { state: 'pass', note: 'dev：本机由 gwb-docsite 启动的开发服务' },
      { state: 'readonly', note: '码 othercode001 不在名单里' },
      { state: 'pass', note: 'Origin 头和可信 origin 完全一样' },
      { state: 'reject', note: '没有本机身份' },
      { state: 'skip', note: '没走到' },
    ],
    outcome: { http: 403, writes: '拒绝', detail: reasonUnknownCode, sidebar: '只读' },
  },
  {
    id: 'published',
    label: '发布版',
    text: 'build 之后用 docsite-serve 启动的发布版一律只读，托管方上下文里就算有小周的码也不看。写评论回到本机的 dev 里做，改完经 git 同步。',
    machine: { runMode: 'start', code: 'zhoucode0001', ignored: true },
    request: { origin: trustedOrigin, as: null },
    hitLine: null,
    asPointsAt: null,
    steps: [
      { state: 'readonly', note: 'start：build 之后的发布版，一律只读' },
      { state: 'skip', note: '不看' },
      { state: 'pass', note: 'Origin 头和可信 origin 完全一样' },
      { state: 'reject', note: '没有本机身份' },
      { state: 'skip', note: '没走到' },
    ],
    outcome: { http: 403, writes: '拒绝', detail: reasonPublished, sidebar: '只读' },
  },
  {
    id: 'other-origin',
    label: '别处发来的请求',
    text: '本机身份是小周，但请求的 Origin 是别的网站。可信 origin 由宿主配置、不从请求推导，对不上直接 403，后面几步不看。',
    machine: { runMode: 'dev', code: 'zhoucode0001', ignored: false },
    request: { origin: otherOrigin, as: null },
    hitLine: 1,
    asPointsAt: null,
    steps: [
      { state: 'pass', note: 'dev：本机由 gwb-docsite 启动的开发服务' },
      { state: 'pass', note: '托管方上下文里的码在 zhou 那一项' },
      { state: 'reject', note: 'Origin 头是别的网站' },
      { state: 'skip', note: '没走到' },
      { state: 'skip', note: '没走到' },
    ],
    outcome: { http: 403, writes: '拒绝', detail: reasonOtherOrigin, sidebar: '小周' },
  },
  {
    id: 'as-agent',
    label: '代 agent 写',
    text: '小周经命令替 Claude 提交，写 as: claude。claude 是名单里登记的 agent，这次以 Claude 的身份写。agent 没有身份码，只能这样写入。',
    machine: { runMode: 'dev', code: 'zhoucode0001', ignored: false },
    request: { origin: trustedOrigin, as: 'claude' },
    hitLine: 1,
    asPointsAt: 'claude',
    steps: [
      { state: 'pass', note: 'dev：本机由 gwb-docsite 启动的开发服务' },
      { state: 'pass', note: '托管方上下文里的码在 zhou 那一项' },
      { state: 'pass', note: 'Origin 头和可信 origin 完全一样' },
      { state: 'pass', note: '认出了小周' },
      { state: 'pass', note: 'as 指向登记的 agent claude' },
    ],
    outcome: { http: 200, writes: '以 claude 写', detail: '返回 { id: "claude", name: "Claude", agent: true }', sidebar: '小周' },
  },
  {
    id: 'as-person',
    label: '想换成别人',
    text: 'as 写成 li，li 是人不是 agent，403。人的身份只取本机的身份码，不能经请求换成别人。',
    machine: { runMode: 'dev', code: 'zhoucode0001', ignored: false },
    request: { origin: trustedOrigin, as: 'li' },
    hitLine: 1,
    asPointsAt: null,
    steps: [
      { state: 'pass', note: 'dev：本机由 gwb-docsite 启动的开发服务' },
      { state: 'pass', note: '托管方上下文里的码在 zhou 那一项' },
      { state: 'pass', note: 'Origin 头和可信 origin 完全一样' },
      { state: 'pass', note: '认出了小周' },
      { state: 'reject', note: 'as 写成 li，li 是人不是 agent' },
    ],
    outcome: { http: 403, writes: '拒绝', detail: reasonAsPerson, sidebar: '小周' },
  },
];
