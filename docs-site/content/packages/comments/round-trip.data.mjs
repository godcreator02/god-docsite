/**
 * CommentRoundTrip（「comments：评论」那一页）的全部数据，画面（round-trip.tsx）只读这一份。
 * 六步：划字算锚点 → 提交表单到 /comments → 核对来源与身份 → 写成一个文件夹 → 读回本页的评论串 → 回到正文。
 * 共用的例子（名单、正文、锚点、串 id）从 example.data.mjs 来；
 * 第 2 步的表单字段、第 4 步的整份文件照源码的写法逐字抄，各在数据正上方钉了码。
 */
import { anchorJson, commentBody, pageKey, quote, quoteSpan, snapshot, threadId, trustedOrigin } from './example.data.mjs';

/** 三条横道：这一步东西在谁手里。浏览器 blue、站点服务端 violet、磁盘 emerald，整幅画不换 */
export const lanes = [
  { id: 'browser', title: '浏览器', role: 'blue' },
  { id: 'server', title: '站点服务端', role: 'violet' },
  { id: 'disk', title: '磁盘：站点的 comments/', role: 'emerald' },
];

/** 第 1 步下半：锚点 JSON 的四行 */
export const anchorLines = [`quote: "${quote}"`, `start: ${quoteSpan[0]}`, `end: ${quoteSpan[1]}`, `snapshot: "${snapshot}"`];

/** 第 2 步：提交的请求。表单字段是 create-thread 收的那几个（page、body、anchor），多写一个就拒绝 */
/* ref file="../packages/comments/src/site/action.server.ts" lines="26-34" hash="3d03657ee3c9" blob="6d59e89ad160" */
export const requestLines = [
  { text: 'POST /comments', kind: 'cmd' },
  { text: `Origin: ${trustedOrigin}`, kind: 'out' },
  { text: `intent=create-thread`, kind: 'out' },
  { text: `page=${pageKey}`, kind: 'out' },
  { text: `anchor=${anchorJson}`, kind: 'out' },
  { text: `body=${commentBody}`, kind: 'out' },
];

/** 第 3 步：核对的清单（三项都过才往下写） */
export const checks = ['Origin 等于可信 origin', '本机身份：zhou（小周）', 'as：不写，用当前身份'];
/** 清单下面的一句：被拒的情况不在这一页讲 */
export const checksNote = '被拒的情况见 identity 页';

/** 第 4 步右半：写出的整份串头（字段顺序与写法照 createThread 与 serializeCommentFile 逐字照抄） */
/* ref file="../packages/comments/src/node/store.ts" lines="56-63" hash="b036365e5954" blob="2b8aa1c9999c" */
export const threadFileLines = [
  '---',
  `page: "${pageKey}"`,
  'author: "zhou"',
  'createdAt: "2026-10-12T07:30:00.000Z"',
  'status: "open"',
  `anchor: ${JSON.stringify(anchorJson)}`,
  '---',
  '',
  commentBody,
];

/** 第 4 步左半：评论目录里的文件树 */
export const threadTreeLines = ['comments/', `└─ ${threadId}/`, '   └─ index.mdx'];

/** 第 5 步：loader 交给浏览器的那一串（作者已换成名单里的 id 和名字，身份码不跟出去） */
export const loaderLines = [
  `id: "${threadId}"`,
  `headPath: "${threadId}/index.mdx"`,
  `page: "${pageKey}"`,
  `anchor: ${anchorJson}`,
  'author: { id: "zhou", name: "小周" }',
  'createdAt: "2026-10-12T07:30:00.000Z"',
  'replies: []',
];
/** author 那一行（第 5 行）的旁注 */
export const loaderAuthorLine = 5;
export const loaderAuthorPill = 'author 只有 id 和 name';
/** 第 5 步左半的一句 */
export const collectionNote = 'fumadocs-mdx 集合 comments 的条目';

/** 第 6 步：收件箱那一行 */
export const inboxRow = { avatar: '小', name: '小周', time: '刚刚', note: `「${quote}」` };

/**
 * 六步。lane：这一步在哪条横道做事（那条亮着、放画面，另两条调淡只留标题）；
 * flow：跨横道传的东西，gap 是两道之间的间隙（0 在浏览器与服务端之间、1 在服务端与磁盘之间），
 * dir 是方向，label 写在箭头旁。锚点在第 1 步就定了，服务端只原样存、原样读回，找回位置是浏览器在第 6 步做的。
 */
export const steps = [
  {
    title: '划字，算出锚点',
    lane: 'browser',
    text: '小周在正文里划了「第二段话。」。正文容器里的文字按顺序拼成一个字符串，图片算一个字，这五个字是第 15 到 19 个字。锚点存下原文、起止位置和这一刻的整页文字。',
  },
  {
    title: '提交表单到 /comments',
    lane: 'browser',
    flow: { gap: 0, dir: 'down', label: '表单' },
    text: '浮出的输入框写完按 Enter，表单提交到 /comments。全站的评论写入都交给这一个地址。',
  },
  {
    title: '核对来源与身份',
    lane: 'server',
    text: '服务端先核对：请求来自站点自己的页面，本机的身份码认出是小周，没写 as。三项都过才往下写。',
  },
  {
    title: '写成一个文件夹',
    lane: 'server',
    flow: { gap: 1, dir: 'down', label: 'createThread 写文件' },
    text: '按本机时刻生成串 id，建一个同名文件夹，串头 index.mdx 写 page、author、createdAt、status 和 anchor。每个值是一行 JSON 字符串，正文在 frontmatter 下面。写完不编译，fumadocs-mdx 的集合自己会重新生成入口。',
  },
  {
    title: '读回本页的评论串',
    lane: 'server',
    flow: { gap: 1, dir: 'up', label: '本页评论串' },
    text: '页面 loader 从集合里挑出 page 是 index.mdx 的串，作者 id 换成名单里的 id 和名字交给浏览器，身份码不会跟出去。',
  },
  {
    title: '回到正文',
    lane: 'browser',
    flow: { gap: 0, dir: 'up' },
    text: '浏览器拿锚点在现在的正文里找位置：快照和现在的页面文字一样，直接就是第 15 到 19 个字，铺上高亮。正文改过的情况见下面「正文改了以后」。',
  },
];
