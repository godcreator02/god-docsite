/**
 * 「核对一处行段引用的顺序」的全部讲解数据：画面（judge.tsx）与机读版规则（pin.ai.mjs）都只读这一份。
 * 五道检查照 docfirst-pin 的 compare.ts 里 judgeSpan 的顺序排，前一道能下结论就不往下走。
 */

/**
 * 五道检查。outs 是这一道能直接给出的结论
 * @typedef {'fresh' | 'changed' | 'missing' | 'unconfirmed'} Status
 * @typedef {{ id: string, when: string, status: Status, label: string }} Outcome
 * @type {{ id: string, q: string, detail: string, outs: Outcome[] }[]}
 */
export const checks = [
  {
    id: 'file',
    q: '被钉的文件还在吗？',
    detail: '文件读不到，后面都不用看。',
    outs: [{ id: 'file-missing', when: '不在', status: 'missing', label: '缺失 · 文件不在了' }],
  },
  {
    id: 'hash',
    q: '记号上那几行现在算出的 hash，还等于记号上的 hash 吗？',
    detail: '最常见的情况就停在这里：代码没动过。',
    outs: [{ id: 'same', when: '相等', status: 'fresh', label: '新鲜 · 行号不动' }],
  },
  {
    id: 'old',
    q: '取得到确认时的整个文件吗？',
    detail: '今天文件的 blob 名等于记录，旧文件就是今天的文件；否则按记录的 blob 名去 git 对象库里取。确认之后没提交又改过，就取不到。',
    outs: [],
  },
  {
    id: 'map',
    q: '取得到：照改动把旧行段对到今天',
    detail: '拿旧文件和今天的文件算出改动，把记号上的行段挪到今天的位置，再比一次 hash。',
    outs: [
      { id: 'vanished', when: '对不到', status: 'missing', label: '缺失 · 整段删光' },
      { id: 'moved', when: 'hash 相同', status: 'fresh', label: '新鲜 · 挪了位置' },
      { id: 'changed', when: 'hash 不同', status: 'changed', label: '有变动 · 附旧行新行' },
    ],
  },
  {
    id: 'scan',
    q: '取不到：在整个文件里找 hash 相同的几行',
    detail: '从头到尾取同样行数的每一段算 hash，找跟记号上相同、离原来行号最近的那一处。',
    outs: [
      { id: 'found', when: '找到', status: 'fresh', label: '新鲜 · 找到了' },
      { id: 'unlocated', when: '找不到', status: 'changed', label: '有变动 · 位置不明' },
    ],
  },
];

/**
 * 几种典型情况：path 是依次经过的检查与每一道的回答，result 是最后落在哪个结论上。
 * 例子都是钉住 greet.ts 第 2–3 行之后发生的事。
 * @type {{ id: string, label: string, path: [string, string][], result: string, text: string }[]}
 */
export const cases = [
  {
    id: 'none',
    label: '什么都没改',
    path: [['file', '在'], ['hash', '相等']],
    result: 'same',
    text: '第二道就下结论：hash 相等，绿，行号不动。',
  },
  {
    id: 'moved',
    label: '上面插了两行',
    path: [['file', '在'], ['hash', '不等'], ['old', '取得到'], ['map', 'hash 相同']],
    result: 'moved',
    text: '2–3 行现在是别的内容，hash 不等；从 git 取回确认时的文件，把 2–3 行对到今天的 4–5 行，hash 相同，还是绿。confirm 会把行号写回成 4-5。',
  },
  {
    id: 'edited',
    label: '改了其中一个字',
    path: [['file', '在'], ['hash', '不等'], ['old', '取得到'], ['map', 'hash 不同']],
    result: 'changed',
    text: '对到今天的位置之后 hash 仍然不同，就是内容真变了：黄，页面上给出旧行和新行。',
  },
  {
    id: 'deleted',
    label: '把这两行删了',
    path: [['file', '在'], ['hash', '不等'], ['old', '取得到'], ['map', '对不到']],
    result: 'vanished',
    text: '改动里这两行整段被删，今天的文件里没有它们的位置：红。',
  },
  {
    id: 'unsaved-move',
    label: '确认后没提交，又挪了位置',
    path: [['file', '在'], ['hash', '不等'], ['old', '取不到'], ['scan', '找到']],
    result: 'found',
    text: '确认时那版文件没进过 git，取不回来，只能在整个文件里找 hash 相同的几行；找到了，还是绿。',
  },
  {
    id: 'unsaved-edit',
    label: '确认后没提交，又改了内容',
    path: [['file', '在'], ['hash', '不等'], ['old', '取不到'], ['scan', '找不到']],
    result: 'unlocated',
    text: '取不回旧文件，整个文件里也找不到 hash 相同的几行：黄，而且说不出改了什么，页面上只留一句提示，要人重读源码后再确认。',
  },
  {
    id: 'gone',
    label: '整个文件删了',
    path: [['file', '不在']],
    result: 'file-missing',
    text: '第一道就下结论：红。',
  },
];
