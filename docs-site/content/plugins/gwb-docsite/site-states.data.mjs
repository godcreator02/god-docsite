/**
 * SiteStates（「gwb-docsite：文档站插件」那一页）的全部数据，画面（site-states.tsx）只读这一份。
 * 一个站的三种状态由哪些事件转换、哪些操作幂等。站点目录沿用本页例子的 /projects/demo/site。
 * 报错与 error 原话逐字照抄 site-host.ts 与它的测试；错误里的站点目录换成例子里同一个路径。
 */

/** 三种状态的定义：running 进程在；stopped 没有进程；failed 退出了或没能启动（error 记原因） */
/* ref file="../plugins/docsite/src/site-host.ts" lines="7-13" hash="df7ebb7f1f35" blob="c6df7cdcd9ac" */

/** stop 对没在运行的站报错，原话逐字照抄（模板里的 dir 换成例子的站点目录） */
/* ref file="../plugins/docsite/src/site-host.ts" lines="143-155" hash="cbdce1c29734" blob="c6df7cdcd9ac" */
export const stopNotRunningMessage = '/projects/demo/site 的站点没在运行'

/** 启动前核对不过的报错原话（四条里的第一条，模板里的 dir 换成例子的站点目录） */
/* ref file="../plugins/docsite/src/site-host.ts" lines="44-49" hash="d22e16af9b99" blob="c6df7cdcd9ac" */
export const refusedMessage = '/projects/demo/site 下没有 package.json，不是站点目录'

/** 进程退出记下的原因，逐字照抄测试断言（fake 服务退出的 reason 与 dev-server 生成的格式相同） */
/* ref file="../plugins/docsite/tests/site-host.test.ts" lines="129-141" hash="1945645e1b52" blob="62f2145859ee" */
export const exitMessage = '开发服务退出了（退出码 1），最后的输出：\nError: boom'

/** 状态图的画布：三个圆角框与带事件的箭头；tone 决定箭头颜色（info 是人为发出的命令，bad 是进程自己出的事） */
export const diagram = {
  view: { w: 660, h: 268 },
  boxes: [
    { id: 'stopped', x: 60, y: 100, w: 130, label: 'stopped' },
    { id: 'running', x: 265, y: 100, w: 130, label: 'running' },
    { id: 'failed', x: 470, y: 100, w: 130, label: 'failed' },
  ],
  edges: [
    {
      id: 'start',
      tone: 'info',
      d: 'M125,100 C150,48 250,48 288,96',
      label: 'start',
      labelAt: [200, 50],
      note: '正在启动时再来的 start 复用同一次',
      noteAt: [200, 30],
    },
    { id: 'reuse', tone: 'info', d: 'M330,100 C330,62 370,62 368,96', label: '再 start：返回现状', labelAt: [352, 46] },
    { id: 'stop', tone: 'info', d: 'M330,148 C300,190 160,190 127,152', label: 'stop（人为停，不算失败）', labelAt: [227, 166] },
    { id: 'exit', tone: 'bad', d: 'M395,124 H466', label: '进程退出', labelAt: [430, 112] },
    { id: 'refuse', tone: 'bad', d: 'M145,148 C230,252 450,252 530,152', label: '核对不过 / 没能启动', labelAt: [335, 240] },
  ],
}

/**
 * 每种情况：lit 是高亮的箭头 id（空数组表示没有状态转换，全部箭头淡下去）；
 * states 里 to 是这次停在哪个状态（框加粗）；list 是 docsite.site.list 里这个站的行；
 * thrown 是这次操作抛出的报错（不进 list）。
 */
export const cases = [
  {
    id: 'start',
    label: 'start',
    lit: ['start'],
    states: { to: 'running' },
    list: { state: 'running', url: 'http://127.0.0.1:14001', error: null },
    thrown: null,
    text: '从 stopped 启动：启动前核对过了、进程起来了、在输出里等到了地址，状态转成 running，url 是开发服务报出的实际地址，端口记进 site-ports。',
  },
  {
    id: 'start-again',
    label: '已在运行再 start',
    lit: ['reuse'],
    states: { to: 'running' },
    list: { state: 'running', url: 'http://127.0.0.1:14001', error: null },
    thrown: null,
    text: '已经在 running，再 start 直接返回现状：同一个 url 与 pid，alreadyRunning 为 true，不启动第二个开发服务——start 幂等。',
  },
  {
    id: 'start-while-starting',
    label: '正在启动时再来 start',
    lit: ['start'],
    states: { to: 'running' },
    list: { state: 'running', url: 'http://127.0.0.1:14001', error: null },
    thrown: null,
    text: '上一次 start 还没结束（还在等开发服务报出地址），这时再来的 start 复用正在启动的那一次，不重复 spawn；两次调用拿到同一份结果。',
  },
  {
    id: 'stop',
    label: 'stop',
    lit: ['stop'],
    states: { to: 'stopped' },
    list: { state: 'stopped', url: null, error: null },
    thrown: null,
    text: '人为停掉：running 转回 stopped，url 与 error 都清空。人为停不算失败——stop 先把 running 拿掉，进程的退出事件看到它已经不在运行，就不记 error。',
  },
  {
    id: 'stop-not-running',
    label: '没在运行就 stop',
    lit: [],
    states: { to: 'stopped' },
    list: { state: 'stopped', url: null, error: null },
    thrown: stopNotRunningMessage,
    text: 'stop 对没在运行的站直接报错，状态不变。正在启动的先等那一次结束（成了 running 就停，没成也报这一条）。',
  },
  {
    id: 'exit',
    label: '进程自己退出',
    lit: ['exit'],
    states: { to: 'failed' },
    list: { state: 'failed', url: null, error: exitMessage },
    thrown: null,
    text: '开发服务启动后又退出了：状态转成 failed，error 记退出码与最后几行输出。不自动重启；修好后再 start，状态回 running、error 清空。',
  },
  {
    id: 'refused',
    label: '启动前核对不过',
    lit: ['refuse'],
    states: { to: 'failed' },
    list: { state: 'failed', url: null, error: refusedMessage },
    thrown: null,
    text: '不是站点目录、node_modules 里没有平台包、建在旧包 docsite-kit 上、dev 脚本写死了 --port：都在启动之前拒绝，不 spawn 进程，状态转成 failed，error 记拒绝的原话。',
  },
]
