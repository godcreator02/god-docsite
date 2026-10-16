/**
 * OriginCases（「god-docsite：平台包」那一页「vite 插件、端口与可信来源」一节）的全部数据，画面（origin-cases.tsx）只读这一份。
 * 写入请求的 Origin 头要对上的那个值（siteOrigin）怎么算：五种情况各两块——左「环境变量」列这种情况下有的几项（没有的灰掉），
 * 右「siteOrigin」写算出的值或报错原话。只有 dev 情况多一组「浏览器发来的 Origin」：对上能写、对不上 403，各一次。
 * 环境变量的值是拼的示例；算出的规则与报错原话逐字照 origin.server.ts，端口号用本站开发服务现在的。
 */

/** siteOrigin 的规则：设了 DOCSITE_ORIGIN 就是它；dev 取 vite 插件写的 DOCSITE_DEV_ORIGIN；start 取 HOST（缺省 localhost）与 PORT */
/* ref file="../packages/god-docsite/src/site/origin.server.ts" lines="19-36" hash="fa5abe38e24b" blob="47bff7857623" */

/** dev 情况那组「对不上 → 403」的原话：模板串里的 origin 换成该情况的 siteOrigin（核对在 identity 包的 authorizeWrite，评论、任务这些写入 action 都先过它） */
/* ref file="../packages/identity/src/core/write-access.ts" lines="26-31" hash="41352bc61db5" blob="e485df6ac0fa" */

export const cases = [
  {
    id: 'explicit',
    label: '设了 DOCSITE_ORIGIN',
    text: '经反向代理访问这类场景直接指定：设了就只认它，dev、start 都一样，其余环境变量不再看。值要正好是 origin（协议、主机、端口），带路径会被拒。',
    mode: 'dev 或 start 都一样',
    vars: [
      { name: 'DOCSITE_ORIGIN', value: 'http://192.168.1.10:8080', present: true, note: '给了就只认它' },
      { name: 'DOCSITE_DEV_ORIGIN', value: null, present: false, note: '不再看' },
      { name: 'PORT', value: null, present: false, note: '不再看' },
      { name: 'HOST', value: null, present: false, note: '不再看' },
    ],
    outcome: { tone: 'good', lines: ['http://192.168.1.10:8080'] },
    checks: [],
  },
  {
    id: 'dev',
    label: 'dev：godDocsite() 启动',
    text: '开发服务开始监听时，vite 插件把地址写进 DOCSITE_DEV_ORIGIN（服务端代码与 Vite 在同一个进程里），siteOrigin 用它。端口号是本站开发服务现在的，启动时可能换。',
    mode: 'dev',
    vars: [
      { name: 'DOCSITE_DEV_ORIGIN', value: 'http://localhost:18148', present: true, note: 'vite 插件监听后写' },
      { name: 'DOCSITE_ORIGIN', value: null, present: false, note: '没设' },
      { name: 'PORT', value: null, present: false, note: 'start 才看' },
      { name: 'HOST', value: null, present: false, note: 'start 才看' },
    ],
    outcome: { tone: 'good', lines: ['http://localhost:18148'] },
    checks: [
      { tone: 'good', text: '浏览器 Origin: http://localhost:18148 与 siteOrigin 相同 → 能写' },
      { tone: 'bad', text: '浏览器 Origin: http://localhost:3000 对不上 → 403「写入只接受来自 http://localhost:18148 的请求」' },
    ],
  },
  {
    id: 'dev-missing',
    label: 'dev：没经 godDocsite() 启动',
    text: '直接用 react-router dev（没走平台的 vite 插件）就没有 DOCSITE_DEV_ORIGIN，siteOrigin 算不出来——报错里两条出路都写了。',
    mode: 'dev',
    vars: [
      { name: 'DOCSITE_DEV_ORIGIN', value: null, present: false, note: '没有' },
      { name: 'DOCSITE_ORIGIN', value: null, present: false, note: '没设' },
      { name: 'PORT', value: null, present: false, note: 'start 才看' },
      { name: 'HOST', value: null, present: false, note: 'start 才看' },
    ],
    outcome: {
      tone: 'bad',
      lines: ['Error: 算不出可信 origin：开发服务没经平台的 vite 插件 godDocsite() 启动（它定下端口后写 DOCSITE_DEV_ORIGIN），或者设 DOCSITE_ORIGIN'],
    },
    checks: [],
  },
  {
    id: 'start',
    label: 'start：docsite-serve 启动',
    text: '发布版由 docsite-serve 启动：它挑端口、设 PORT；HOST 没写按 localhost。',
    mode: 'start',
    vars: [
      { name: 'PORT', value: '3000', present: true, note: 'docsite-serve 设' },
      { name: 'HOST', value: null, present: false, note: '缺省 localhost' },
      { name: 'DOCSITE_ORIGIN', value: null, present: false, note: '没设' },
      { name: 'DOCSITE_DEV_ORIGIN', value: null, present: false, note: 'dev 才写' },
    ],
    outcome: { tone: 'good', lines: ['http://localhost:3000'] },
    checks: [],
  },
  {
    id: 'start-no-port',
    label: 'start：没设 PORT',
    text: '没走 docsite-serve（比如直接 react-router-serve）就没设 PORT——react-router-serve 会自己挑空闲端口，所以这里直接报错，不猜。',
    mode: 'start',
    vars: [
      { name: 'PORT', value: null, present: false, note: '没设' },
      { name: 'HOST', value: null, present: false, note: '缺省 localhost' },
      { name: 'DOCSITE_ORIGIN', value: null, present: false, note: '没设' },
      { name: 'DOCSITE_DEV_ORIGIN', value: null, present: false, note: 'dev 才写' },
    ],
    outcome: {
      tone: 'bad',
      lines: ['Error: 算不出可信 origin：发布版用 docsite-serve 启动（它挑端口、设 PORT），或者设环境变量 PORT 或 DOCSITE_ORIGIN'],
    },
    checks: [],
  },
];
