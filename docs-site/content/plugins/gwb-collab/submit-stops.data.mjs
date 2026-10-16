/**
 * SubmitStops（「gwb-collab：协作站插件」那一页）的全部数据，画面（submit-stops.tsx）只读这一份。
 * 一次 collab.submit 贯穿七种情况：bob 在协作仓里的改动、八步各走成什么样、停下后仓里留下什么、
 * 网站提示栏「协作仓」组里出现什么。例子与拒绝原话照提交审核的测试夹具与源码抄，钉码钉在正上方。
 */

/** 共用的例子：项目是 Gitea 组织 hybrid-mmc 的协作仓 collab；人员有 admin（管理员，项目负责人）、bob（成员，本机身份）、carol（成员）；main 起点的任务是 admin 的 20260925100000-aaaaaaa，bob 新建的任务是 20260925110000-bbbbbbb，冲突的是 admin 的 20260925130000-ddddddd；推送后 Gitea 开出合并请求 #7 */
/* ref file="../plugins/collab/tests/collab-repo/submit/submit-fixture.ts" lines="23-42" hash="ba0b60be3402" blob="907a7defb577" */
const adminTaskPath = 'collab/records/20260925100000-aaaaaaa.json'
const bobTaskPath = 'collab/records/20260925110000-bbbbbbb.json'
const conflictTaskPath = 'collab/records/20260925130000-ddddddd.json'
const pullNumber = 7

/** main 的起点（admin 的种子提交写的）与假的执行器的默认：协作者是 ['admin']；它打回时留下的留言是 rejected 情况「原因」后面的那两行 */
/* ref file="../plugins/collab/tests/collab-repo/submit/submit-fixture.ts" lines="81-146" hash="18361611bbf4" blob="667f68c5610d" */
const startingSitePackageJson = '{ "dependencies": {} }'
const executorRejectComment = [
  '没有合并（检查的是提交 abc）：',
  '改了只有负责人能改的内容：site/package.json 的 scripts；这类改动交给负责人（协作仓的协作者）提交',
]

/** 等结论：每 2 秒查一次合并请求，最多 180 秒 */
/* ref file="../plugins/collab/src/collab-repo/submit/submit.ts" lines="30-33" hash="1553118eddb9" blob="3df0aa7106c6" */
export const verdictWait = { pollSeconds: 2, timeoutSeconds: 180 }

/** bob 新建的任务文件（规范写法，两格缩进、以换行结尾） */
const bobNewTaskLines = [
  '{',
  '  "id": "20260925110000-bbbbbbb",',
  '  "type": "task",',
  '  "author": "bob",',
  '  "status": "todo",',
  '  "title": "bob 的任务"',
  '}',
]

const bobNewTaskFile = { path: bobTaskPath, groups: [{ title: null, old: [], now: bobNewTaskLines }] }
const newFile = (path, lines) => ({ files: [{ path, groups: [{ title: null, old: [], now: lines }] }], note: null })

/** 八步的先后照 submitCollab；步骤状态 ok 过、bad 停在这、skip 没走到或不适用 */
export const steps = [
  '在 main 上，取回 origin',
  'collab/ 没有新的格式问题（比分叉点）',
  'site/ 有改动时：站点检查与类型检查',
  '提交 collab/ 与 site/',
  '把 origin/main 合进来',
  '合进来以后再查一遍',
  '没改只有负责人能改的内容',
  '推到 refs/for/main，等执行器的结论',
]

/** 停下后仓的四种结局 */
export const ends = {
  merged: { text: '合并了', tone: 'good' },
  untouched: { text: '没提交，工作区原样', tone: 'warn' },
  merging: { text: '提交了，合并停在半路', tone: 'bad' },
  returned: { text: '退回推送时的 origin/main，改动变回没提交', tone: 'warn' },
}

const passed = { state: 'ok', note: '过' }
const notReached = { state: 'skip', note: '没走到' }

/* merged、format、rejected、timeout 四种情况照 submit-main 的用例：bob 只改 collab/（或写坏一条记录），
 * site/ 没改动不用查站点，提交后本地 main 不落后不用合，推上去开出 #7 */
/* ref file="../plugins/collab/tests/collab-repo/submit/submit-main.slow.test.ts" lines="10-51" hash="83afcb3feb1d" blob="14fdc2981b6d" */
const mergedCase = {
  id: 'merged',
  label: '合并了',
  text: 'bob 改了 admin 那条任务的状态，又新建了自己的任务。八步都过：格式没有新问题，site/ 没改动不用查站点，本地 main 不落后不用合，推上去开出 #7，执行器合并。提交只带 collab/ 与 site/，暂存区里别的文件原样留着。',
  changes: {
    files: [
      { path: adminTaskPath, groups: [{ title: null, old: ['  "status": "todo",'], now: ['  "status": "done",'] }] },
      bobNewTaskFile,
    ],
    note: '仓根的 notes.txt 已暂存，不在 collab/ 与 site/ 下，不带上',
  },
  steps: [passed, passed, { state: 'skip', note: 'site/ 没改动' }, passed, { state: 'ok', note: '本地 main 不落后，不用合' }, passed, passed, { state: 'ok', note: `#${pullNumber} 合并了` }],
  end: 'merged',
  leftInRepo: `这次的提交只含两个记录文件；notes.txt 仍暂存着（A  notes.txt）；本地 main 等合并的推送经实时推送触发取回、快进`,
  error: null,
  receipt: [`pull: { number: ${pullNumber} }`, 'siteFiles: 0', 'siteTypecheck: null'],
  noticeBar: { pills: [], note: null },
}

