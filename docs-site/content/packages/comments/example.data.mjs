/**
 * 「comments：评论」那一页两个讲解组件（CommentRoundTrip、WhereItLands）共用的例子数据：
 * 小周在页面 index.mdx 上划了「第二段话。」这五个字写一条评论，全页的例子都是这一条。
 * 名单、可信 origin、页面 key 照 action.test.ts 抄；正文与页面文字照 browser-anchors.test.ts 的样例容器抄；
 * 串 id 的形状照 comment-file.ts 里的例子，写入时刻取本机 2026-10-12 15:30:00（机器在 UTC+8），
 * createdAt 是同一刻的 UTC 时刻。
 */

/** 测试里的名单（身份码只在这份数据里出现，不进画面）：小周是本机身份，Claude 是 agent */
/* ref file="../packages/comments/test/action.test.ts" lines="10-15" hash="a251583e78aa" blob="3e1000277404" */
export const people = [
  { id: 'zhou', name: '小周', codes: ['zhoucode0001'] },
  { id: 'li', name: '小李' },
  { id: 'claude', name: 'Claude', agent: true },
];
export const trustedOrigin = 'http://127.0.0.1:4430';
export const pageKey = 'index.mdx';

/** 例子页面的正文：标题带自己的 id、三段，第四段段首有一张图片；只给读屏软件看的字不进画面 */
/* ref file="../packages/comments/test/browser-anchors.test.ts" lines="8-19" hash="442aaaa02f79" blob="d4d301c9a9b4" */
export const bodyBlocks = [
  { kind: 'heading', text: '标题文字' },
  { kind: 'para', text: '第一段话，着重的部分。' },
  { kind: 'para', text: '第二段话。', quoted: true },
  { kind: 'para', image: true, text: '后面还有字' },
];

/** 页面文字：正文容器里的文字按顺序拼成的一个字符串（图片整个算一个字 ￼，只给读屏软件看的字不算），拆成字给画面画字格 */
export const snapshot = '标题文字第一段话，着重的部分。第二段话。￼后面还有字';
export const snapshotChars = [...snapshot].map((char) => ({ char, atomic: char === '￼' }));

/** 选中的原文与它在页面文字里的位置：第 15 到 19 个字（锚点按「不含 end」写成 15、20） */
export const quote = '第二段话。';
export const quoteSpan = [15, 20];

/** 评论的正文：编的例子 */
export const commentBody = '这一句要不要举个例子？';

/** 写入那一刻（本机 2026-10-12 15:30:00）：串 id 的时间部分是本机时刻，随机部分用 comment-file.ts 例子里的 ab12 */
export const threadId = '20261012t153000-ab12';
/** 同一刻的 UTC ISO 时刻：串头 frontmatter 里的 createdAt */
export const createdAt = '2026-10-12T07:30:00.000Z';

/** 划字锚点（TextAnchorFields）与它序列化成的 JSON：串头 anchor 字段存的就是这个 JSON 字符串 */
export const anchorFields = { quote, start: quoteSpan[0], end: quoteSpan[1], snapshot };
export const anchorJson = JSON.stringify(anchorFields);
