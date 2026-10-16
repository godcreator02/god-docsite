/**
 * AnchorKinds（「comments：评论」那一页「批在哪：锚点的三种写法」一节）的全部数据，画面（anchor-kinds.tsx）只读这一份。
 * 同一个 anchor 字段按字面认成四种结果，认法照 core/anchor.ts 的 parseCommentAnchor（下方钉了码）；
 * 划字那行的 JSON 与页面的 mdx 例子同一条（example.data.mjs 的 anchorJson）；「认不出」那行是拼的例子：
 * 合法 JSON 但缺 end 与 snapshot，正好落在 textAnchorOf 解析不出四项的分支上。
 * 页面里批中的地方的标记色（整页描边、元素竖条、划字高亮）都取 warn 一族，与站点批注的视觉一致。
 */
import { anchorJson } from './example.data.mjs';

/** parseCommentAnchor：不写或空串是整页，不以 { 开头是元素 id，剩下的按 JSON 认划字，认不出是 broken */
/* ref file="../packages/comments/src/core/anchor.ts" lines="31-39" hash="8f104a3d8805" blob="35261a2b0ccd" */
export const cases = [
  {
    id: 'whole-page',
    label: '批整页',
    /** 串头里 anchor 那一行（anchor 是串头 frontmatter 的第 6 行，与页面 mdx 例子同一个位置） */
    anchorLines: ['anchor: ""'],
    mark: 'page',
    text: '不写 anchor 字段，或写成空串：批整页。整页的评论不带位置，收件箱里放在「整页」一栏。',
  },
  {
    id: 'element',
    label: '批一个元素',
    anchorLines: ['anchor: "自己的标题"'],
    mark: 'element',
    text: '不以 { 开头的字符串：一个页面元素的 id。标题有正文编译时自己的 id（例子里是「自己的标题」），别的块用下面「批一块」讲的稳定 id。',
  },
  {
    id: 'selection',
    label: '批一段字',
    anchorLines: [`anchor: ${JSON.stringify(anchorJson)}`],
    mark: 'text',
    text: 'JSON：划字。quote 是选中的原文，start、end 是它在页面文字里的位置（不含 end），snapshot 是发起那一刻的整页文字——正文改了以后靠它推算落点。',
  },
  {
    id: 'unreadable',
    label: '认不出',
    anchorLines: ['anchor: "{\\"quote\\":\\"第二段话。\\",\\"start\\":15}"'],
    mark: 'broken',
    text: '以 { 开头却解析不出这四项的（JSON 坏了、缺字段）：算「锚点数据认不出」，界面上标出来，不让整页挂掉。',
  },
];
