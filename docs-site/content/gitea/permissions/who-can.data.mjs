/**
 * WhoCanCases（「权限怎么配」那一页开头四层列表之后）的全部数据，画面（who-can.tsx）只读这一份。
 * 同一个人想做同一件事，权限分四层：团队、协作者（负责人）、main 的分支保护、合并方式；
 * 每种情况四条横带各写这一层说了什么（pass 放行 / block 拦下 / dim 不相关），拦下的那一层加粗，末尾一行结果。
 * 规则出自插件里两套规矩与共用的那一份（钉在下面），每层的设置界面见本页各节；贯穿例子沿用 hybrid-mmc，
 * bob、carol 是成员，admin 是组织管理员兼项目负责人，firmware 是项目里另一个仓，合并请求编号用 #7。
 */

/** 两种仓对 main 的推送与合并许可：协作仓谁都不能直接推、只许团队 bots 合并；别的仓只许负责人 */
/* ref file="../plugins/collab/src/collab-repo/rules.ts" lines="5-6" hash="0388cffaba4b" blob="8a21ad292d30" */
/* ref file="../plugins/collab/src/other-repos/rules.ts" lines="6-7" hash="959a02972c7e" blob="fb15573dde28" */
/* ref file="../plugins/collab/src/gitea-api/repo-rules.ts" lines="9-24" hash="357247b36c3d" blob="631b1b85c24d" */
export const mainRules = {
  collab: '推送 nobody · 合并 executor（团队 bots）',
  other: '推送 leads · 合并 leads（负责人）',
};

/** 四层的名字，横带从上到下按这个顺序 */
export const layers = [
  { id: 'team', name: '团队' },
  { id: 'lead', name: '协作者（负责人）' },
  { id: 'protection', name: 'main 的分支保护' },
  { id: 'style', name: '合并方式' },
];

/**
 * @typedef {'pass' | 'block' | 'dim'} RowState
 * @typedef {{ what: string, state: RowState }} LayerRow
 * @typedef {{ id: string, label: string, text: string, rows: LayerRow[], outcome: { tone: 'good' | 'bad', label: string } }} WhoCase
 */

/** @type {WhoCase[]} */
export const cases = [
  {
    id: 'bob-push-collab-main',
    label: 'bob 直接推协作仓 main',
    text: 'bob 在 members 团队里有代码写权限，但协作仓 main 的推送是关掉的（接口里 enable_push 为假），许可里谁都没有。要进 main 只能推成合并请求等执行器（下一种情况）。',
    rows: [
      { what: 'members 代码可写：有推分支的权限', state: 'pass' },
      { what: 'bob 不是协作仓的负责人', state: 'dim' },
      { what: '推送关掉：谁都不能直接推', state: 'block' },
      { what: '不经合并请求，这层不参与', state: 'dim' },
    ],
    outcome: { tone: 'bad', label: 'Gitea 拒绝这次推送' },
  },
  {
    id: 'bob-agit',
    label: 'bob 推成合并请求',
    text: 'bob 让 AI 调 collab.submit，用 AGit 推 HEAD:refs/for/main：团队给了写权限就推得上，Gitea 拿它开出合并请求 #7。推到 refs/for/main 的提交不进任何分支，分支保护与合并方式这一步都管不着。',
    rows: [
      { what: 'members 代码可写：推得上 refs/for/main', state: 'pass' },
      { what: '开合并请求不需要是负责人', state: 'dim' },
      { what: '不改 main，保护管不着', state: 'dim' },
      { what: '要进 main 时这层才参与', state: 'dim' },
    ],
    outcome: { tone: 'good', label: '开出合并请求 #7，等执行器' },
  },
  {
    id: 'admin-push-collab-main',
    label: '负责人推协作仓 main',
    text: 'admin 是组织管理员，也是协作仓的负责人：两层身份都不放行直接推。协作仓 main 的推送许可里谁都没有，负责人也一样，改动要经执行器的检查进 main。',
    rows: [
      { what: 'Owners 对全部仓是所有者', state: 'pass' },
      { what: '管理权限管的是改设置，与直接推送无关', state: 'dim' },
      { what: '推送许可里没有负责人：照样拦下', state: 'block' },
      { what: '不经合并请求，这层不参与', state: 'dim' },
    ],
    outcome: { tone: 'bad', label: '照样拒绝' },
  },
  {
    id: 'bot-merge',
    label: '执行器合并 #7',
    text: '执行器用 collab-bot 的令牌调合并接口：bots 团队只含协作仓、代码可写，main 的合并许可里只写了团队 bots，放行；以合并提交进 main（压缩合并、变基合并都关着）。',
    rows: [
      { what: 'collab-bot 在 bots：只含协作仓，代码可写', state: 'pass' },
      { what: 'collab-bot 不是协作者，不算负责人', state: 'dim' },
      { what: '合并许可只有团队 bots：放行', state: 'pass' },
      { what: '只开合并提交与仅快进：合并提交进 main', state: 'pass' },
    ],
    outcome: { tone: 'good', label: '#7 进 main，合并人是 collab-bot' },
  },
  {
    id: 'carol-push-firmware-main',
    label: 'carol 推 firmware 的 main',
    text: 'firmware 是项目里另一个仓：members 团队照旧给 carol 写权限，但别的仓 main 的推送许可只写负责人的用户名，carol 不是 firmware 的协作者，不在许可里。',
    rows: [
      { what: 'members 代码可写', state: 'pass' },
      { what: 'carol 不是 firmware 的负责人', state: 'dim' },
      { what: '推送许可只有负责人：carol 不在', state: 'block' },
      { what: '不经合并请求，这层不参与', state: 'dim' },
    ],
    outcome: { tone: 'bad', label: 'Gitea 拒绝这次推送' },
  },
  {
    id: 'admin-push-firmware-main',
    label: '负责人推 firmware 的 main',
    text: 'admin 是 firmware 的负责人，正是推送许可里写的人：直接推得进 main，不经合并请求，合并方式这一层不参与。',
    rows: [
      { what: 'Owners 对全部仓是所有者', state: 'pass' },
      { what: 'admin 是 firmware 的协作者（负责人）', state: 'pass' },
      { what: '推送许可写了负责人：放行', state: 'pass' },
      { what: '不经合并请求，这层不参与', state: 'dim' },
    ],
    outcome: { tone: 'good', label: '推进 main' },
  },
  {
    id: 'carol-branch',
    label: 'carol 推自己的分支',
    text: '推 firmware 里自己的分支不碰 main：团队给了写权限就推得上，分支保护只管 main。之后在 Gitea 网页上开合并请求，等负责人审。',
    rows: [
      { what: 'members 代码可写', state: 'pass' },
      { what: '推自己的分支不需要是负责人', state: 'dim' },
      { what: '不碰 main，保护管不着', state: 'dim' },
      { what: '开合并请求后、要进 main 时才参与', state: 'dim' },
    ],
    outcome: { tone: 'good', label: '分支推上去' },
  },
];
