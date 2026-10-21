/**
 * StartCases（「gwb-docsite：文档站插件」那一页）的全部数据，画面（start-cases.tsx）只读这一份。
 * 对一个站调一次 start：SiteHost 走到哪一步、端口怎么定、最后状态是什么。
 * 例子取自插件的测试，站点目录统一写成 /projects/demo/site，本 home 的身份码是 mycode000001；
 * 测试里的开发服务是假的：给了端口就报那个端口，没给报 14000 + 第几次启动，pid 是第几次启动。
 */

/** 共用数据：站点目录、本 home 的身份码、假开发服务报出的地址与 pid */
/* ref file="../plugins/docsite/tests/site-host.test.ts" lines="35-104" hash="ae508326e342" blob="1bb45486b784" */
export const siteDir = '/projects/demo/site'
export const identityCode = 'mycode000001'

/** start 的五步，前一步能下结论就不往下走 */
export const stepNames = ['已在运行或正在启动', '启动前核对', '定端口', '启动开发服务', '推上下文、记端口、转 running']

/** 启动时经环境变量交给开发服务的只有这次启动现生成的推送令牌；身份码等在开发服务报出地址后推进频道 host */
export const envLine = 'DOCSITE_FEED_TOKEN=<这次生成的随机串>'

/** 启动前核对不过的五条原话（站点目录换成例子里同一个可读的路径；Windows 上路径分隔符统一写 /） */
export const refusalMessages = [
  '/projects/demo/site 下没有 package.json，不是站点目录',
  '/projects/demo/site 下没有身份文件 docsite.json：不是 @godcreator/god-docsite 建的站，或是有身份文件之前建的站。平台建的站补一份 { "kind": "<base | docs | collab>", "audience": "<personal | shared>", "format": 2 }；别的站先迁到 @godcreator/god-docsite',
  '/projects/demo/site/docsite.json 的 kind 要是 base / docs / collab 之一，收到 "wiki"',
  '/projects/demo/site 的 node_modules 里没有 @godcreator/god-docsite：还没在站点目录里运行 pnpm install',
  '/projects/demo/site/package.json 的 scripts.dev 写死了 --port：端口由 gwb-docsite 启动时挑，把 --port 和端口号从 scripts.dev 里去掉',
]

/**
 * 每种情况：site-ports 里这个站之前记着的端口（occupancy：none 没记过、free 空着、taken 被占了）、
 * 五步各走成什么样（state：pass 过了往下走，stop 在这一步结束，skip 没走到；stopTone 区分回现状与拒绝或失败）、
 * 第 ④ 步走到时启动的命令（command）、交回（result 的 error 为 true 是抛错）、之后 docsite.site.list 里这个站的样子（after）。
 */
