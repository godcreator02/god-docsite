/**
 * MergeCases（「collab：项目协作」那一页「合并检查」一节）的全部数据，画面（merge-cases.tsx）只读这一份。
 * 七种情况共用同一个例子仓（合并检查测试里的仓）：main 上有人员列表（alice 甲、bob 乙）与甲的一条任务，
 * bob 从 main 分出 topic 提交；每种情况 topic 上的改动不同，checkMerge 的两条、结论、problems 与退出码跟着变。
 * problems 的原话照测试断言抄；测试里没有的两处按源码拼出、实际运行 checkMerge 核对过（见 leadScriptsProblem 与 conflict 一条）。
 */

/**
 * 例子仓（合并检查测试里的仓）：main 上有人员列表、甲的一条任务、站点依赖；检查的请求是 base main、head topic、提交人 bob。
 * 检查在内存里算出把 head 合进 main 的树，改动按合并后的树算
 */
/* ref file="../packages/collab/test/merge-check-repo.ts" lines="10-21" hash="667541612acf" blob="2e50d825b150" */
/* ref file="../packages/collab/test/merge-check-repo.ts" lines="59-75" hash="fa7da2ff8301" blob="2e50d825b150" */
export const repo = {
  peopleFile: 'site/people.json',
  aliceEntryOld: ['    "name": "甲",'],
  aliceEntryNew: ['    "name": "甲改名",'],
  aliceTaskFile: 'collab/records/20260930100000-aaaaaaa.json',
  taskTitleLineOld: ['  "title": "画子模块板原理图",'],
  sitePackageFile: 'site/package.json',
  request: { base: 'main', head: 'topic', authorIsLead: false, author: 'bob' },
};

/** checkMerge 的两条，先查冲突、再查只有负责人能改的内容；名字与检查的先后照 src/node/merge-check.ts（正文已钉） */
export const checkNames = ['和 main 没有冲突', '没改只有负责人能改的内容'];

/** lead-scripts 被打回时的原话：按 merge-check.ts 的拼法写出；authorIsLead 是 true 时这里直接回空 */
/* ref file="../packages/collab/src/node/merge-check.ts" lines="160-165" hash="a452f45d2489" blob="5aee6b777440" */
const leadScriptsProblem = '改了只有负责人能改的内容：site/package.json 的 scripts；这类改动交给负责人（协作仓的协作者）提交';

/**
 * 每种情况：topic 上的改动（changes，按文件摆改到的行；conflict 分「topic 上」「main 上」两组）、
 * checkMerge 两条各走成什么样（checks：pass 通过、fail 不通过、skipped 没查）、结论（verdicts，大多一项；
 * lead-scripts 分 authorIsLead 两种）。problems 是给人看的原话，能合并时为空。
 */
