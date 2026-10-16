/**
 * WriteSteps（「collab：项目协作」那一页「写入规则」一节）的全部数据，画面（write-steps.tsx）只读这一份。
 * 一个例子两条路：carol-test（不是作者）改 godcreator 那条任务，改 status 走通五步、改 detail 在第 2 步被拒。
 * 通过那条的断言测试里写的是 bob-test（test/write.test.ts「别人改任务状态」一条），这里照设计统一用 carol-test——
 * 两人都不是作者、status 对谁都放行，规则一样；被拒的原话逐字照抄测试断言。
 */

/** carol-test 改 status 的那一路：别人改任务状态，直接改写那条记录的文件 */
/* ref file="../packages/collab/test/write.test.ts" lines="58-61" hash="c515c37a3bac" blob="caa0bc521ab3" */
export const passCase = {
  person: 'carol-test',
  field: 'status',
  value: 'doing',
  result: { status: 200, body: '{ ok: true }' },
};

/** carol-test 改 detail 的那一路：被拒，WriteRejected 的消息逐字照测试断言 */
/* ref file="../packages/collab/test/write.test.ts" lines="68-76" hash="c0fd522f3231" blob="caa0bc521ab3" */
export const rejectCase = {
  person: 'carol-test',
  field: 'detail',
  value: '对比三个通道',
  message: 'carol-test 改了 godcreator 的记录 20260925160530-t5v9w3d 的 detail；别人的 task 记录只能改 status、owner、due、title、module',
  result: { status: 422, body: '{ ok: false, error: "carol-test 改了 godcreator 的记录 … 的 detail；…" }' },
};

/** task 的 fieldsAnyoneMayChange（正文已钉 records.ts 那段） */
export const taskFieldsAnyoneMayChange = 'status、owner、due、title、module';

export const steps = [
  {
    title: 'action 收到表单',
    note: '先核对来源与身份：Origin 要等于站点的可信 origin，本机身份码要在人员列表里认出人；不对就 403，到不了写入规则。',
    cardTitle: '表单',
    lines: [
      { tone: 'none', text: 'intent: update-record' },
      { tone: 'none', text: 'id: 20260925160530-t5v9w3d' },
      { tone: 'good', text: '一路：field=status · value=doing' },
      { tone: 'bad', text: '另一路：field=detail · value=对比三个通道' },
    ],
    text: '表单只带 intent、id、field、value 四个字段，多了少了都回 400。写的人是本机身份认出的 carol-test——这条任务的作者是 godcreator，不是 carol-test，往下走第 2 步的判定。',
  },
  {
    title: '写入规则判',
    note: '作者能改自己记录里除 id、type、author 以外的任何字段；别人只能改 fieldsAnyoneMayChange 里那几个。',
    cardTitle: 'planUpdate：谁能改什么',
    lines: [
      { tone: 'good', text: `status 在清单里（task：${taskFieldsAnyoneMayChange}）——放行` },
      { tone: 'bad', text: 'detail 不在清单里——WriteRejected：' },
      { tone: 'bad', text: rejectCase.message },
    ],
    text: `两条路在这里分岔：status 谁都能改，照改；detail 只有作者能补，carol-test 不是作者，planUpdate 抛 WriteRejected，这一路停下，回 422 与原话。`,
  },
  {
    title: '交回计划',
    note: '计划只说写哪些文件、删哪些文件；被拒的那条没有计划，停在上一格。',
    cardTitle: 'WritePlan',
    lines: [
      { tone: 'none', text: 'write: [' },
      { tone: 'none', text: '  { file: "records/20260925160530-t5v9w3d.json",' },
      { tone: 'none', text: '    content: <整条记录的规范写法：status 改成 doing，键序不变> }' },
      { tone: 'none', text: ']' },
      { tone: 'none', text: 'remove: []' },
    ],
    text: '改一条任务就是把那个文件整份重写成规范写法；删模块时会列出要删的几个文件，有一条删不了就整次不删。新建的计划里是新文件 records/<新 id>.json。',
  },
  {
    title: '只拦新问题',
    note: '写盘前的最后一道检查是上一节的 newFormatProblems：别人留下的问题不挡，只有这次带来的新问题才拦。',
    cardTitle: 'newFormatProblems(before, after)',
    lines: [
      { tone: 'none', text: 'before（当前仓）：没有格式问题' },
      { tone: 'none', text: 'after（写入后）：没有格式问题' },
      { tone: 'good', text: '差集是空——放行' },
    ],
    text: '计划写出的内容先在内存里合成 after 快照校验一遍：改 status 不会带来新问题；就算仓里别处原本就有问题，也不挡这次写入，照旧显示在网站顶部的提示栏里。',
  },
  {
    title: '照计划写盘',
    note: 'node 层照计划改磁盘，新建不覆盖已有文件；网站不跑 git。',
    cardTitle: '结果',
    lines: [
      { tone: 'good', text: '改写 records/20260925160530-t5v9w3d.json，回 200 { ok: true }' },
      { tone: 'bad', text: '停在步骤 2：WriteRejected 回 422 { ok: false, error: "carol-test 改了 godcreator 的记录 … 的 detail；…" }' },
    ],
    text: '通过的一路到这里落盘，页面上那条任务的状态变了；被拒的一路从第 2 步就没往下走，磁盘上的文件一个字节没动。',
  },
];
