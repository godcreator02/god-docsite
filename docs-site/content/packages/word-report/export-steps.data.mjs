/**
 * ExportSteps（「word-report：报告」那一页「导出」一节）的全部数据，画面（export-steps.tsx）只读这一份。
 * 一次导出的六步照 src/node/export.ts 的 reportExport 与 execute、engine/src/docreport/web_runner.py 的锁交接写出；
 * 报错与状态原话逐字照抄源码。每步还带两张小卡片的数据：锁（out/.web-export.lock 的 phase 无 → starting → rendering
 * → 释放）与任务状态（无 → running → ready），字段名与状态名照代码。
 */

/** 第 6 步收尾核对的规则：核对记录的状态、docx 与 pdf 的哈希对得上才 ready */
/* ref file="../packages/word-report/src/node/export.ts" lines="120-127" hash="bd7f74288e3c" blob="ab2479c83f5b" */
export const verifyWording = {
  status: 'passed_automation_visual_review_pending',
  mismatch: '生成文件与验收记录不一致',
};

/** 第 3 步锁：Node 写进锁文件的内容，与锁在而进程已退出时的报错原话 */
/* ref file="../packages/word-report/src/node/export.ts" lines="156-174" hash="5ac53c8f9b56" blob="ab2479c83f5b" */
export const lockWording = {
  writtenByNode: [
    '{ "id": "web-<任务 id>", "pid": <Node 进程>,',
    '  "ownerPid": <Node 进程>, "phase": "starting",',
    '  "createdAt": <时刻> }',
  ],
  orphaned: '上次导出进程已退出，锁仍保留。请确认本次 Word 实例已结束后清理锁：<engine>/out/.web-export.lock',
};

/** 第 1 步取快照：读所有 JSON 与图片、每张图真解码、记 sha256、整个再读一遍防中途改动 */
/* ref file="../packages/word-report/src/node/read-report.ts" lines="57-84" hash="da40c0e9ef2f" blob="1283dd859c85" */
export const snapshotWording = {
  changed: 'Input changed while taking snapshot; retry export',
};

/** 第 4、5 步：写快照目录、启动 Python 前再核引擎指纹、spawn 的命令行 */
/* ref file="../packages/word-report/src/node/export.ts" lines="176-212" hash="986edd3d15b9" blob="ab2479c83f5b" */
export const executeWording = {
  engineChanged: 'Word 引擎在建立快照期间改变，请重新导出',
  command: [
    '.venv/Scripts/python.exe -m docreport.web_runner',
    '  --lock out/.web-export.lock --job web-<任务 id>',
    '  <out/web-<任务 id>/input> --data-only --out <out/web-<任务 id>/result>',
  ],
};

/** 第 5 步：Python 把锁从 starting 接过来改成 rendering 并记下自己的进程号，跑完自己释放 */
/* ref file="../packages/word-report/engine/src/docreport/web_runner.py" lines="15-41" hash="08389797c252" blob="6a2778d6822b" */
export const pythonClaim = {
  lockLines: [
    '{ "id": "web-<任务 id>", "pid": <渲染进程>,',
    '  "ownerPid": <Node 进程>, "rendererPid": <渲染进程>,',
    '  "phase": "rendering", "claimedAt": <时刻> }',
  ],
};