const formatCase = {
  id: 'format',
  label: '记录不是规范写法',
  text: '手写的记录解码得出来，但和规范写法不一样。第 2 步只拿它和分叉点比、只报这次带来的新问题，这一条是新的，于是不提交、不推送，工作区原样。',
  changes: newFile(bobTaskPath, ['{"id":"20260925110000-bbbbbbb","type":"task","author":"bob","status":"todo","title":"bob 的任务"}']),
  steps: [passed, { state: 'bad', note: '这一条是这次带来的新问题' }, notReached, notReached, notReached, notReached, notReached, notReached],
  end: 'untouched',
  leftInRepo: '没有新提交（git rev-list --count HEAD 仍是 1）',
  error: [
    'collab/ 校验不过，没有提交：',
    'records/20260925110000-bbbbbbb.json  不是规范写法：键序、缩进、空白、转义或结尾换行和重新编码的结果不同',
  ],
  receipt: null,
  noticeBar: {
    /* 提示栏短句的拼法 */
    /* ref file="../packages/collab/src/core/notifications/notification-text.ts" lines="16-31" hash="383a43334116" blob="d8d56dd65fa0" */
    pills: ['本机有 1 个文件还没提交审核（记录 1 个）', '上次提交审核没成功'],
    note: null,
  },
}

const rejectedCase = {
  id: 'rejected',
  label: '执行器打回',
  text: '推上去开出 #7，执行器留言后关掉它。插件把本地 main 退回推送时的 origin/main，这次的改动变回没提交，原话里附上执行器的留言。',
  changes: { files: [bobNewTaskFile], note: null },
  steps: [passed, passed, notReached, passed, passed, passed, passed, { state: 'bad', note: `#${pullNumber} 被关闭` }],
  end: 'returned',
  leftInRepo: 'HEAD 回到提交审核之前；git status --porcelain 是 ?? collab/records/20260925110000-bbbbbbb.json',
  error: [`没有合并：合并请求 #${pullNumber} 被关闭，改动退回工作区（没提交）。原因：`, ...executorRejectComment],
  receipt: null,
  noticeBar: { pills: ['本机有 1 个文件还没提交审核（记录 1 个）', '上次提交审核没成功'], note: null },
}

const timeoutCase = {
  id: 'timeout',
  label: '等不到结论',
  text: `每 ${verdictWait.pollSeconds} 秒查一次，${verdictWait.timeoutSeconds} 秒还开着，多半是 NAS 上的执行器没在运行。插件先关掉 #${pullNumber} 再退回改动，执行器恢复后看到合并请求已关就不处理，不会出现本机退回了、服务器上又合并了。`,
  changes: { files: [bobNewTaskFile], note: null },
  steps: [passed, passed, notReached, passed, passed, passed, passed, { state: 'bad', note: `${verdictWait.timeoutSeconds} 秒内没有结论` }],
  end: 'returned',
  leftInRepo: `插件关掉了 #${pullNumber}；本地 main 回到 origin/main；collab/records/20260925110000-bbbbbbb.json 回到工作区、没被跟踪`,
  error: [
    `执行器 ${verdictWait.timeoutSeconds} 秒内没有给结论，NAS 上的执行器可能没在运行：已关掉合并请求 #${pullNumber}，改动退回工作区（没提交）。告诉负责人去看执行器，好了再提交审核`,
  ],
  receipt: null,
  noticeBar: { pills: ['本机有 1 个文件还没提交审核（记录 1 个）', '上次提交审核没成功'], note: null },
}

/* lead-only、site-check 两种情况照 submit-site 的用例：一个用例连着跑六种场景，这里取成员改 scripts 被拦、
 * 站点检查拦下不存在日期的日志页（同时加的评论作者不在人员列表里，不被拦）两段 */