/* ref file="../plugins/docsite/tests/site-host.test.ts" lines="292-306" hash="ea0825f3caab" blob="1bb45486b784" */
export const cases = [
  {
    id: 'first',
    label: '第一次启动',
    text: 'gwb-data 里没记过这个站的端口，不带 --port，由平台的 vite 插件自己挑一个空闲端口。推送令牌经环境变量交给开发服务。开发服务在输出里报出地址后，插件先把托管方上下文（身份码 mycode000001、阅读字体）推进频道 host，再记下这次的端口，状态转成 running。',
    portsBefore: { port: null, occupancy: 'none' },
    portsAfter: { port: 14001, note: '记下 14001' },
    steps: [
      { state: 'pass', note: '不在运行，也没在启动' },
      { state: 'pass', note: '有 package.json 与身份文件、装着平台包、dev 脚本没写 --port' },
      { state: 'pass', note: '没记过 → 不给端口' },
      { state: 'pass', note: '站点自己挑，报出 http://127.0.0.1:14001' },
      { state: 'pass', note: '记下 14001' },
    ],
    command: 'pnpm dev',
    result: { error: false, value: '{ url: "http://127.0.0.1:14001", pid: 1, alreadyRunning: false }' },
    after: [{ state: 'running', url: 'http://127.0.0.1:14001', error: null }],
  },
  {
    id: 'reuse-port',
    label: '停了再启动',
    text: '上次的 14001 此刻空着，就带 --port 14001 启动，地址和上次一样，书签与开着的页面还能用。平台的 vite 插件对给定的端口加 strictPort，被占了就起不来、不会悄悄换一个。',
    portsBefore: { port: 14001, occupancy: 'free' },
    portsAfter: { port: 14001, note: '还是 14001，不重写' },
    steps: [
      { state: 'pass', note: '不在运行，也没在启动' },
      { state: 'pass', note: '核对通过' },
      { state: 'pass', note: '上次的 14001 空着 → --port 14001' },
      { state: 'pass', note: '报出的端口和给的相同' },
      { state: 'pass', note: '记下 14001' },
    ],
    command: 'pnpm dev --port 14001',
    result: { error: false, value: '{ url: "http://127.0.0.1:14001", pid: 2, alreadyRunning: false }' },
    after: [{ state: 'running', url: 'http://127.0.0.1:14001', error: null }],
  },
  {
    id: 'port-taken',
    label: '上次的端口被占了',
    text: '14001 被别的程序占了，每 0.5 秒再查一次，10 秒后还被占着，这次就不带 --port，让站点重新挑，跑起来以后记下新的端口，下次先试它。',
    portsBefore: { port: 14001, occupancy: 'taken' },
    portsAfter: { port: 14003, note: '记下 14003' },
    steps: [
      { state: 'pass', note: '不在运行，也没在启动' },
      { state: 'pass', note: '核对通过' },
      { state: 'pass', note: '14001 等了 10 秒还被占 → 不给端口' },
      { state: 'pass', note: '站点重新挑，报出 http://127.0.0.1:14003' },
      { state: 'pass', note: '记下 14003' },
    ],
    command: 'pnpm dev',
    result: { error: false, value: '{ url: "http://127.0.0.1:14003", pid: 3, alreadyRunning: false }' },
    after: [{ state: 'running', url: 'http://127.0.0.1:14003', error: null }],
  },
  /* ref file="../plugins/docsite/tests/site-ports.test.ts" lines="41-47" hash="07fd55967cd0" blob="03e396ba7210" */
  {
    id: 'reload',
    label: '插件重新加载',
    text: '升级或重载插件时，旧实例卸载时停掉开发服务，新实例马上来查端口，14001 可能还没放开。每 0.5 秒再查一次，放开以后就带 --port 14001 启动，地址不变。',
    portsBefore: { port: 14001, occupancy: 'taken' },
    portsAfter: { port: 14001, note: '还是 14001，不重写' },
    steps: [
      { state: 'pass', note: '新实例里还没有这个站' },
      { state: 'pass', note: '核对通过' },
      { state: 'pass', note: '14001 还被旧进程占着 → 等它空出来 → --port 14001' },
      { state: 'pass', note: '报出的端口和给的相同' },
      { state: 'pass', note: '记下 14001' },
    ],
    command: 'pnpm dev --port 14001',
    result: { error: false, value: '{ url: "http://127.0.0.1:14001", pid: 1, alreadyRunning: false }' },
    after: [{ state: 'running', url: 'http://127.0.0.1:14001', error: null }],
  },
  /* ref file="../plugins/docsite/tests/site-host.test.ts" lines="118-142" hash="5db9fff64079" blob="1bb45486b784" */
  {
    id: 'already',
    label: '已在运行',
    text: '已经有开发服务在跑，直接回它的地址，alreadyRunning 为 true，不再启动第二个。正在启动时又来一次 start，也复用正在启动的那一次。',
    portsBefore: { port: 14001, occupancy: 'free' },
    portsAfter: { port: 14001, note: '还是 14001' },
    steps: [
      { state: 'stop', stopTone: 'reuse', note: '已在运行 → 回现状，不再启动' },
      { state: 'skip', note: '' },
      { state: 'skip', note: '' },
      { state: 'skip', note: '' },
      { state: 'skip', note: '' },
    ],
    command: null,
    result: { error: false, value: '{ url: "http://127.0.0.1:14001", pid: 1, alreadyRunning: true }' },
    after: [{ state: 'running', url: 'http://127.0.0.1:14001', error: null, note: '只启动过一次' }],
  },
  /* ref file="../plugins/docsite/tests/site-host.test.ts" lines="248-265" hash="644eac09b731" blob="1bb45486b784" */
  /* ref file="../plugins/docsite/tests/site-host.test.ts" lines="308-317" hash="0bed967545fc" blob="1bb45486b784" */
  /* ref file="../plugins/docsite/src/site-contract.ts" hash="286215824311" blob="5f97243f4688" */
  {
    id: 'refused',
    label: '启动前核对不过',
    text: '不是站点目录、没有身份文件 docsite.json（旧包 docsite-kit 上的站也是这一条）、身份文件写坏了、没装平台包、dev 脚本写死了 --port，都在启动之前拒绝，不启动进程。状态转成 failed，error 记下拒绝的原话，docsite.site.list 里看得到为什么没起来。',
    portsBefore: { port: null, occupancy: 'none' },
    portsAfter: { port: null, note: '没记过' },
    steps: [
      { state: 'pass', note: '不在运行，也没在启动' },
      { state: 'stop', stopTone: 'refusal', note: '五种拒绝，原话在下面' },
      { state: 'skip', note: '' },
      { state: 'skip', note: '' },
      { state: 'skip', note: '' },
    ],
    command: null,
    refusals: refusalMessages,
    result: { error: true, value: '五种拒绝各抛一条原话' },
    after: [{ state: 'failed', url: null, error: '拒绝的那条原话' }],
  },
  /* ref file="../plugins/docsite/tests/site-host.test.ts" lines="239-246" hash="2ffe71740b6f" blob="1bb45486b784" */
  {
    id: 'launch-fails',
    label: '开发服务没起来',
    text: '60 秒内输出里没有出现地址，插件把整棵进程停掉、报错，状态转成 failed，error 写着原因。先退出、pnpm 启动不了、报出的端口和给的不同，也是这样。',
    portsBefore: { port: null, occupancy: 'none' },
    portsAfter: { port: null, note: '没记过' },
    steps: [
      { state: 'pass', note: '不在运行，也没在启动' },
      { state: 'pass', note: '核对通过' },
      { state: 'pass', note: '没记过 → 不给端口' },
      { state: 'stop', stopTone: 'refusal', note: '60 秒内没报出地址，停掉' },
      { state: 'skip', note: '' },
    ],
    command: null,
    result: { error: true, value: '开发服务 60 秒内没有报出地址，已停掉' },
    after: [{ state: 'failed', url: null, error: '开发服务 60 秒内没有报出地址，已停掉' }],
  },
  /* ref file="../plugins/docsite/src/site-host.ts" lines="107-122" hash="d68d67d2e099" blob="7e3fcf6a0b05" */
  {
    id: 'exited',
    label: '跑着跑着退出了',
    text: '开发服务启动后又退出了，状态转成 failed，error 记下退出码与最后几行输出，末尾写着几秒后自动重启。到时间自动重启，先试上次记下的端口，状态回到 running、error 清空。',
    portsBefore: { port: null, occupancy: 'none' },
    portsAfter: { port: 14001, note: '记下 14001' },
    steps: [
      { state: 'pass', note: '不在运行，也没在启动' },
      { state: 'pass', note: '核对通过' },
      { state: 'pass', note: '没记过 → 不给端口' },
      { state: 'pass', note: '站点自己挑，报出 http://127.0.0.1:14001' },
      { state: 'pass', note: '记下 14001；之后进程退出' },
    ],
    command: 'pnpm dev',
    result: { error: false, value: '{ url: "http://127.0.0.1:14001", pid: 1, alreadyRunning: false }' },
    after: [
      { state: 'failed', url: null, error: '开发服务退出了（退出码 1），最后的输出：\nError: boom\n（2 秒后自动重启，第 1 次）', label: '进程退出后', note: '2 秒后自动重启' },
      { state: 'running', url: 'http://127.0.0.1:14001', error: null, label: '自动重启后' },
    ],
  },
]
