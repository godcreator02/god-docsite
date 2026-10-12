/**
 * 合并检查包 @godcreator/collab-merge-check 的包内接缝图（合并检查包首页用）：虚线框是 src/ 下的 3 个文件与随包发布的 templates/，
 * 上面是两个使用方（gwb-collab、NAS 上的执行器），下面是 Gitea 上的协作仓。坐标在 collab-merge-check.layout.ts。
 */
import { defineSeamGraph } from '@godcreator/docsite-explainer/seam-graph';

/** @type {import('@godcreator/docsite-explainer/seam-graph').SeamModule[]} */
const modules = [
  {
    id: 'plugin-out',
    name: 'gwb-collab',
    pkg: '@godcreator/gwb-collab',
    role: null,
    outside: true,
    blurb: '提交审核在推送前用出口 . 查一次只有负责人能改的内容，查到就不推送、改动退回工作区。用的是插件发版时打包的那一版。',
    caps: [{ id: 'submit', name: '推送前检查', ident: 'collab.submit' }],
  },
  {
    id: 'runner',
    name: 'NAS 执行器',
    pkg: 'gitea-runner',
    role: null,
    outside: true,
    blurb: '每个合并请求运行一次协作仓 main 上的工作流：装工作流文件里写的那一版合并检查包，取回 main 与合并请求的提交，读 Gitea 上协作仓的协作者当负责人，运行命令行。退出码 0 就合并，1 就留言写明原因、关掉合并请求，2 是检查自己出错，这次运行失败。',
    caps: [{ id: 'job', name: '一次运行', ident: 'pull_request_target · runs-on: nas' }],
  },
  {
    id: 'checkTs',
    name: '安全检查',
    pkg: 'check.ts',
    role: 'violet',
    outside: false,
    blurb: '出口 .：在内存里算出把合并请求合进 main 的结果（不动工作区和分支），有冲突就列出冲突的文件；没有冲突，再看改了的文件里有没有只有负责人能改的：执行器工作流、人员列表（提交人只给自己那一项改身份码的除外）、站点的装包设置与 Node 会执行的配置，site/package.json 里依赖以外的键、功能包的版本、写成网址或本地路径的依赖。提交的人是负责人就放行。只运行 git，不读记录内容。',
    caps: [
      { id: 'changed', name: '改了哪些文件', ident: 'changedFilesBetween' },
      { id: 'leadonly', name: '只有负责人能改的', ident: 'leadOnlyProblems' },
      { id: 'verdict', name: '结论', ident: 'checkMerge' },
    ],
  },
  {
    id: 'cliTs',
    name: '参数与退出码',
    pkg: 'cli.ts',
    role: 'slate',
    outside: false,
    blurb: '读参数，认不出的参数、缺参数直接报错并给出用法；在仓根运行 checkMerge，collab/ 与 site/ 的位置固定在仓根；按结论给退出码：0 能合，1 不能合，2 参数错或检查自己出错。',
    caps: [{ id: 'cli', name: '参数与退出码', ident: 'runMergeCheckCli' }],
  },
  {
    id: 'binTs',
    name: '命令行入口',
    pkg: 'bin.ts',
    role: 'blue',
    outside: false,
    blurb: 'package.json 的 bin 指向它：把命令行参数交给 cli.ts，打印结果，按退出码退出。',
    caps: [{ id: 'bin', name: '命令', ident: 'collab-merge-check' }],
  },
  {
    id: 'templates',
    name: '工作流模板',
    pkg: 'templates/',
    role: 'amber',
    outside: false,
    blurb: '随包发布的自动合并工作流。负责人建项目时把它放进协作仓的 .gitea/workflows/；用哪一版合并检查包写在它的 MERGE_CHECK_RANGE 里，升版本就是负责人改这一行。',
    caps: [{ id: 'tpl', name: '自动合并工作流', ident: 'collab-auto-merge.yaml' }],
  },
  {
    id: 'repo',
    name: '协作仓',
    pkg: 'Gitea 上',
    role: null,
    outside: true,
    blurb: 'Gitea 上的协作仓：main 与合并请求的提交；.gitea/workflows/ 下的工作流文件只有负责人能改，而且要合进 main 才生效。',
    caps: [
      { id: 'gitrepo', name: 'git 仓', ident: 'main · refs/pull/<编号>/head' },
      { id: 'wf', name: '工作流文件', ident: '.gitea/workflows/' },
    ],
  },
];