/** 一次导出的六步：capture（组装取快照、算指纹）→ acquireLock → 建任务 → execute（写目录、启动 Python、收尾） */
/* ref file="../packages/word-report/src/node/export.ts" lines="215-246" hash="f6d7bb6446be" blob="ab2479c83f5b" */
export const steps = [
  {
    title: '组装并取快照',
    cardTitle: 'readReport + layout.json',
    lines: [
      { tone: 'none', text: 'readReport(entry, { root, mode: "complete" })' },
      { tone: 'none', text: '→ 组装好的文档、图片字节、snapshot[]（每个文件的 sha256）' },
      { tone: 'none', text: '→ fingerprint = sha256(snapshot)，整份快照的哈希就是内容的指纹' },
      { tone: 'none', text: 'layout.json（报告目录旁，只给 Word 用的版式）' },
      { tone: 'warn', text: `整个再读一遍，哈希不同就报错让人重试：${snapshotWording.changed}` },
    ],
    lock: { phase: '没有锁', dot: 'none', lines: [] },
    job: { label: '还没有任务', dot: 'none' },
    text: '导出从组装开始：readReport 读完整报告目录、每张图真解码一遍，每个文件记下 sha256，最后整个再读一遍——导出过程中改了文件不会混进这一次。另读报告目录旁的 layout.json。',
  },
  {
    title: '算指纹',
    cardTitle: '指纹的四项',
    lines: [
      { tone: 'none', text: '① 快照 fingerprint（每个文件的 sha256 合成）' },
      { tone: 'none', text: '② 引擎文件的哈希（src/docreport/*.py、.dotx 模板、Schema、requirements、pyproject）' },
      { tone: 'none', text: '③ 本包构建产物的哈希（dist/、src/、package.json）——②③合成引擎指纹' },
      { tone: 'none', text: '④ layout.json 的哈希与模式' },
      { tone: 'good', text: '四项合成这一次的 fingerprint' },
      { tone: 'warn', text: '与上次成功的结果不同 → status 里 stale: true，旧结果算过期' },
    ],
    lock: { phase: '没有锁', dot: 'none', lines: [] },
    job: { label: '还没有任务', dot: 'none' },
    text: '引擎文件与本包产物一起算指纹：组装报告的代码或引擎任何一边变了，旧的导出结果就过期；过期不拦这次导出，只说明旧结果不能当新的用。',
  },
  {
    title: '拿锁',
    cardTitle: 'out/.web-export.lock',
    lines: [
      { tone: 'none', text: '锁文件建在引擎目录 out/ 下：一个引擎同一时间只导出一份' },
      { tone: 'none', text: '几个站点、几个开发服务共用同一份锁文件' },
      { tone: 'bad', text: '锁在而进程已退出时不自动清，报错：' },
      { tone: 'bad', text: lockWording.orphaned },
    ],
    lock: { phase: 'starting（Node 写入）', dot: 'info', lines: lockWording.writtenByNode },
    job: { label: 'running', dot: 'info' },
    text: 'Node 用独占创建拿下锁文件，写进任务 id 与进程号、phase 标成 starting；拿不到锁的下一个导出直接报错。锁在而进程已退出时也不自动清——先让人确认 Word 实例已结束再删，避免删掉别人刚拿到的锁。',
  },
  {
    title: '写快照目录',
    cardTitle: 'out/<任务 id>/',
    lines: [
      { tone: 'none', text: 'out/web-<uuid>/' },
      { tone: 'none', text: '├─ input/content.json        组装好的文档' },
      { tone: 'none', text: '├─ input/assets/…            改过名的图片' },
      { tone: 'none', text: '├─ sources/…                 原始 JSON' },
      { tone: 'none', text: '├─ source-manifest.json      每个文件的 sha256' },
      { tone: 'none', text: '└─ layout.json' },
      { tone: 'warn', text: `启动 Python 前再核一次引擎指纹，变了报：「${executeWording.engineChanged}」` },
    ],
    lock: { phase: 'starting（Node 写入）', dot: 'info', lines: lockWording.writtenByNode },
    job: { label: 'running', dot: 'info' },
    text: '交给 Word 的只有这份目录：input/ 里是组装好的文档与图片，sources/ 与 source-manifest.json 把原始 JSON 与哈希另存一份。报告目录里的任何脚本都不进去。',
  },
  {
    title: '启动 Python（--data-only）',
    cardTitle: '命令行',
    lines: [
      { tone: 'none', text: executeWording.command[0] },
      { tone: 'none', text: executeWording.command[1] },
      { tone: 'none', text: executeWording.command[2] },
      { tone: 'good', text: 'Python 把锁接过去：phase starting → rendering，记下 rendererPid' },
      { tone: 'good', text: '跑完自己释放锁（删掉锁文件）' },
    ],
    lock: { phase: 'rendering（Python 接手）', dot: 'warn', lines: pythonClaim.lockLines },
    job: { label: 'running', dot: 'info' },
    text: '--data-only 时引擎只认组装好的数据，不执行报告目录里的 report.py。锁交给 Python 后，Node 服务退出也不影响渲染中的任务；命令行 export 在这期间不断问状态，等同一个任务做完才退出。',
  },
  {
    title: '收尾',
    cardTitle: '任务状态',
    lines: [
      { tone: 'good', text: `核对记录 status: ${verifyWording.status}` },
      { tone: 'good', text: 'report.docx、report.pdf 的 sha256 与 manifest 对得上，才把任务标成 ready' },
      { tone: 'none', text: '结果在 out/<任务 id>/result/ 下，不放进站点' },
      { tone: 'warn', text: 'visualReview: pending——逐页显示还要人看' },
    ],
    lock: { phase: '已释放', dot: 'good', lines: [] },
    job: { label: 'ready', dot: 'good' },
    text: '引擎写出的核对记录状态、docx 与 pdf 的哈希都核对过，任务才标 ready；哪一步不对就是 failed，原话写在 message 里。逐页显示还要人看。',
  },
];