/* ref file="../plugins/collab/tests/collab-repo/submit/submit-site.slow.test.ts" lines="43-87" hash="a89a15ee202f" blob="62e059466e05" */
const leadOnlyCase = {
  id: 'lead-only',
  label: '成员改 scripts',
  text: '本机推送前用和执行器同一个函数查只有负责人能改的内容。bob 不是协作仓的协作者，改 scripts 被拦下：拆掉这次的提交，改动回到工作区，没推送，不用等执行器打回。负责人提交同样的改动时这一步放行。',
  changes: { files: [{ path: 'site/package.json', groups: [{ title: null, old: [startingSitePackageJson], now: ['{ "scripts": { "dev": "vite" }, "dependencies": {} }'] }] }], note: null },
  steps: [passed, passed, { state: 'ok', note: '站点检查没问题，类型检查通过（测试里是假的类型检查）' }, passed, passed, passed, { state: 'bad', note: 'bob 不是协作仓的协作者，改 scripts 被拦下' }, notReached],
  end: 'returned',
  leftInRepo: "本地 main 回到 origin/main（origin/main..HEAD 是 0 个提交）；site/package.json 的改动回到工作区；没推送。同样的改动由负责人提交时第 7 步放行（协作者是 ['admin', 'bob']）",
  error: [
    '没有推送，改动留在工作区（没提交）：改了只有负责人能改的内容：site/package.json 的 scripts；这类改动交给负责人（协作仓的协作者）提交',
  ],
  receipt: null,
  noticeBar: { pills: ['本机有 1 个文件还没提交审核（站点文件 1 个）', '上次提交审核没成功'], note: null },
}

const siteCheckCase = {
  id: 'site-check',
  label: '日志页日期不存在',
  text: 'site/ 有改动才做站点检查，它只查 journal/ 的文件名——2 月 30 日不是真实日期，站点布局按文件名读日志，留着整站打不开。同时加的那串评论作者不在人员列表里，站点检查不拦它。不提交，类型检查也没跑。',
  changes: {
    files: [
      { path: 'site/journal/2026-02-30.mdx', groups: [{ title: null, old: [], now: ['# 不存在的一天'] }] },
      {
        path: 'site/comments/2026-10-10-dave/index.mdx',
        groups: [{ title: null, old: [], now: ['---', 'author: dave', 'createdAt: 2026-10-10T09:00:00.000Z', 'status: open', '---', '', 'dave 的评论'] }],
      },
    ],
    note: null,
  },
  steps: [passed, passed, { state: 'bad', note: '类型检查没跑' }, notReached, notReached, notReached, notReached, notReached],
  end: 'untouched',
  leftInRepo: '没有新提交；dave 的评论没被拦（站点检查只查日志文件名）',
  error: ['site/ 的站点检查不过，没有提交：', 'site/  journal/2026-02-30.mdx：2026-02-30 不是真实存在的日期'],
  receipt: null,
  noticeBar: { pills: ['本机有 2 个文件还没提交审核（站点文件 2 个）', '上次提交审核没成功'], note: null },
}

/* conflict 情况照 submit-sync 的用例：admin 与 bob 改同一条任务的同一个字段，bob 提交后合 main 撞上 admin 先推的 */
/* ref file="../plugins/collab/tests/collab-repo/submit/submit-sync.slow.test.ts" lines="30-46" hash="7cf17da4b6a2" blob="54dc8a7386cc" */
const conflictCase = {
  id: 'conflict',
  label: '两人改同一行',
  text: 'bob 的提交先做好，再把 origin/main 合进来时撞上 admin 先推的同一行。插件停在合并半路，冲突标记留在文件里，不推送；自动同步看到合并没完成也不动。提示栏只列冲突：提交失败与同步不了说的都是这件事。改好再提交审核，那次提交就完成这次合并。',
  changes: {
    files: [
      {
        path: conflictTaskPath,
        groups: [
          { title: 'bob 本机', old: ['  "status": "todo",'], now: ['  "status": "done",'] },
          { title: 'main 上', pill: 'admin 先推的', old: ['  "status": "todo",'], now: ['  "status": "doing",'] },
        ],
      },
    ],
    note: null,
  },
  steps: [passed, passed, notReached, passed, { state: 'bad', note: '撞上 admin 先推的同一行' }, notReached, notReached, notReached],
  end: 'merging',
  leftInRepo:
    '本地 main 多出 bob 的提交，合并没完成；那个文件里留着冲突标记（以 <<<<<<< 开头的行）；没推送；自动同步跳过，原因「提交审核时把 main 合进来出了冲突，还没改好：让 AI 改好冲突、再提交审核」。改好后再 collab.submit，那次提交完成这次合并（合并提交有两个父提交）',
  error: [
    /* 把 origin/main 合进来停在半路时的拒绝原话 */
    /* ref file="../plugins/collab/src/collab-repo/submit/submit.ts" lines="63-76" hash="96288abf3896" blob="3df0aa7106c6" */
    '把 origin/main 合进来有冲突，没有推送；冲突标记留在这些文件里（网站顶部的提示栏也会列出来）：',
    'collab/records/20260925130000-ddddddd.json',
    '让 AI 按两边的意思改好，再运行 collab.submit',
  ],
  receipt: null,
  noticeBar: {
    pills: [
      '本机有 1 个文件还没提交审核（记录 1 个）',
      '提交审核合 main 出了冲突，1 个文件还没改好',
      'collab/records/20260925130000-ddddddd.json 读不对',
    ],
    note: '上次提交审核没成功、没能自动同步被冲突压住，不列',
  },
}

export const cases = [mergedCase, formatCase, siteCheckCase, conflictCase, leadOnlyCase, rejectedCase, timeoutCase]
