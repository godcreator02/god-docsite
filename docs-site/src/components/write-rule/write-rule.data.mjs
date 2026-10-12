/**
 * 「写入规则判一次写入」（WriteRule）的全部讲解数据：画面（write-rule.tsx）与机读版规则（write-rule.ai.mjs）都只读这一份。
 * 每种情况是一次写入请求：页面交给网站服务端写入接口的内容、本机身份、写入规则按代码里的先后逐道检查、最后写成的文件或拒绝的原话。
 * 拒绝的原话照数据模型包的 src/task-model/write.ts 与 records.ts 逐字写；记录文件照 encodeRecordFile 的排版写（两格缩进、一个字段一行、键序固定）。
 */

/**
 * 一道检查。ok 为 true 是过了，false 是在这里被拒，null 是前面已经拒了、没走到
 * @typedef {{ name: string, ok: boolean | null, note: string }} Check
 */

/**
 * 最后的结果：写成新文件、改写已有的文件、删掉文件（lines 是删掉的那个文件），或者拒绝（文件不变）
 * @typedef {{ kind: 'created' | 'updated', file: string, lines: string[], added: number[], changed: number[] }
 *   | { kind: 'deleted', file: string, lines: string[] }
 *   | { kind: 'rejected', message: string, after: string }} Outcome
 */

/**
 * person 是本机身份：本 home 的身份码（gwb-docsite 的设置 identity-code）在 site/people.json 里对应的那个人的 id，网站服务端用基础包认出来交给写入规则
 * @typedef {{ id: string, label: string, text: string, person: string, endpoint: string, body: string[], checks: Check[], outcome: Outcome }} WriteCase
 */

/** 例子里的人员列表 site/people.json：id 与 gitea 都是 Gitea 用户名，name 是显示名，codes 是各个 gwb home 的身份码 */
export const people = [
  { id: 'bob', name: 'bob', codes: ['bobhome00001'], gitea: 'bob' },
  { id: 'carol', name: 'carol', codes: ['carolhome001'], gitea: 'carol' },
];

/** 例子里的项目负责人：Gitea 上协作仓的协作者，不记在 people.json 里；网站取 gwb-collab 推来的名单，插件命令从 Gitea 现读，都交给删除的写入规则 */
export const projectLeads = ['bob'];

const ENDPOINT = 'POST /api/collab';

/** carol 建的模块「控制器」、她归进这个模块的一条任务、bob 建的一条任务、bob 新建的模块 */
const MODULE_ID = '20260927090000-c5d6e7f';
const CAROL_TASK_ID = '20260929101500-q8r4t2m';
const BOB_TASK_ID = '20260929110000-h3j5k7n';
const NEW_MODULE_ID = '20260930150230-p2x7q1b';
/** collab/ 里原本就有的一个读不出的文件：两人改了同一条任务挨着的两行，同步后留着冲突标记 */
const CONFLICTED_FILE = 'records/20260926090000-t7m2p9c.json';

/** carol 那条任务写成文件的样子 */
const carolTaskLines = (status) => [
  '{',
  `  "id": "${CAROL_TASK_ID}",`,
  '  "type": "task",',
  '  "author": "carol",',
  `  "status": "${status}",`,
  '  "title": "核对 PR 参数",',
  `  "module": "${MODULE_ID}"`,
  '}',
];

const ANYONE_MAY_CHANGE_TASK = 'status、owner、due、title、module';

