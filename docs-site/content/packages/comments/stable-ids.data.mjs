/**
 * StableIds（「comments：评论」那一页「批一块：可批元素与稳定 id」一节）的全部数据，画面（stable-ids.tsx）只读这一份。
 * 规则（dc- 前缀、同页相同内容按出现次序加 -2、-3）照 annotate.ts 的候选走查，下方钉了码；
 * 三段例子的文字是为讲解拼的，指纹不是示意值：按 annotate.ts 同样的 FNV-1a 对「text:<段落文字>」实算（2026-10-16 本机 node 跑出），
 * 换了内容指纹就变，id 跟着变。
 */
export const paragraphs = {
  a: { text: '一模一样的话', fingerprint: '12foe55' },
  b: { text: '不一样的话', fingerprint: '1jz0q85' },
  bChanged: { text: '改过的不一样的话', fingerprint: '1rda74t' },
};

const idOf = (fingerprint) => `dc-${fingerprint}`;

/** 候选走查给没有 id 的元素分配稳定 id：内容指纹加 dc- 前缀，同页相同的按出现次序加 -2、-3 */
/* ref file="../packages/comments/src/site/browser/annotate.ts" lines="56-72" hash="b79518cf93ae" blob="54bd19da4787" */
export const cases = [
  {
    id: 'as-is',
    label: '三段：A、B、A',
    blocks: [
      { text: paragraphs.a.text, id: idOf(paragraphs.a.fingerprint) },
      { text: paragraphs.b.text, id: idOf(paragraphs.b.fingerprint) },
      { text: paragraphs.a.text, id: `${idOf(paragraphs.a.fingerprint)}-2` },
    ],
    text: 'id 按内容指纹算（dc- 加指纹），内容不变它就不变；同页内容相同的按出现次序加后缀——第二份 A 拿到 -2。走查只加属性、不产生文字，页面文字不受影响。',
  },
  {
    id: 'edit-elsewhere',
    label: '改了 B 的文字',
    blocks: [
      { text: paragraphs.a.text, id: idOf(paragraphs.a.fingerprint) },
      { text: paragraphs.bChanged.text, id: idOf(paragraphs.bChanged.fingerprint), changed: true },
      { text: paragraphs.a.text, id: `${idOf(paragraphs.a.fingerprint)}-2` },
    ],
    text: '改了 B 的文字：指纹跟着变，B 的 id 换成新的；两段 A 的内容没动，id 原样，批在 A 上的评论不受影响。',
  },
  {
    id: 'insert-same-before',
    label: '最前面插一份 A',
    knownEdge: true,
    blocks: [
      { text: paragraphs.a.text, id: idOf(paragraphs.a.fingerprint), inserted: true },
      { text: paragraphs.a.text, id: `${idOf(paragraphs.a.fingerprint)}-2`, changed: true },
      { text: paragraphs.b.text, id: idOf(paragraphs.b.fingerprint) },
      { text: paragraphs.a.text, id: `${idOf(paragraphs.a.fingerprint)}-3`, changed: true },
    ],
    text: '最前面插了一份一模一样的 A：新插的按第一份拿到 dc- 原指纹，原来的两段 A 后缀整体后移，批在它们上面的评论会找错段——这是协议里已知的边界。',
  },
];
