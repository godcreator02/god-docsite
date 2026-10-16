/**
 * NewProblems（「collab：项目协作」那一页「读出状态与校验」一节）的全部数据，画面（new-problems.tsx）只读这一份。
 * 一个例子摆完 newProblems(before, after) 是差集：before 两条问题，这次提交修好一条、带来一条新的、原样留着一条，
 * 结果只交回新的那条。问题原话照测试断言抄（validate.test.ts），三条都是仓里测试里的真实说法。
 */

/** before（分叉点）上就有的两条问题；file 是相对 collab/ 的路径，message 是 validateCollab 的原话 */
/* ref file="../packages/collab/test/validate.test.ts" lines="34-37" hash="d83c002f9b6b" blob="1c93005d969a" */
export const fileNameProblem = { file: 'records/20260925000000-aaaaaaa.json', message: '文件名是 20260925000000-aaaaaaa.json，记录的 id 却是 20260925160530-t5v9w3d；文件名要等于 id' };

/* ref file="../packages/collab/test/validate.test.ts" lines="20-27" hash="868bf69d5c83" blob="1c93005d969a" */
export const formatProblem = { file: 'records/20260925160530-t5v9w3d.json', message: '不是规范写法：键序、缩进、空白、转义或结尾换行和重新编码的结果不同' };

/** 这次提交带来的新问题：把 author 改成了不在人员列表里的 dave */
/* ref file="../packages/collab/test/validate.test.ts" lines="39-43" hash="2ad134d7f41f" blob="1c93005d969a" */
export const authorProblem = { file: 'records/20260925160530-t5v9w3d.json', message: '作者 dave 不在 site/people.json 里' };

/** after（这次提交后）里的三行：same 两边都有、new 这次带来、fixed 已经修好（after 里其实没有它，画出来划掉） */
export const after = [
  { kind: 'same', ...fileNameProblem },
  { kind: 'new', ...authorProblem },
  { kind: 'fixed', ...formatProblem },
];

/** newProblems(before, after) 交回的：只有新的一条 */
export const blocked = [authorProblem];

/** 卡片下面那行灰字 */
export const note = '同一个文件、同一句说法算同一个问题；修好的（before 有、after 没有）自然消失，不挡这次写入。';

/** 三张卡上方的图例：三种状态点各是什么 */
export const legend = [
  { tone: 'pending', label: '两边都有（同一个问题）' },
  { tone: 'bad', label: '这次新带来' },
  { tone: 'good', label: '已修好（after 里没了）' },
];

/** 画面的讲解段落 */
export const text =
  'bob 的提交把 20260925160530 那条记录重新存成规范写法（修好一条），但顺手把 author 改成了不在人员列表里的 dave（带来一条新的）；' +
  '文件名那条是别人早就留下的，两边原样都有。newProblems(before, after) 只交回差集——新的那一条；文件名那条两边都有、照旧不挡，修好的那条在 after 里已经没了。';