/* ref file="../packages/collab-site/src/server/index.ts" lines="68-100" hash="1541a0c69dae" blob="c92ed3baa954" */
/* ref file="../packages/collab-model/src/task-model/write.ts" lines="16-22" hash="d3ed6583ef64" blob="42c7ed460b69" */
/* ref file="../packages/collab-model/src/task-model/write.ts" lines="33-37" hash="709a0ceb1c0a" blob="42c7ed460b69" */
/* ref file="../packages/collab-model/src/task-model/write.ts" lines="44-51" hash="9ee96d52a371" blob="42c7ed460b69" */
/* ref file="../packages/collab-model/src/task-model/write.ts" lines="57-68" hash="481eb13d6f16" blob="42c7ed460b69" */
/* ref file="../packages/collab-model/src/task-model/write.ts" lines="92-102" hash="907a0c02480d" blob="42c7ed460b69" */
/* ref file="../packages/collab-model/src/task-model/write.ts" lines="116-129" hash="ca367ee1f35a" blob="42c7ed460b69" */
/* ref file="../packages/collab-model/src/task-model/write.ts" lines="137-152" hash="d404f00b18dc" blob="42c7ed460b69" */
/* ref file="../packages/collab-model/src/task-model/records.ts" lines="54-58" hash="739339db35a8" blob="e77a18193cd2" */
/* ref file="../packages/collab-model/src/task-model/records.ts" lines="149-155" hash="0dbbd3062165" blob="e77a18193cd2" */
/* ref file="../packages/collab-model/src/task-model/node.ts" lines="33-42" hash="477d8578934e" blob="e4533083836e" */
/** @type {WriteCase[]} */
export const cases = [
  {
    id: 'create',
    label: 'carol 新建一条任务',
    person: 'carol',
    text: '页面只交出任务的内容。id 与作者由写入规则补上：作者就是本机身份，网站服务端按本 home 的身份码在 site/people.json 里认出 carol。写入前把「写入后的 collab/」校验一遍，没有多出格式问题才写成新文件。',
    endpoint: ENDPOINT,
    body: ['{', '  "action": "create",', '  "record": {', '    "type": "task",', '    "status": "todo",', '    "title": "核对 PR 参数",', `    "module": "${MODULE_ID}"`, '  }', '}'],
    checks: [
      { name: '身份', ok: true, note: '本机身份是 carol，在 site/people.json 里' },
      { name: '请求本身', ok: true, note: '没有自带 id、author' },
      { name: '补字段', ok: true, note: 'id 取本地时间加 7 位随机后缀；author 写 carol' },
      { name: '编码', ok: true, note: '字段齐全、值的格式对，按固定键序排好' },
      { name: '写入前校验', ok: true, note: '写入后没有多出格式问题：所属的模块存在' },
      { name: '写文件', ok: true, note: `写成新文件 records/${CAROL_TASK_ID}.json；同名文件已存在就失败，不覆盖` },
    ],
    outcome: { kind: 'created', file: `collab/records/${CAROL_TASK_ID}.json`, lines: carolTaskLines('todo'), added: [2, 4], changed: [] },
  },
  {
    id: 'status',
    label: 'bob 把 carol 的任务改成进行中',
    person: 'bob',
    text: `修改只交记录 id 和要改的字段，直接改写它的文件。bob 不是作者，别人的任务只能改 ${ANYONE_MAY_CHANGE_TASK}；这次只改了 status，放行。`,
    endpoint: ENDPOINT,
    body: ['{', '  "action": "update",', `  "record": { "id": "${CAROL_TASK_ID}", "fields": { "status": "doing" } }`, '}'],
    checks: [
      { name: '请求本身', ok: true, note: '只有 id 与 fields；fields 里没有 id、type、author' },
      { name: '身份', ok: true, note: '本机身份是 bob，在 site/people.json 里' },
      { name: '找记录', ok: true, note: `id 为 ${CAROL_TASK_ID} 的记录只有一个文件` },
      { name: '合并字段', ok: true, note: 'status 换成 doing' },
      { name: '别人能改的字段', ok: true, note: `bob 改了 carol 的任务，只改了 status：别人的任务能改 ${ANYONE_MAY_CHANGE_TASK}` },
      { name: '编码', ok: true, note: '按固定键序排好' },
      { name: '写入前校验', ok: true, note: '写入后没有多出格式问题' },
      { name: '写文件', ok: true, note: `改写 records/${CAROL_TASK_ID}.json` },
    ],
    outcome: { kind: 'updated', file: `collab/records/${CAROL_TASK_ID}.json`, lines: carolTaskLines('doing'), added: [], changed: [5] },
  },
  {
    id: 'edit-detail',
    label: 'bob 改 carol 任务的说明',
    person: 'bob',
    text: `bob 不是作者，别人的任务只能改 ${ANYONE_MAY_CHANGE_TASK}，这次改的是说明 detail，在编码之前就拒了，文件一个字节都不动。拒绝的原话由写入接口回给页面。`,
    endpoint: ENDPOINT,
    body: ['{', '  "action": "update",', `  "record": { "id": "${CAROL_TASK_ID}", "fields": { "detail": "参数先按仿真的定" } }`, '}'],
    checks: [
      { name: '请求本身', ok: true, note: '只有 id 与 fields；fields 里没有 id、type、author' },
      { name: '身份', ok: true, note: '本机身份是 bob，在 site/people.json 里' },
      { name: '找记录', ok: true, note: `id 为 ${CAROL_TASK_ID} 的记录只有一个文件` },
      { name: '合并字段', ok: true, note: '加上 detail' },
      { name: '别人能改的字段', ok: false, note: `bob 改了 carol 的任务的 detail：别人的任务只能改 ${ANYONE_MAY_CHANGE_TASK}` },
      { name: '编码', ok: null, note: '没走到' },
      { name: '写入前校验', ok: null, note: '没走到' },
      { name: '写文件', ok: null, note: '没走到' },
    ],
    outcome: {
      kind: 'rejected',
      message: `bob 改了 carol 的记录 ${CAROL_TASK_ID} 的 detail；别人的 task 记录只能改 ${ANYONE_MAY_CHANGE_TASK}`,
      after: '文件不变；写入接口回 422 和这句原话',
    },
  },
  {
    id: 'own-author',
    label: '请求里自带作者',
    person: 'bob',
    text: 'bob 的页面交来的内容里写了 "author": "carol"，想替 carol 建一条任务。作者只能是本机身份，由写入规则补上，请求里带了 id 或 author 就直接拒绝，不替它改成本机身份再写。',
    endpoint: ENDPOINT,
    body: ['{', '  "action": "create",', '  "record": {', '    "type": "task",', '    "author": "carol",', '    "status": "todo",', '    "title": "替 carol 记一条"', '  }', '}'],
    checks: [
      { name: '身份', ok: true, note: '本机身份是 bob，在 site/people.json 里' },
      { name: '请求本身', ok: false, note: '带了 author' },
      { name: '补字段', ok: null, note: '没走到' },
      { name: '编码', ok: null, note: '没走到' },
      { name: '写入前校验', ok: null, note: '没走到' },
      { name: '写文件', ok: null, note: '没走到' },
    ],
    outcome: { kind: 'rejected', message: '新记录的 id 与 author 由写入规则补上，不能自带 author', after: '什么文件都没写' },
  },
  {
    id: 'old-problem',
    label: 'collab/ 里原本就有问题',
    person: 'bob',
    text: `collab/ 里已经有一个读不出的文件（${CONFLICTED_FILE} 留着 git 的冲突标记）。写入前校验只拦这次写入带来的新问题：写入前后都有的那一条不算，bob 照样能建模块。原本就有的问题由 gwb-collab 写成「记录读不对」的通知，显示在网站顶部的通知栏里，等人配合 AI 改好。`,
    endpoint: ENDPOINT,
    body: ['{', '  "action": "create",', '  "record": {', '    "type": "module",', '    "title": "调制",', '    "due": "2026-11-30"', '  }', '}'],
    checks: [
      { name: '身份', ok: true, note: '本机身份是 bob，在 site/people.json 里' },
      { name: '请求本身', ok: true, note: '没有自带 id、author' },
      { name: '补字段', ok: true, note: '补上 id 与 author' },
      { name: '编码', ok: true, note: '字段齐全、值的格式对，按固定键序排好' },
      {
        name: '写入前校验',
        ok: true,
        note: `写入前就有 1 个问题：${CONFLICTED_FILE}「git 合并冲突没解决完（第 5、8、11 行是冲突标记）：让 AI 按两边的意思改好这条记录」；写入后还是这一个，不算新问题`,
      },
      { name: '写文件', ok: true, note: `写成新文件 records/${NEW_MODULE_ID}.json` },
    ],
    outcome: {
      kind: 'created',
      file: `collab/records/${NEW_MODULE_ID}.json`,
      lines: ['{', `  "id": "${NEW_MODULE_ID}",`, '  "type": "module",', '  "author": "bob",', '  "title": "调制",', '  "due": "2026-11-30"', '}'],
      added: [2, 4],
      changed: [],
    },
  },
  {
    id: 'delete-task',
    label: '项目负责人 bob 删掉 carol 建的任务',
    person: 'bob',
    text: '删除只交一组记录 id，删掉它们的文件。只有作者本人和项目负责人能删：任务是 carol 建的，bob 是协作仓在 Gitea 上的协作者，网站服务端把 gwb-collab 推来的项目负责人一起交给写入规则，放行；还没推来时当作没有负责人，只有作者本人删得了。删掉之后的 collab/ 也照样校验一遍。',
    endpoint: ENDPOINT,
    body: ['{', '  "action": "delete",', `  "record": { "ids": ["${CAROL_TASK_ID}"] }`, '}'],
    checks: [
      { name: '请求本身', ok: true, note: '只有 ids，是一个不重复的记录 id 数组' },
      { name: '身份', ok: true, note: '本机身份是 bob，在 site/people.json 里' },
      { name: '找记录', ok: true, note: `id 为 ${CAROL_TASK_ID} 的记录只有一个文件` },
      { name: '能不能删', ok: true, note: 'bob 不是作者，但在项目负责人名单里' },
      { name: '模块下的任务', ok: true, note: '这次没有删模块' },
      { name: '写入前校验', ok: true, note: '删掉之后没有多出格式问题' },
      { name: '删文件', ok: true, note: `删掉 records/${CAROL_TASK_ID}.json` },
    ],
    outcome: { kind: 'deleted', file: `collab/records/${CAROL_TASK_ID}.json`, lines: carolTaskLines('todo') },
  },
  {
    id: 'delete-others-task',
    label: 'carol 删 bob 建的任务',
    person: 'carol',
    text: 'carol 不是这条任务的作者，也不是项目负责人，删不了。合并检查不查有没有删记录，谁能删只在写入规则这里判断；一组 id 里有一条删不了，别的也一个都不删。',
    endpoint: ENDPOINT,
    body: ['{', '  "action": "delete",', `  "record": { "ids": ["${BOB_TASK_ID}"] }`, '}'],
    checks: [
      { name: '请求本身', ok: true, note: '只有 ids，是一个不重复的记录 id 数组' },
      { name: '身份', ok: true, note: '本机身份是 carol，在 site/people.json 里' },
      { name: '找记录', ok: true, note: `id 为 ${BOB_TASK_ID} 的记录只有一个文件` },
      { name: '能不能删', ok: false, note: '任务是 bob 建的，carol 不在项目负责人名单里' },
      { name: '模块下的任务', ok: null, note: '没走到' },
      { name: '写入前校验', ok: null, note: '没走到' },
      { name: '删文件', ok: null, note: '没走到' },
    ],
    outcome: {
      kind: 'rejected',
      message: `carol 删不了 bob 的记录 ${BOB_TASK_ID}；任务和模块只有作者和负责人能删`,
      after: '一个文件都不删',
    },
  },
  {
    id: 'delete-module',
    label: 'bob 删一个下面还有任务的模块',
    person: 'bob',
    text: '模块「控制器」下还有 carol 的任务。写入规则不替人决定这条任务的去向（删掉，还是改到别的模块），拒绝并列出它；在同一次请求里把模块和这条任务一起删就能过。',
    endpoint: ENDPOINT,
    body: ['{', '  "action": "delete",', `  "record": { "ids": ["${MODULE_ID}"] }`, '}'],
    checks: [
      { name: '请求本身', ok: true, note: '只有 ids，是一个不重复的记录 id 数组' },
      { name: '身份', ok: true, note: '本机身份是 bob，在 site/people.json 里' },
      { name: '找记录', ok: true, note: `id 为 ${MODULE_ID} 的记录只有一个文件` },
      { name: '能不能删', ok: true, note: '模块是 carol 建的；bob 在项目负责人名单里' },
      { name: '模块下的任务', ok: false, note: `任务 ${CAROL_TASK_ID} 的 module 是这个模块，又不在这次要删的 ids 里` },
      { name: '写入前校验', ok: null, note: '没走到' },
      { name: '删文件', ok: null, note: '没走到' },
    ],
    outcome: {
      kind: 'rejected',
      message: `模块 ${MODULE_ID}（控制器）下还有任务：${CAROL_TASK_ID}（核对 PR 参数）；先把这些任务删掉或改到别的模块，再删模块`,
      after: '一个文件都不删；写入接口回 422 和这句原话',
    },
  },
];
