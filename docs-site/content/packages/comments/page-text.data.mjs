/**
 * PageText（「comments：评论」那一页「正文里的位置：页面文字」一节）的数据，画面（page-text.tsx）只读这一份。
 * 左卡的 DOM 是拼的例子：结构与字面照 browser-anchors.test.ts 的样例容器，sr-only 的字用 page-text.ts 注释里的「复制这一节的链接」，
 * 页面文字规则（哪些算一个字、哪些不算）钉在下面；右卡的 26 个字格与 start 15、end 20 是同一个例子的页面文字（example.data.mjs）。
 */
import { snapshotChars } from './example.data.mjs';

/** 左卡：正文的 DOM（拼的例子，结构与 pageTextOf 的走法对得上） */
export const dom = {
  headingOpen: '<h2 id="自己的标题">标题文字',
  srOnlyOpen: '  <span class="sr-only">',
  srOnlyText: '复制这一节的链接',
  srOnlyClose: '</span>',
  headingClose: '</h2>',
  paraStrong: '<p>第一段话，<strong>着重</strong>的部分。</p>',
  paraQuoted: '<p>第二段话。</p>',
  paraImage: '<p><img src="/x/y.png" alt="图" />后面还有字</p>',
};

/** 右卡的注：折叠规则一句话 */
export const pageNote = '正文容器（data-comment-scope）里的文字节点按顺序拼成；图片、公式整个算一个字 ￼；只给读屏软件看的字不算。';

/** 页面文字与怎么数它（pageTextOf 的走法、原子字与 sr-only 的规则） */
/* ref file="../packages/comments/src/site/browser/page-text.ts" lines="8-30" hash="0044555ef006" blob="306242d374fb" */
/* ref file="../packages/comments/src/site/browser/page-text.ts" lines="53-75" hash="30784884637a" blob="306242d374fb" */
export const cells = snapshotChars;
