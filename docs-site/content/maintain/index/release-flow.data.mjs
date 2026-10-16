/**
 * ReleaseFlow（「维护」页「发版」一节）的全部数据，画面（release-flow.tsx）只读这一份。
 * 一次发版从本机到 npmjs 走六步：地图上三个方块是本机、GitHub、npmjs，本机下方是过渡期的 Gitea，
 * 当前这一步所在的方块高亮，亮着的箭头是这一步传出去的东西；下面一张卡片摆这一步的命令或经手的东西。
 * 检查跑什么照仓根 AGENTS.md「跑什么检查只看改到了什么」那张表；发版顺序照它同一段的分层；
 * publish.yml 的原话照抄并钉码；第六步「协作相关的包」的名单照「协作站双人回归」页（collab-regression.mdx）开头一段。
 */

/** 地图上的方块；color 的值同时是卡片零件 Role 的名字，最外层样式按 data-id 给它角色色 */
export const places = [
  { id: 'local', label: '本机', color: 'blue' },
  { id: 'github', label: 'GitHub', color: 'violet' },
  { id: 'npmjs', label: 'npmjs', color: 'emerald' },
  { id: 'gitea', label: 'Gitea（过渡期）', color: 'slate' },
];

/** 箭头：这一步传出去的东西。本机到 GitHub 传两样，各一条线各带标签 */
export const flows = [
  { id: 'commit', from: 'local', to: 'github', label: '提交' },
  { id: 'release', from: 'local', to: 'github', label: 'release 与包文件' },
  { id: 'packs', from: 'github', to: 'npmjs', label: '包' },
  { id: 'packs-gitea', from: 'local', to: 'gitea', label: '包' },
];

/** publish.yml 的触发条件（原话） */
/* ref file="../.github/workflows/publish.yml" lines="6-8" hash="cd185e5a6930" blob="23e82029513d" */
export const triggerLines = ['on:', '  release:', '    types: [published]'];

/** publish.yml 下载 release 上包文件的那行（原话，页面里折行显示） */
/* ref file="../.github/workflows/publish.yml" lines="26-26" hash="2e7e5abcbf4e" blob="23e82029513d" */
export const downloadLine =
  'gh release download "${{ github.event.release.tag_name }}" --repo "$GITHUB_REPOSITORY" --pattern \'*.tgz\' --dir packs';

/** 发布循环的头一行（原话） */
/* ref file="../.github/workflows/publish.yml" lines="31-31" hash="5c10a91516e3" blob="23e82029513d" */
export const loopFirstLine = 'for pack in $(ls ./packs/*.tgz | sort); do';

/** 发布循环里真正发包的那行（原话） */
/* ref file="../.github/workflows/publish.yml" lines="37-37" hash="b970d2a9335a" blob="23e82029513d" */
export const publishLine = 'npm publish "$pack" --access public --tag latest --registry https://registry.npmjs.org/';

/** 循环中间给讲解拼的一句白话：原话在 publish.yml 32-35 行，这里只说结论 */
export const loopMiddleNote = '读出包名与版本；已经在 npmjs 上的跳过（重跑时用得上）';

