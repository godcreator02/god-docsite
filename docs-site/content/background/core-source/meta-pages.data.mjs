/**
 * MetaPages（「fumadocs-core 页面来源导读」页「页面树怎么建」一节）的全部数据，画面（meta-pages.tsx）只读这一份。
 * 同一个文件夹、六种 pages 写法：文件夹里是 a.mdx、b.mdx、c.mdx、子文件夹 sub/（里面 d.mdx）。
 * 每种写法排出来的侧栏顺序照 16.17.1 的 builder.ts 与 transformer-fallback.ts 从这组文件推出来：
 * 正序时同层文件夹排在页面之后、倒序（"z...a"）时排最前；主树没访问到的文件进 root.fallback。
 * 侧栏里的名字就写文件名（小写），不画 builder.ts 给没有 title 的页面自动大写首字母那一步。
 */

/** 六种情况共用的文件夹内容，显示在 meta.json 卡片标题栏右侧 */
export const folderNote = '同文件夹：a、b、c、sub/(d)';

export const cases = [
  {
    id: 'rest',
    label: '"..." 正序',
    metaLines: ['{', '  "pages": [', '    "c",', '    "..."', '  ]', '}'],
    sidebar: [
      { kind: 'page', name: 'c' },
      { kind: 'page', name: 'a' },
      { kind: 'page', name: 'b' },
      { kind: 'folder', name: 'sub', children: ['d'] },
    ],
    fallback: null,
    text: '"..." 把没列出的项按正序放进这个位置：c 列在最前，a、b、sub 跟在后面；同一层里文件夹排在页面之后。',
  },
  {
    id: 'rest-reverse',
    label: '"z...a" 倒序',
    metaLines: ['{', '  "pages": [', '    "z...a"', '  ]', '}'],
    sidebar: [
      { kind: 'folder', name: 'sub', children: ['d'] },
      { kind: 'page', name: 'c' },
      { kind: 'page', name: 'b' },
      { kind: 'page', name: 'a' },
    ],
    fallback: null,
    text: '"z...a" 同样收进所有没列出的项，但按倒序：sub 是文件夹，正序时排在最后，倒序时就排到最前。',
  },
  {
    id: 'separator-link',
    label: '分隔线与链接',
    metaLines: ['{', '  "pages": [', '    "a",', '    "---进阶---",', '    "[官网](https://fumadocs.dev)",', '    "..."', '  ]', '}'],
    sidebar: [
      { kind: 'page', name: 'a' },
      { kind: 'separator', name: '进阶' },
      { kind: 'link', name: '官网', url: 'https://fumadocs.dev' },
      { kind: 'page', name: 'b' },
      { kind: 'page', name: 'c' },
      { kind: 'folder', name: 'sub', children: ['d'] },
    ],
    fallback: null,
    text: '"---进阶---" 画一条分隔线；"[官网](https://fumadocs.dev)" 是一个链接节点，不指向站内页面；"..." 再把其余项收进来。',
  },
  {
    id: 'exclude',
    label: '"!b" 排除',
    metaLines: ['{', '  "pages": [', '    "...",', '    "!b"', '  ]', '}'],
    sidebar: [
      { kind: 'page', name: 'a' },
      { kind: 'page', name: 'c' },
      { kind: 'folder', name: 'sub', children: ['d'] },
    ],
    fallback: [{ kind: 'page', name: 'b' }],
    text: '"!b" 把 b 从 "..." 里排除：它不进主树，落到 root.fallback；侧栏与上下页查那棵子树时仍能找到它。',
  },
  {
    id: 'flatten',
    label: '"...sub" 摊平',
    metaLines: ['{', '  "pages": [', '    "a",', '    "...sub"', '  ]', '}'],
    sidebar: [
      { kind: 'page', name: 'a' },
      { kind: 'page', name: 'd' },
    ],
    fallback: [
      { kind: 'page', name: 'b' },
      { kind: 'page', name: 'c' },
    ],
    text: '"...sub" 把子文件夹的内容摊平到当前层：d 直接出现在上一层，sub 不再是一层文件夹；b、c 没被列到，进 root.fallback。',
  },
  {
    id: 'unlisted',
    label: '只列 "a"',
    metaLines: ['{', '  "pages": [', '    "a"', '  ]', '}'],
    sidebar: [{ kind: 'page', name: 'a' }],
    fallback: [
      { kind: 'page', name: 'b' },
      { kind: 'page', name: 'c' },
      { kind: 'folder', name: 'sub', children: ['d'] },
    ],
    text: '只列 a 时，b、c、sub 都没被任何 meta 列到，整棵落进 root.fallback——侧栏与上下页都会查这棵子树，文件不会丢。',
  },
];