export const cases = [
  /* ref file="../packages/collab/test/merge-check-conflicts.slow.test.ts" lines="7-22" hash="3466a2c5c9f3" blob="61106ca142b9" */
  {
    id: 'new-record',
    label: '新加一条记录',
    text: 'bob 新建一条任务，就是在 collab/records/ 下新加一个文件，和别人的改动碰不到一起。合进 main 没有冲突，改的文件也不在只有负责人能改的名单里，能合并，退出码 0。',
    changes: [
      {
        files: [
          {
            path: 'collab/records/20260930110000-bbbbbbb.json',
            created: true,
            now: [
              '{',
              '  "id": "20260930110000-bbbbbbb",',
              '  "type": "task",',
              '  "author": "bob",',
              '  "status": "todo",',
              '  "title": "写跨时钟域测试"',
              '}',
            ],
          },
        ],
      },
    ],
    checks: [
      { state: 'pass', note: '新加的文件 main 上没有，合并不冲突' },
      { state: 'pass', note: 'collab/ 不在只有负责人能改的名单里' },
    ],
    verdicts: [{ verdict: 'mergeable', exitCode: 0, problems: [] }],
  },
  {
    id: 'conflict',
    label: '两人改同一行',
    text: '甲和乙都改了甲那条任务的标题。记录是规范写法，一个字段一行，两人改的正是同一行，合进 main 有冲突，第 2 条不再查。乙要把 main 合进来、按两边的意思改好，再提交。',
    changes: [
      {
        side: 'topic 上',
        files: [{ path: 'collab/records/20260930100000-aaaaaaa.json', old: repo.taskTitleLineOld, now: ['  "title": "画子模块板原理图（乙改）",'] }],
      },
      {
        side: 'main 上',
        sideNote: 'main 后来的提交',
        files: [{ path: 'collab/records/20260930100000-aaaaaaa.json', old: repo.taskTitleLineOld, now: ['  "title": "画子模块板原理图（甲改）",'] }],
      },
    ],
    checks: [
      { state: 'fail', note: '两人都改了标题那一行' },
      { state: 'skipped', note: '有冲突，不再查' },
    ],
    verdicts: [
      {
        verdict: 'conflict',
        exitCode: 1,
        problems: ['和 main 有冲突：collab/records/20260930100000-aaaaaaa.json；把 main 合进来、按两边的意思改好冲突的文件，再提交'],
      },
    ],
  },
  /* ref file="../packages/collab/test/merge-check-lead-only.slow.test.ts" lines="28-32" hash="331fb82e41ee" blob="c50a5a5d42e0" */
  /* ref file="../packages/collab/test/merge-check-lead-only.slow.test.ts" lines="52-56" hash="6195322269eb" blob="c50a5a5d42e0" */
  {
    id: 'own-codes',
    label: '给自己加身份码',
    text: 'bob 第一次在本机用协作站，gwb-collab 把本机的身份码写进人员列表里他自己那一项。人员列表只放行这一种改动：提交人只给 gitea 是自己的那一项加减 codes，别的都不变。',
    changes: [
      {
        files: [
          {
            path: 'site/people.json',
            now: ['    "codes": [', '      "bobcode00001"', '    ],'],
          },
        ],
      },
    ],
    checks: [
      { state: 'pass', note: '改的地方和 main 不重叠' },
      { state: 'pass', note: '提交人只给自己那一项加了身份码' },
    ],
    verdicts: [{ verdict: 'mergeable', exitCode: 0, problems: [] }],
  },
  {
    id: 'others-entry',
    label: '改别人那一项',
    text: 'bob 改了甲的名字。人员列表里改了别人那一项，整个文件算只有负责人能改的内容，交给负责人提交。',
    changes: [
      {
        files: [{ path: 'site/people.json', old: repo.aliceEntryOld, now: repo.aliceEntryNew }],
      },
    ],
    checks: [
      { state: 'pass', note: '改的地方和 main 不重叠' },
      { state: 'fail', note: '改的是别人那一项' },
    ],
    verdicts: [
      { verdict: 'needs-review', exitCode: 1, problems: ['改了只有负责人能改的内容：site/people.json；这类改动交给负责人（协作仓的协作者）提交'] },
    ],
  },
  /* ref file="../packages/collab/test/merge-check-lead-only.slow.test.ts" lines="73-94" hash="88a5199f0c5c" blob="c50a5a5d42e0" */
  {
    id: 'other-libs',
    label: '升级 react、加 three',
    text: '站点依赖里 @godcreator/ 以外的库，成员可以自己加、升级、删，只要写的是版本号范围。',
    changes: [
      {
        files: [
          {
            path: 'site/package.json',
            old: ['    "react": "^19.3.0",'],
            now: ['    "react": "^19.4.0",', '    "three": "^0.186.0",'],
          },
        ],
      },
    ],
    checks: [
      { state: 'pass', note: '改的地方和 main 不重叠' },
      { state: 'pass', note: '只动了 @godcreator/ 以外的库，写的都是版本号范围' },
    ],
    verdicts: [{ verdict: 'mergeable', exitCode: 0, problems: [] }],
  },
  {
    id: 'own-package',
    label: '升级本仓的包',
    text: '@godcreator/ 下的包决定每个人电脑上跑的网站代码，也决定站点和插件之间的约定对不对得上，加、删、改版本都只有负责人能改。',
    changes: [
      {
        files: [{ path: 'site/package.json', old: ['    "@godcreator/comments": "^0.1.0",'], now: ['    "@godcreator/comments": "^0.2.0",'] }],
      },
    ],
    checks: [
      { state: 'pass', note: '改的地方和 main 不重叠' },
      { state: 'fail', note: '@godcreator/ 下的包改了版本' },
    ],
    verdicts: [
      {
        verdict: 'needs-review',
        exitCode: 1,
        problems: ['改了只有负责人能改的内容：site/package.json 里 @godcreator/comments 的版本；这类改动交给负责人（协作仓的协作者）提交'],
      },
    ],
  },
  /* ref file="../packages/collab/test/merge-check-lead-only.slow.test.ts" lines="96-101" hash="736f11cdce34" blob="c50a5a5d42e0" */
  {
    id: 'lead-scripts',
    label: '负责人改 scripts',
    text: 'site/package.json 里依赖以外的键（比如 scripts）只有负责人能改，插件会在每个人电脑上运行 pnpm dev。提交人不是负责人时要负责人提交；是负责人时第 2 条直接放行。命令行里「是不是负责人」就是 --leads 里有没有 --author。',
    changes: [
      {
        files: [
          {
            path: 'site/package.json',
            now: ['  "scripts": {', '    "dev": "vite --port 4400"', '  },'],
          },
        ],
      },
    ],
    checks: [
      { state: 'pass', note: '改的地方和 main 不重叠' },
      {
        state: 'fail',
        note: '依赖以外的键只有负责人能改',
        variants: [
          { label: 'authorIsLead: false', state: 'fail', note: '依赖以外的键只有负责人能改' },
          { label: 'authorIsLead: true', state: 'pass', note: '提交人是负责人，直接放行' },
        ],
      },
    ],
    verdicts: [
      { label: 'authorIsLead: false', verdict: 'needs-review', exitCode: 1, problems: [leadScriptsProblem] },
      { label: 'authorIsLead: true', verdict: 'mergeable', exitCode: 0, problems: [] },
    ],
  },
];