export const steps = [
  {
    title: '发版前的检查（看改到了什么）',
    where: ['local'],
    lit: [],
    role: 'blue',
    card: {
      kind: 'checks',
      title: '发版前的检查',
      icon: 'terminal',
      tiers: [
        {
          tier: '改了包',
          tone: 'info',
          when: '只查改到的包和受它影响的',
          runs: [
            '改到的包 pnpm --filter <包> check；改了导出或类型，下游包也跑',
            '碰到了慢测试测的代码：再跑那个包的 test:slow',
            '站点上看得到的行为：pnpm build 后 pnpm test:e2e --skip-build',
            '动了 exports、files、依赖：pnpm test:pack；动了模板：pnpm test:scaffold',
          ],
        },
        {
          tier: '改了插件',
          tone: 'info',
          when: '测试站不加载插件，e2e 与 test:pack 查不到它',
          runs: ['插件的 check，碰到慢测试再跑 test:slow', 'devkit.dev 装进隔离 home 看一眼'],
        },
        {
          tier: '升共用依赖',
          tone: 'warn',
          when: 'fumadocs、react-router、vite、catalog 里的版本：哪个包都可能坏',
          runs: ['pnpm verify', 'pnpm test:pack'],
        },
      ],
      note: '版本号升哪一位不影响跑什么。升 git 或改了 gwb-collab 的 setup/、fetch/ 另跑 plugins/collab 的 pnpm test:verified。从干净的工作树发时检出后只装依赖，构建与产物核对由 devkit.release 自己做。',
    },
    text: '发版前跑什么检查只看改到了什么：改了包只查那个包和受它影响的，改了插件查插件并装进隔离 home 看一眼，只有升共用依赖时才跑全量 pnpm verify 再 pnpm test:pack。',
  },
  {
    title: '推 HEAD 到 GitHub',
    where: ['local'],
    lit: ['commit'],
    role: 'blue',
    card: {
      kind: 'command',
      title: '推 HEAD',
      icon: 'git',
      lines: [
        'git push',
        'devkit.release 只从干净的工作区发，要求 HEAD 已经推上去',
        '工作区不干净时：git worktree add --detach <仓外目录> <已推送的提交>，从那里发',
      ],
    },
    text: 'HEAD 先推到 GitHub。卡在这一步的多是工作区不干净——别的会话有没提交的改动时，用 git worktree 检出一份已推送的提交，从那里发。',
  },
  {
    title: 'devkit.release 组装',
    where: ['local'],
    lit: ['release', 'packs-gitea'],
    role: 'blue',
    card: {
      kind: 'command',
      title: 'devkit.release',
      icon: 'terminal',
      lines: [
        '构建、检查要发的包',
        '过渡期：~/.npmrc 里 @godcreator 的范围行指向 Gitea，先把同样的包发一份到 Gitea 的源',
        '把要发的包打好包文件（*.tgz），在已经推上去的 HEAD 上建 GitHub release，附上包文件',
      ],
    },
    text: 'devkit.release 在本机构建、检查；过渡期照 ~/.npmrc 里 @godcreator 的范围行先把同样的包发一份到 Gitea 的源，不用另加参数；再打好包文件，在 HEAD 上建 GitHub release 附上包文件。本机构建或检查失败就停在这里，什么都没发出去。',
  },
  {
    title: '工作流被触发',
    where: ['github'],
    lit: [],
    role: 'violet',
    card: {
      kind: 'yaml',
      title: '.github/workflows/publish.yml',
      icon: 'server',
      lines: [...triggerLines, downloadLine],
      note: 'trusted publishing（OIDC）向 npmjs 证明发的是这个仓的工作流，不存 token。',
    },
    text: 'release 公开触发仓里的工作流 publish.yml：它下载 release 上的包文件，用 trusted publishing 向 npmjs 证明自己是这个仓的工作流，不存 token。',
  },
  {
    title: '按序号发到 npmjs',
    where: ['github', 'npmjs'],
    lit: ['packs'],
    role: 'emerald',
    card: {
      kind: 'tiers',
      title: '按序号发到 npmjs',
      icon: 'server',
      loopLines: [
        { kind: 'code', text: loopFirstLine },
        { kind: 'note', text: loopMiddleNote },
        { kind: 'code', text: publishLine },
      ],
      tiers: [
        { label: '第 0 层', packs: ['god-docsite', 'identity', 'explainer', 'code-pin', 'trajectory'] },
        { label: '第 1 层', packs: ['comments', 'doc-export'] },
        { label: '第 2 层', packs: ['collab', 'docfirst', 'word-report'] },
        { label: '插件', packs: ['gwb-docsite', 'gwb-collab'] },
      ],
    },
    text: '工作流按文件名的序号逐个 npm publish，顺序就是依赖序：被依赖的包先上线。中途失败重跑即可，已经在 npmjs 上的跳过。',
  },
  {
    title: '协作相关的发完以后',
    where: [],
    lit: [],
    role: 'slate',
    card: {
      kind: 'regression',
      title: '协作站双人回归',
      icon: 'user',
      packs: ['collab', 'comments', 'identity', 'god-docsite', 'gwb-collab', 'gwb-docsite'],
      note: '其中任何一个发过之后：负责人与成员两台电脑照「协作站双人回归」的 11 项走一遍（主流程 8 项、冲突和无法合并 3 项）。',
    },
    text: '发了协作相关的包或插件之后，照「协作站双人回归」的清单在两台电脑上走一遍——这一步不在图上那三处里。',
  },
];
