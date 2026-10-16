/**
 * ReleaseFlow（「维护」页「发版」一节）的全部数据，画面（release-flow.tsx）只读这一份。
 * 一次发版从本机到 npmjs 走六步：地图上三个方块是本机、GitHub、npmjs，本机下方挂过渡期的 Gitea，
 * 当前这一步所在的方块高亮，亮着的箭头是这一步传出去的东西；下面一张卡片摆这一步的命令或经手的东西。
 * 两档的判别条件与跑什么照仓根 AGENTS.md「发版前的检查分两档」那张表；发版顺序照它同一段的分层；
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
    title: '发版前的检查（两档）',
    where: ['local'],
    lit: [],
    role: 'blue',
    card: {
      kind: 'checks',
      title: '发版前的检查',
      icon: 'terminal',
      tiers: [
        {
          tier: '小改动',
          tone: 'info',
          when: '只改一两个包的源码、样式或说明书；没动 exports、files、依赖；没改模板；只升 y',
          runs: [
            '改到的包 pnpm --filter <包> check',
            '碰到了慢测试测的代码：再加跑那个包的 test:slow',
            '改了页面上的交互：pnpm build 后 pnpm test:e2e --skip-build',
          ],
        },
        {
          tier: '全量',
          tone: 'warn',
          when: '其余所有情况；拿不准算哪档就按全量',
          runs: ['pnpm verify', 'pnpm test:pack'],
        },
      ],
      note: '发 gwb-collab 时另在 plugins/collab 里跑一遍 pnpm test:verified，不分档。',
    },
    text: '发版前的检查按这次要发的改动分两档：小改动只查改到的包，其余情况跑全量 pnpm verify 再 pnpm test:pack；发 gwb-collab 时另跑 plugins/collab 的 pnpm test:verified，不分档。',
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
        '构建、检查，把要发的包打好包文件（*.tgz）',
        '在已经推上去的 HEAD 上建 GitHub release，挂上包文件',
        '过渡期加 alsoPublishTo：同样的包再发一份到 Gitea 的源',
      ],
    },
    text: 'devkit.release 在本机构建、检查、打好包文件，在 HEAD 上建 GitHub release 挂上包文件；过渡期加 alsoPublishTo，同样的包再发一份到 Gitea 的源。本机构建失败就停在这里，什么都没发出去。',
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
        { label: '第 0 层', packs: ['god-docsite', 'identity', 'explainer', 'code-pin', 'trajectory', 'word-report'] },
        { label: '第 1 层', packs: ['comments', 'doc-export'] },
        { label: '第 2 层', packs: ['collab', 'docfirst'] },
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