/** @type {import('@godcreator/docsite-explainer/seam-graph').SeamInput[]} */
const seams = [
  {
    n: 1,
    name: '推送前在本机查',
    a: ['submit'],
    b: ['changed', 'leadonly'],
    iface: 'changedFilesBetween(repo, base, head) · leadOnlyProblems({ repo, base, head, collabPathInRepo, sitePathInRepo, authorIsLead, author, changedFiles })',
    convention: false,
    via: 'code',
    text: '插件已经把 origin/main 合进本地 main，比的是 origin/main 与要推的 HEAD；负责人名单由插件从 Gitea 读来。和执行器用的是同一个函数，本机查到就不用等执行器打回。',
  },
  {
    n: 2,
    name: '执行器运行命令',
    a: ['job'],
    b: ['bin'],
    iface: 'collab-merge-check --base main --head refs/collab/pull --author <提交人> --leads <负责人，逗号分隔> → 0 能合 / 1 不能合 / 2 出错',
    convention: false,
    via: 'code',
    text: '工作流在临时目录里取回 main 与合并请求，按版本范围装合并检查包（缓存在执行器里），运行 node_modules/.bin 下的命令。只装这个包和它依赖的数据模型包，不装功能包与文档站基础包。',
  },
  {
    n: 3,
    name: '入口转给参数处理',
    a: ['bin'],
    b: ['cli'],
    iface: 'runMergeCheckCli(args, cwd) → { exitCode, output }',
    convention: false,
    via: 'code',
    text: 'bin.ts 只负责打印与退出，参数怎么认、退出码怎么给全在 cli.ts，测试直接调 runMergeCheckCli。',
  },
  {
    n: 4,
    name: '命令行运行检查',
    a: ['cli'],
    b: ['verdict'],
    iface: 'checkMerge({ repo, base, head, collabPathInRepo, sitePathInRepo, authorIsLead, author }) → { verdict, problems }',
    convention: false,
    via: 'code',
    text: 'cli.ts 把「提交人在不在负责人名单里」算成 authorIsLead，连同提交人 author（判断人员列表里改的是不是自己那一项）交过去；判断全在 check.ts。',
  },
  {
    n: 5,
    name: '运行 git',
    a: ['changed', 'leadonly', 'verdict'],
    b: ['gitrepo'],
    iface: 'git merge-tree --write-tree · git diff --name-only · git show <版本>:site/package.json',
    convention: false,
    via: 'disk',
    text: '合并结果只算在内存里、写成一棵树，不改分支；site/package.json 读合并前后两个版本，逐个键比。',
  },
  {
    n: 6,
    name: '负责人放进协作仓',
    a: ['tpl'],
    b: ['wf'],
    iface: 'templates/collab-auto-merge.yaml → 协作仓 .gitea/workflows/collab-auto-merge.yaml',
    convention: true,
    via: 'disk',
    text: '没有代码把模板写进协作仓，是负责人建项目时照文档复制；模板改了，各项目要由负责人再复制一次。',
  },
  {
    n: 7,
    name: '执行器运行 main 上的工作流',
    a: ['job'],
    b: ['wf'],
    iface: 'on: pull_request_target · env: MERGE_CHECK_RANGE',
    convention: false,
    via: 'disk',
    text: 'pull_request_target 让执行器永远运行 main 上那一份工作流，合并请求里改了工作流也不生效；装哪一版合并检查包也由这份文件定。',
  },
];

export const collabMergeCheckGraph = defineSeamGraph({
  id: 'collab-merge-check',
  title: '合并检查包自己的接缝图',
  intro:
    '合并检查包只回答一件事：这个合并请求能不能直接合进 main。判断全在 check.ts，命令行两个文件只做参数与退出码。gwb-collab 推送前查一次，执行器合并前再查一次，用的是同一个函数。',
  frameLabel: '文件',
  modules,
  entries: [],
  seams,
});
