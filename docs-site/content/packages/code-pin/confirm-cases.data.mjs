/**
 * ConfirmCases（「确认：哪些写回、哪些等人」一节）的数据：核对的一种结论配确认的一个动作。
 * 动作名与行为照 core/pinner.ts 的 ConfirmAction；标记那一行的哈希与 blob 名是示意值（与 pin-kinds 同一组），
 * 「有变动」的对比段（旧段与逐行对比）归核对那一节的 JudgeCases，这里只看标记那一行动不动。
 */

/** 确认时对一个结论做什么，动作名照 pinner.ts 的 ConfirmAction */
/* ref file="../packages/code-pin/src/core/pinner.ts" lines="18-27" hash="b775aac011bd" blob="d80e57b476c5" */
export const cases = [
  {
    id: 'fresh-moved',
    label: '新鲜·挪了位置',
    text: '核对映到今天：段哈希对得上，还是新鲜，只是上面加了几行、行段挪到了第 6–8 行。确认把行号改写成新位置，blob 名跟着换今天整份的；段哈希没变，写的还是原来那个值。',
    tone: 'good',
    statusWord: '新鲜',
    statusNote: '行段挪了位置',
    action: 'moved',
    actionWord: '写回：新行号与新记录',
    writes: true,
    before: '{/* ref file="../src/greet.ts" lines="3-5" hash="b9a8c7d6e5f4" blob="0f1e2d3c4b5a" */}',
    after: '{/* ref file="../src/greet.ts" lines="6-8" hash="b9a8c7d6e5f4" blob="3d4e5f6a7b8c" */}',
  },
  {
    id: 'unconfirmed',
    label: '未确认',
    text: '这一处还没确认过，记录是空的。确认按今天的内容记上段哈希与 blob 名，行号不变。',
    tone: 'pending',
    statusWord: '未确认',
    statusNote: '记录是空的',
    action: 'recorded',
    actionWord: '写上记录',
    writes: true,
    before: '{/* ref file="../src/greet.ts" lines="3-5" */}',
    after: '{/* ref file="../src/greet.ts" lines="3-5" hash="b9a8c7d6e5f4" blob="0f1e2d3c4b5a" */}',
  },
  {
    id: 'changed',
    label: '有变动',
    text: '映到今天段哈希对不上：有变动。确认不写这一处，等人复核正文那句还成不成立；复核完带上 --accept 再确认，才按今天的内容重新记。',
    tone: 'warn',
    statusWord: '有变动',
    statusNote: '段哈希对不上',
    action: 'needs-accept',
    actionWord: '不写，等人复核',
    writes: false,
    line: '{/* ref file="../src/greet.ts" lines="3-5" hash="b9a8c7d6e5f4" blob="0f1e2d3c4b5a" */}',
  },
  {
    id: 'changed-accept',
    label: '有变动·带 --accept',
    text: '同样是有变动，但这次确认带上了 --accept：按今天的内容重新记，段哈希与 blob 名都换成今天的。',
    tone: 'warn',
    statusWord: '有变动',
    statusNote: '带 --accept 确认',
    action: 'accepted',
    actionWord: '按今天的内容重新记',
    writes: true,
    before: '{/* ref file="../src/greet.ts" lines="3-5" hash="b9a8c7d6e5f4" blob="0f1e2d3c4b5a" */}',
    after: '{/* ref file="../src/greet.ts" lines="3-5" hash="1a2b3c4d5e6f" blob="9a8b7c6d5e4f" */}',
  },
  {
    id: 'missing',
    label: '缺失',
    text: '被钉的文件不在了，或整段已被删光：缺失。确认拒绝这一处，红的一律不写——要改正文或删掉这处引用。',
    tone: 'bad',
    statusWord: '缺失',
    statusNote: '文件不在了，或整段删光',
    action: 'refused',
    actionWord: '不写，要改正文或删掉引用',
    writes: false,
    line: '{/* ref file="../src/greet.ts" lines="3-5" hash="b9a8c7d6e5f4" blob="0f1e2d3c4b5a" */}',
  },
];
