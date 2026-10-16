/**
 * ConflictCases（「collab：项目协作」那一页「一条记录一个文件」一节）的全部数据，画面（conflict-cases.tsx）只读这一份。
 * 五种情况共用同一个仓：fixtures.ts 的任务与模块（textOf 的写法，一个字段一行），bob 与 carol 都从 main 分出各改一处，bob 分支上合并 carol。
 * 结尾的 git 输出与冲突行号都是实跑的结果，不凭推理：git 2.53.0.windows.2（默认 ort 策略），在仓外临时目录建 git 仓跑 `git merge carol`，
 * 退出码与输出原文照抄，跑完临时目录已删。解码那句的原话出自 records.ts 的 decodeRecordFile（正文已钉那段），行号按冲突后的文件数出来。
 */

/** 例子记录：任务与模块都取自测试夹具，写成 textOf 的规范写法（一个字段一行、两格缩进、换行结尾） */
/* ref file="../packages/collab/test/fixtures.ts" lines="14-17" hash="542600682f6e" blob="0440510224bf" */
export const repo = {
  taskFile: 'collab/records/20260925160530-t5v9w3d.json',
  moduleFile: 'collab/records/20260920090000-m1a2b3c.json',
  taskStatusTodo: ['  "status": "todo",'],
  taskStatusDoing: ['  "status": "doing",'],
  taskStatusDone: ['  "status": "done",'],
  taskTitle: ['  "title": "补 ADC 通道对比",'],
  taskTitleChanged: ['  "title": "补完 ADC 通道对比",'],
  taskDue: ['  "due": "2026-10-10"'],
  taskDueChanged: ['  "due": "2026-10-20"'],
  moduleDue: ['  "due": "2026-10-31",'],
  moduleDueChanged: ['  "due": "2026-11-05",'],
};

/** git 实跑输出的原文（bob 分支上 `git merge carol`） */
export const gitOutputs = {
  autoMerge: 'Auto-merging collab/records/20260925160530-t5v9w3d.json',
  merged: "Merge made by the 'ort' strategy.",
  conflict: 'CONFLICT (content): Merge conflict in collab/records/20260925160530-t5v9w3d.json',
  conflictHint: 'Automatic merge failed; fix conflicts and then commit the result.',
  createdCarol: 'create mode 100644 collab/records/20260926100000-c4r0l7e.json',
};

export const cases = [
  {
    id: 'diff-records',
    label: '各改一条记录',
    text: 'bob 改任务的状态，carol 改模块的截止日，各碰各的文件。文件不相干，git 直接把两个提交合上，退出码 0。',
    bob: { note: '任务的状态', files: [{ path: repo.taskFile, old: repo.taskStatusTodo, now: repo.taskStatusDoing }] },
    carol: { note: '模块的截止日', files: [{ path: repo.moduleFile, old: repo.moduleDue, now: repo.moduleDueChanged }] },
    merged: true,
    gitLines: [gitOutputs.merged],
  },
  {
    id: 'same-record-far-fields',
    label: '同一记录隔两行',
    text: '同一条任务：bob 改第 5 行的 status，carol 改第 8 行的 due，中间隔着没人动的 title、owner 两行。git 在这个文件里各改各的行，也自动合上。',
    bob: { note: '第 5 行 status', files: [{ path: repo.taskFile, old: repo.taskStatusTodo, now: repo.taskStatusDoing }] },
    carol: { note: '第 8 行 due', files: [{ path: repo.taskFile, old: repo.taskDue, now: repo.taskDueChanged }] },
    merged: true,
    gitLines: [gitOutputs.autoMerge, gitOutputs.merged],
  },
  {
    id: 'same-record-adjacent-fields',
    label: '相邻两行',
    text: '同一条任务：bob 改第 5 行的 status，carol 改第 6 行的 title。相邻两行的改动 git 合不上——冲突块把两行圈在一起，冲突标记落在第 5、8、11 行。',
    bob: { note: '第 5 行 status', files: [{ path: repo.taskFile, old: repo.taskStatusTodo, now: repo.taskStatusDoing }] },
    carol: { note: '第 6 行 title', files: [{ path: repo.taskFile, old: repo.taskTitle, now: repo.taskTitleChanged }] },
    merged: false,
    gitLines: [gitOutputs.autoMerge, gitOutputs.conflict, gitOutputs.conflictHint],
    decodeLine: 'git 合并冲突没解决完（第 5、8、11 行是冲突标记）：让 AI 按两边的意思改好这条记录',
  },
  {
    id: 'same-field',
    label: '同一个字段',
    text: '同一个 status，bob 改成 doing、carol 改成 done：同一行两边要不一样的字，必然冲突，冲突标记落在第 5、7、9 行。',
    bob: { note: 'status 改 doing', files: [{ path: repo.taskFile, old: repo.taskStatusTodo, now: repo.taskStatusDoing }] },
    carol: { note: 'status 改 done', files: [{ path: repo.taskFile, old: repo.taskStatusTodo, now: repo.taskStatusDone }] },
    merged: false,
    gitLines: [gitOutputs.autoMerge, gitOutputs.conflict, gitOutputs.conflictHint],
    decodeLine: 'git 合并冲突没解决完（第 5、7、9 行是冲突标记）：让 AI 按两边的意思改好这条记录',
  },
  {
    id: 'new-records',
    label: '各建一条',
    text: '两人各新建一条任务。一条记录一个文件，id 里带着各自电脑上的时刻，文件名碰不到一起，两边的提交都原样进来。',
    bob: {
      note: '新建一条',
      files: [
        {
          path: 'collab/records/20260926090000-b0b7a5k.json',
          created: true,
          now: ['{', '  "id": "20260926090000-b0b7a5k",', '  "type": "task",', '  "author": "bob-test",', '  "status": "todo",', '  "title": "画采样板原理图"', '}'],
        },
      ],
    },
    carol: {
      note: '新建一条',
      files: [
        {
          path: 'collab/records/20260926100000-c4r0l7e.json',
          created: true,
          now: ['{', '  "id": "20260926100000-c4r0l7e",', '  "type": "task",', '  "author": "carol-test",', '  "status": "todo",', '  "title": "选 ADC"', '}'],
        },
      ],
    },
    merged: true,
    gitLines: [gitOutputs.merged, gitOutputs.createdCarol],
  },
];
