/**
 * StatusCases（「comments：评论」那一页「已解决只记在串头」一节）的全部数据，画面（status-cases.tsx）只读这一份。
 * 串头沿用页面贯穿的例子（小周批「第二段话。」那串，id 与正文在 example.data.mjs）；
 * 标的人与时刻照 thread-status.test.ts 的小周用例，resolve-again 的原话与那条测试断言的字面一致
 * （原话模板在 node/store.ts 的 setThreadStatus，下方钉了码）。重复标被拒时文件不动。
 */
import { commentBody, threadId } from './example.data.mjs';

/** 串头文件的路径（相对站点评论目录） */
export const headPath = `${threadId}/index.mdx`;

/** 标为已解决的人（人员 id）与时刻：照测试用例的小周 */
export const resolvedBy = 'zhou';
export const resolvedAt = '2026-10-15T08:00:00.000Z';

/** 串头 frontmatter 里状态的三种样子（每个值一行 JSON 字符串，照 serializeCommentFile 的写法） */
export const openLines = ['status: "open"'];
export const resolvedLines = ['status: "resolved"', `resolvedBy: "${resolvedBy}"`, `resolvedAt: "${resolvedAt}"`];

/** 已经是已解决再标一次，action 回给浏览器的那句（原话照 setThreadStatus 的报错模板拼本页例子的 id） */
export const rejectedMessage = `评论串 ${threadId} 已经是已解决（${resolvedBy} 在 ${resolvedAt} 标的）`;

/** setThreadStatus：只改串头三项、别的字段与正文原样写回；已经是这个状态就 409，写明谁在什么时候标的 */
/* ref file="../packages/comments/src/node/store.ts" lines="93-113" hash="6f9768792991" blob="2b8aa1c9999c" */
/** 测试：标为已解决写上连续的三行，重新打开后文件与标之前一个字不差 */
/* ref file="../packages/comments/test/thread-status.test.ts" lines="28-43" hash="6bc337fb932a" blob="f6f3c76d0905" */
/** 测试：重复标 409，报错里有「谁在什么时候标的」 */
/* ref file="../packages/comments/test/thread-status.test.ts" lines="45-53" hash="81cdb30176df" blob="f6f3c76d0905" */
export const cases = [
  {
    id: 'resolve',
    label: '标为已解决',
    old: openLines,
    now: resolvedLines,
    text: '只改串头 frontmatter 的三项：status 换成 resolved，再添 resolvedBy（标的人，人员 id）与 resolvedAt（ISO 时刻），放在原来 status 的位置。别的字段与正文原样写回，回复一个字不动。',
  },
  {
    id: 'reopen',
    label: '重新打开',
    old: resolvedLines,
    now: openLines,
    text: '反过来：三项换回 status: "open"，resolvedBy、resolvedAt 两行删掉。写完的文件与标为已解决之前一个字不差。',
  },
  {
    id: 'resolve-again',
    label: '重复标',
    rejected: true,
    text: '已经是已解决再标一次，拒绝（409）并写明是谁在什么时候标的；文件一个字不动。重新打开也一样：本来就是未解决就拒绝（409）。',
  },
];
